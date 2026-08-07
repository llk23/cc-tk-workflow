import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';
import { chromium, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/** 清理 Chrome profile 残留锁文件（多节点串行启动同一目录时防止 launch 秒退） */
function cleanChromeLocks(userDataDir: string): void {
  try {
    const lockNames = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'DevToolsActivePort'];
    for (const name of lockNames) {
      const p = path.join(userDataDir, name);
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    }
  } catch { /* 忽略 */ }
}

/** 启动持久化浏览器上下文：先清锁，失败重试一次 */
async function launchContext(userDataDir: string): Promise<BrowserContext> {
  cleanChromeLocks(userDataDir);
  const opts: any = {
    channel: 'chrome',
    headless: process.env.TK_HEADLESS !== 'false',
    viewport: { width: 1280, height: 900 },
    userAgent: UA,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  };
  try {
    return await chromium.launchPersistentContext(userDataDir, opts);
  } catch {
    await new Promise((r) => setTimeout(r, 2000));
    cleanChromeLocks(userDataDir);
    return chromium.launchPersistentContext(userDataDir, opts);
  }
}

/**
 * TK 账号验证节点（Cookie 校验 · Playwright 进程内浏览器版）
 *
 * 单一职责：校验用户粘贴的 TikTok 登录 Cookie 在当前地区是否有效。
 *  - 不做搜索 / 抓取 / 下载（那些属于「TK 视频抓取」等其他节点）。
 *
 * 为什么走浏览器（Playwright 进程内）而不是服务端直连？
 *  - 服务端 Node 进程在中国大陆直连 tiktok.com 会被墙（DNS/连接不可达），
 *    表现为 `fetch failed`。
 *  - 浏览器带可用网络出口，能正常访问 TikTok，且可注入 httpOnly Cookie。
 *  - 本节点通过 Playwright 在进程内自行启动浏览器（chromium.launchPersistentContext），
 *    不再依赖外部 CDP Proxy (:3456) / 手动启动的 Chrome (:9222)。
 *
 * 输出格式：{ valid, username, region, cookie, cookieLength, message }
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseCookieString(cookie: string) {
  return String(cookie)
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=');
      const name = idx > 0 ? pair.slice(0, idx).trim() : pair.trim();
      const value = idx > 0 ? pair.slice(idx + 1).trim() : '';
      return {
        name,
        value,
        domain: '.tiktok.com',
        path: '/',
        httpOnly: true,
        secure: true,
      };
    });
}

export class TikTokAccountVerifyNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.TK_ACCOUNT_VERIFY,
    label: 'TK 账号验证',
    description: '校验 TikTok 登录 Cookie 是否有效（Playwright 进程内浏览器）',
    category: 'input',
    icon: '🔐',
    inputs: [{ id: 'trigger', name: '触发信号', type: 'any', required: false }],
    outputs: [{ id: 'result', name: '验证结果', type: 'any', required: true }],
    defaultConfig: {
      cookie: '',
      region: 'US',
    },
  };

  async execute(config: NodeConfig, _input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const { cookie, region } = config as any;

    ctx.logger(`[TK账号验证] region=${region} 正在通过浏览器校验 Cookie...`);

    if (!cookie || !String(cookie).trim()) {
      throw new Error(
        '缺少 Cookie，无法验证。请在节点配置中粘贴 TikTok 登录 Cookie（sessionid;sid_tt;ttwid）。',
      );
    }

    const baseUrl = `https://www.tiktok.com/?lang=en&region=${region}`;

    // ---- 进程内启动浏览器 ----
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    let valid = false;
    let username = '';
    let message = '';

    try {
      ctx.onProgress(15);
      const userDataDir = process.env.PLAYWRIGHT_USER_DATA_DIR || '.cache/playwright-tk';
      context = await launchContext(userDataDir);
      page = await context.newPage();
      ctx.logger('✅ 浏览器已在进程内启动（本机 Chrome）');

      // 反检测
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      // ---- 注入 Cookie ----
      ctx.onProgress(35);
      const cookies = parseCookieString(cookie);
      try {
        await context.addCookies(cookies);
        ctx.logger(`已注入 ${cookies.length} 个 Cookie`);
      } catch (e: any) {
        ctx.logger(`⚠️ Cookie 注入失败：${e.message}`);
      }

      // ---- 打开 TikTok 首页（带 Cookie） ----
      ctx.onProgress(55);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // ---- 轮询等待 SPA 渲染并检测登录态 ----
      ctx.onProgress(80);
      let parsed: any = {};
      for (let i = 0; i < 25; i++) {
        await page.waitForTimeout(1000);
        try {
          parsed = await page.evaluate(() => {
            const icon = document.querySelector('[data-e2e=profile-icon]');
            let u = '';
            if (icon) {
              let el = icon as HTMLElement;
              while (el && el.tagName !== 'A') {
                el = el.parentElement as HTMLElement;
              }
              if (el) u = el.getAttribute('href') || '';
            }
            if (!u) {
              const a = document.querySelector('a[href^="/@"]');
              if (a) u = a.getAttribute('href') || '';
            }
            if (u.startsWith('/@')) u = u.slice(2).split('?')[0];
            const hasUpload = !!document.querySelector('[data-e2e=upload-icon], a[href="/upload"]');
            const hasLoginBtn = !!document.querySelector('[data-e2e=top-login-button], a[href*="/login"]');
            const titleBadge = /^\(([^)]+)\)/.test(document.title);
            return {
              username: u,
              hasUpload,
              hasLoginBtn,
              titleBadge,
              bodyLen: document.body.innerText.length,
            };
          });
        } catch {
          parsed = {};
        }
        const ready = (parsed.bodyLen ?? 0) > 150;
        const signal = parsed.hasLoginBtn || parsed.hasUpload || parsed.titleBadge;
        if (ready && signal) break;
      }

      username = parsed.username || '';
      valid = (parsed.hasUpload || parsed.titleBadge) && !parsed.hasLoginBtn;

      ctx.onProgress(100);

      if (valid) {
        message = `Cookie 有效，当前账号：@${username}`;
        ctx.logger('✅ ' + message);
      } else {
        message = parsed.hasLoginBtn
          ? 'Cookie 无效或已过期（页面仍显示登录按钮）'
          : '未检测到登录态（页面无头像/@账号链接）';
        ctx.logger('⚠️ ' + message);
      }
    } catch (e: any) {
      throw new Error(`账号验证失败：${e.message || e}`);
    } finally {
      // 进程内浏览器，用完即关
      try { await context?.close(); } catch {}
    }

    return {
      valid,
      username,
      region,
      cookie,
      cookieLength: String(cookie).length,
      message,
    };
  }
}

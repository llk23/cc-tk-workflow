import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

/**
 * TK 账号验证节点（Cookie 校验 · 走浏览器）
 *
 * 单一职责：校验用户粘贴的 TikTok 登录 Cookie 在当前地区是否有效。
 *  - 不做搜索 / 抓取 / 下载（那些属于「TK 视频抓取」等其他节点）。
 *
 * 为什么走浏览器（Web Access / CDP）而不是服务端直连？
 *  - 服务端 Node 进程在中国大陆直连 tiktok.com 会被墙（DNS/连接不可达），
 *    表现为 `fetch failed`。
 *  - 用户的日常浏览器带 VPN 出口，能正常访问 TikTok，且天然携带登录态。
 *  - 因此本节点通过 Web Access 的 CDP 代理（默认 http://localhost:3456）
 *    打开浏览器 → 注入 Cookie（含 httpOnly）→ 检测登录态，绕开网络限制。
 *
 * 前置：需先启动 Web Access（浏览器开远程调试），CDP 代理在 localhost:3456 监听。
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function cdpProxyUrl(): string {
  return (process.env.CDP_PROXY_URL || 'http://localhost:3456').replace(/\/+$/, '');
}

async function proxyFetch(path: string, init: RequestInit = {}, timeoutMs = 30000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(cdpProxyUrl() + path, { ...init, signal: ctrl.signal });
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { raw: text };
    }
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 将 "name=val; name2=val2" 解析为可注入 CDP 的 Cookie 对象数组 */
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
    description: '校验 TikTok 登录 Cookie 是否有效（走浏览器，免服务端直连被墙）',
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

    // 1) 创建后台 tab
    ctx.onProgress(15);
    let newRes: any;
    try {
      newRes = await proxyFetch('/new', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'about:blank',
      });
    } catch {
      throw new Error(
        'Web Access 浏览器未连接（localhost:3456 无响应）。请先启动浏览器远程调试，或运行 web-access 的前置检查。',
      );
    }
    const targetId = newRes?.targetId;
    if (!targetId) {
      throw new Error('创建浏览器 tab 失败：' + JSON.stringify(newRes));
    }

    let valid = false;
    let username = '';
    let message = '';
    try {
      // 2) 注入 Cookie（httpOnly，必须走 CDP）
      ctx.onProgress(35);
      const cookies = parseCookieString(cookie);
      const setRes = await proxyFetch(`/setCookie?target=${encodeURIComponent(targetId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies }),
      });
      const failed = (setRes?.results || []).filter((r: any) => !r.ok);
      if (failed.length) {
        ctx.logger(`⚠️ 部分 Cookie 注入失败：${failed.map((f: any) => f.name).join(', ')}`);
      } else {
        ctx.logger(`已注入 ${cookies.length} 个 Cookie`);
      }

      // 3) 打开 TikTok 首页（带 Cookie）
      ctx.onProgress(55);
      await proxyFetch(`/navigate?target=${encodeURIComponent(targetId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: baseUrl,
      });

      // 4) 轮询等待 SPA 渲染并检测登录态（TikTok 是重 SPA，头部渲染有延迟）
      ctx.onProgress(80);
      const expr = `(() => {
        const icon = document.querySelector('[data-e2e=profile-icon]');
        let u = '';
        if (icon) { let el = icon; while (el && el.tagName !== 'A') { el = el.parentElement; } if (el) u = el.getAttribute('href') || ''; }
        if (!u) { const a = document.querySelector('a[href^="/@"]'); if (a) u = a.getAttribute('href') || ''; }
        if (u.startsWith('/@')) u = u.slice(2).split('?')[0];
        const hasUpload = !!document.querySelector('[data-e2e=upload-icon], a[href="/upload"]');
        const hasLoginBtn = !!document.querySelector('[data-e2e=top-login-button], a[href*="/login"]');
        const titleBadge = /^\\([^)]+\\)/.test(document.title);
        return JSON.stringify({ username: u, hasUpload, hasLoginBtn, titleBadge, bodyLen: document.body.innerText.length });
      })()`;

      let parsed: any = {};
      for (let i = 0; i < 25; i++) {
        await sleep(1000);
        const evalRes = await proxyFetch(
          `/eval?target=${encodeURIComponent(targetId)}`,
          { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: expr },
          20000,
        );
        try {
          parsed = typeof evalRes?.value === 'string' ? JSON.parse(evalRes.value) : evalRes?.value || {};
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
    } finally {
      // 6) 关闭 tab，保持浏览器整洁
      try {
        await proxyFetch(`/close?target=${encodeURIComponent(targetId)}`, { method: 'GET' });
      } catch {
        /* 忽略关闭失败 */
      }
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

import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

/**
 * TK 视频抓取节点（Playwright 进程内版 · 替代原 CDP 方案）
 *
 * 与旧节点（fetch-tk / CDP Proxy）的关键区别：
 *  - 浏览器由本节点在进程内自行启动/关闭（chromium.launchPersistentContext），
 *    不再依赖外部 CDP Proxy (:3456) 和手动启动的 Chrome (:9222)。
 *  - 通过 page.on('response') 监听 TikTok 搜索 API 响应，等价于旧的 Network 捕获。
 *  - 功能与旧节点完全对齐：关键词搜索、排序、带货判定（siECVideo/commerceInfo/shoppingCart）、
 *    Cookie 注入、播放/点赞/时长/发布时间过滤、自动下载、相同输出格式。
 *
 * 注意：首次运行会使用本机 Chrome 通道（channel: 'chrome'），无需额外下载浏览器。
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** 从 TikTok 搜索 API 响应 item 提取视频（与原 cdp-proxy.mjs 提取逻辑一致） */
function extractVideosFromItems(items: any[]): any[] {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    const playAddr = item.video?.playAddr;
    const downloadAddr = item.video?.downloadAddr;
    const playUrl = typeof playAddr === 'string' ? playAddr : playAddr?.UrlList?.[0] || '';
    out.push({
      id: item.id,
      author: item.author?.uniqueId || item.author?.nickname || '',
      desc: item.desc || '',
      plays: parseInt(item.stats?.playCount || 0),
      likes: parseInt(item.stats?.diggCount || 0),
      comments: parseInt(item.stats?.commentCount || 0),
      duration: parseInt(item.video?.duration || 0),
      coverUrl: (item.video?.cover || '')?.substring(0, 200) || '',
      playUrl,
      downloadUrl:
        typeof downloadAddr === 'string'
          ? downloadAddr
          : downloadAddr?.UrlList?.[0] || playUrl,
      createTime: item.createTime || 0,
      isCommerce:
        !!(item.siECVideo === true || item.siECVideo === 1) ||
        !!(item.commerceInfo?.productInfo || item.commerceInfo?.productInfos?.length) ||
        !!(item.shoppingCart || item.shoppingCartItem),
      commerceSignal: {
        siECVideo: item.siECVideo === true || item.siECVideo === 1,
        hasCommerceInfo: !!(item.commerceInfo?.productInfo || item.commerceInfo?.productInfos?.length),
        hasShoppingCart: !!(item.shoppingCart || item.shoppingCartItem),
      },
    });
  }
  return out;
}

function parseCookieString(cookie: string) {
  return String(cookie)
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=');
      const name = idx > 0 ? pair.slice(0, idx).trim() : pair.trim();
      const value = idx > 0 ? pair.slice(idx + 1).trim() : '';
      return { name, value, domain: '.tiktok.com', path: '/', httpOnly: true, secure: true };
    });
}

export class FetchTKPlaywrightNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.FETCH_TK_PLAYWRIGHT,
    label: 'TK 视频抓取(浏览器自管)',
    description: 'Playwright 进程内浏览器抓取 TK 视频（无需外部 CDP 代理），支持精确带货判定',
    category: 'input',
    icon: '📥',
    inputs: [{ id: 'trigger', name: '触发信号', type: 'any', required: false }],
    outputs: [{ id: 'videos', name: '视频列表', type: 'any', required: true }],
    defaultConfig: {
      keyword: '',
      maxCount: 20,
      sortBy: 'relevance',
      minPlays: 0,
      minLikes: 0,
      region: 'US',
      commerceSource: 'all',
      commerceOnly: false,
      autoDownload: false,
      videoDuration: 'all',
      publishTime: 'all',
    },
  };

  async execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const {
      keyword,
      maxCount = 20,
      minPlays = 0,
      minLikes = 0,
      region = 'US',
      sortBy = 'relevance',
      commerceSource = 'all',
      commerceOnly = false,
      autoDownload = false,
      videoDuration = 'all',
      publishTime = 'all',
    } = config as any;

    if (!keyword || !String(keyword).trim()) {
      throw new Error('缺少搜索关键词（keyword），请在节点配置中填写。');
    }

    // 从上游节点获取 Cookie（由 TK 账号验证节点传入）
    const cookie = (input && typeof input === 'object')
      ? (() => {
          const values = Object.values(input as Record<string, any>);
          for (const v of values) {
            if (v && typeof v === 'object' && v.cookie) return String(v.cookie).trim();
          }
          return '';
        })()
      : '';

    ctx.logger(`[TK抓取·Playwright] 关键词="${keyword}" 最大${maxCount}条 地区=${region} 带货=${commerceOnly ? '仅带货' : '全部'}`);

    // ---- 进程内启动浏览器（方案 B 核心：不再依赖外部 CDP Proxy） ----
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    let videos: any[] = [];
    let totalOnPage = 0;
    let dataSource = '';

    try {
      ctx.onProgress(10);
      // 使用本机 Chrome（channel: 'chrome'），持久化上下文便于保留登录态
      const userDataDir = process.env.PLAYWRIGHT_USER_DATA_DIR || '.cache/playwright-tk';
      context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: process.env.TK_HEADLESS !== 'false',
        viewport: { width: 1280, height: 900 },
        userAgent: UA,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      });
      page = await context.newPage();
      ctx.logger('✅ 浏览器已在进程内启动（本机 Chrome）');

      // 反检测
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      // ---- Cookie 注入 ----
      if (cookie) {
        ctx.onProgress(20);
        const cookies = parseCookieString(cookie);
        if (cookies.length > 0) {
          await context.addCookies(cookies);
          ctx.logger(`已注入 ${cookies.length} 个 Cookie`);
        }
      } else {
        ctx.logger('⚠️ 未配置 Cookie，搜索可能受限');
      }

      // ---- 网络级捕获：监听 TikTok 搜索 API 响应（等价于旧 CDP startCapture） ----
      ctx.onProgress(30);
      const apiVideos: any[] = [];
      const capturedIds = new Set<string>();
      page.on('response', async (resp) => {
        const url = resp.url();
        if (!/\/api\/search\//.test(url)) return;
        try {
          const data = await resp.json();
          const itemSources = [
            data?.itemList || [],
            data?.item_list || [],
            data?.data?.itemList || [],
            data?.data?.item_list || [],
            data?.items || [],
            data?.data?.items || [],
            data?.itemModuleList || [],
            data?.item_module_list || [],
          ];
          if (data?.data && Array.isArray(data.data)) itemSources.push(data.data);
          if (data?.data?.items) itemSources.push(data.data.items);
          for (const items of itemSources) {
            if (!Array.isArray(items)) continue;
            for (const item of items) {
              if (!item?.id || capturedIds.has(item.id)) continue;
              capturedIds.add(item.id);
              apiVideos.push(item);
            }
          }
        } catch {
          /* JSON 解析失败忽略 */
        }
      });

      // ---- 导航到搜索页 ----
      ctx.onProgress(40);
      const searchUrl = `https://www.tiktok.com/search/video?q=${encodeURIComponent(keyword)}&lang=en&region=${region}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      ctx.logger(`已导航到搜索页：${searchUrl}`);

      // ---- 排序设置（非默认相关度） ----
      if (sortBy && sortBy !== 'relevance') {
        ctx.onProgress(48);
        const sortMap: Record<string, string> = { date: '1', likes: '2' };
        const sortVal = sortMap[sortBy];
        if (sortVal) {
          try {
            await page.waitForTimeout(2000);
            const clicked = await page.evaluate(() => {
              const sortBtn = document.querySelector(
                '[data-e2e*="sort"],[class*="sort"],[class*="Sort"]',
              ) as HTMLElement | null;
              if (!sortBtn) return false;
              sortBtn.click();
              return true;
            });
            ctx.logger(`排序方式=${sortBy} ${clicked ? '已点击排序按钮' : '未找到排序按钮'}`);
            await page.waitForTimeout(3000);
          } catch (e: any) {
            ctx.logger(`⚠️ 排序设置失败：${e.message}`);
          }
        }
      }

      // ---- 轮询等待搜索 API 响应或 DOM 渲染 ----
      ctx.onProgress(55);
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(1500);

        // 5a) 从监听的 API 响应提取（网络级捕获）
        if (apiVideos.length > 0) {
          videos = extractVideosFromItems(apiVideos);
          dataSource = 'network';
          totalOnPage = videos.length;
          ctx.logger(`第 ${i + 1} 次检测到 ${videos.length} 条视频（API 响应捕获）`);
          break;
        }

        // 5b) 兜底：DOM 提取
        if (i > 3) {
          try {
            const domResult = await page.evaluate((limit) => {
              const results: any[] = [];
              const seen = new Set<string>();
              const links = document.querySelectorAll('a[href*="/video/"][href*="/@"]');
              for (const a of links) {
                const href = a.getAttribute('href') || '';
                if (!href.includes('/video/') || seen.has(href)) continue;
                seen.add(href);
                if (results.length >= limit) break;
                const parts = href.match(/\/video\/(\d+)/);
                const authorMatch = href.match(/@([^/]+)/);
                const card = a.closest('[class*="DivItem"],[class*="divItem"],[data-e2e*="card"],li') || a;
                const descEl = card.querySelector('[data-e2e="video-desc"],[class*="desc"],[class*="title"]');
                const allText = card.textContent || '';
                const nums = [...allText.matchAll(/[\d,.]+[KMBkmb]?/g)].map((m) => {
                  const c = m[0].replace(/,/g, '');
                  const n = parseFloat(c);
                  return isNaN(n) ? 0 : /[Kk]/.test(m[0]) ? n * 1000 : /[Mm]/.test(m[0]) ? n * 1000000 : n;
                });
                results.push({
                  id: parts?.[1] || '',
                  author: authorMatch?.[1] || '',
                  description: descEl?.textContent?.trim() || '',
                  url: href.startsWith('http') ? href : 'https://www.tiktok.com' + href,
                  plays: nums[0] || 0,
                  likes: nums[1] || 0,
                  isCommerce: false,
                  commerceSignal: {},
                });
              }
              return { results: results.slice(0, limit), totalOnPage: seen.size };
            }, Math.min(maxCount, 50));
            if (domResult?.results?.length > 0 && videos.length === 0) {
              videos = domResult.results;
              dataSource = 'dom';
              totalOnPage = domResult.totalOnPage || videos.length;
              ctx.logger(`第 ${i + 1} 次检测到 ${videos.length} 条视频（DOM 兜底）`);
              break;
            }
          } catch {
            /* DOM 提取失败忽略 */
          }
        }

        if (i === 0) ctx.logger('等待搜索结果加载...');
      }

      ctx.onProgress(75);

      // ---- 过滤链（与旧节点一致） ----
      if (minPlays > 0 || minLikes > 0) {
        const before = videos.length;
        videos = videos.filter((v: any) => {
          if (minPlays > 0 && (v.plays || 0) < minPlays) return false;
          if (minLikes > 0 && (v.likes || 0) < minLikes) return false;
          return true;
        });
        ctx.logger(`播放量/点赞过滤：${before} → ${videos.length} 条`);
      }

      if (commerceSource && commerceSource !== 'all') {
        const before = videos.length;
        videos = videos.filter((v: any) => {
          const sig = v.commerceSignal || {};
          if (commerceSource === 'siECVideo') return sig.siECVideo === true;
          if (commerceSource === 'commerceInfo') return sig.hasCommerceInfo === true;
          if (commerceSource === 'shoppingCart') return sig.hasShoppingCart === true;
          return true;
        });
        if (before !== videos.length) ctx.logger(`带货来源过滤(${commerceSource})：${before} → ${videos.length} 条`);
      }

      if (commerceOnly) {
        const before = videos.length;
        videos = videos.filter((v: any) => v.isCommerce === true);
        ctx.logger(`带货过滤：${before} → ${videos.length} 条（仅保留带货视频）`);
      }

      if (videoDuration && videoDuration !== 'all') {
        const before = videos.length;
        videos = videos.filter((v: any) => {
          const dur = v.duration || 0;
          if (videoDuration === 'short') return dur > 0 && dur <= 30;
          if (videoDuration === 'medium') return dur > 30 && dur <= 60;
          if (videoDuration === 'long') return dur > 60;
          return true;
        });
        ctx.logger(`视频时长过滤(${videoDuration})：${before} → ${videos.length} 条`);
      }

      if (publishTime && publishTime !== 'all') {
        const now = Math.floor(Date.now() / 1000);
        const cutoff: Record<string, number> = {
          today: now - 86400,
          week: now - 86400 * 7,
          month: now - 86400 * 30,
        };
        const cutoffTs = cutoff[publishTime];
        if (cutoffTs) {
          const before = videos.length;
          videos = videos.filter((v: any) => (v.createTime || 0) >= cutoffTs);
          ctx.logger(`发布时间过滤(${publishTime})：${before} → ${videos.length} 条`);
        }
      }

      if (videos.length > maxCount) videos = videos.slice(0, maxCount);

      // ---- 自动下载 ----
      if (autoDownload && videos.length > 0) {
        ctx.onProgress(82);
        const fs = require('fs');
        const path = require('path');
        const cacheDir = path.join(process.cwd(), '.cache', 'videos');
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        let downloaded = 0;
        for (const v of videos) {
          const videoUrl = v.downloadUrl || v.playUrl || '';
          if (!videoUrl) continue;
          const videoId = v.id;
          const localPath = path.join(cacheDir, `${videoId}.mp4`);
          if (fs.existsSync(localPath)) {
            v.localPath = localPath;
            v.cacheHit = true;
            downloaded++;
            continue;
          }
          try {
            const resp = await fetch(videoUrl, {
              headers: { 'User-Agent': UA },
            });
            if (!resp.ok) continue;
            const buffer = Buffer.from(await resp.arrayBuffer());
            fs.writeFileSync(localPath, buffer);
            v.localPath = localPath;
            v.cacheHit = false;
            downloaded++;
            ctx.logger(`已下载视频 ${videoId} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
          } catch (e: any) {
            ctx.logger(`⚠️ 下载失败 ${videoId}: ${e.message}`);
          }
        }
        if (downloaded > 0) ctx.logger(`视频下载：成功 ${downloaded}/${videos.length} 个`);
      }

      ctx.onProgress(90);
      const commerceCount = videos.filter((v: any) => v.isCommerce).length;
      ctx.onProgress(100);

      ctx.logger(
        `✅ 抓取完成：共获取 ${videos.length} 个视频（数据源：${dataSource === 'network' ? 'API 响应捕获' : dataSource}）` +
          (commerceCount > 0 ? `，其中带货视频 ${commerceCount} 个` : ''),
      );
    } catch (e: any) {
      throw new Error(`抓取失败：${e.message || e}`);
    } finally {
      // 进程内浏览器，用完即关（不再需要 CDP 代理清理）
      try { await context?.close(); } catch {}
    }

    return {
      success: true,
      keyword,
      total: videos.length,
      totalOnPage,
      dataSource,
      commerceCount: videos.filter((v: any) => v.isCommerce).length,
      videos,
      config: { keyword, maxCount, region, minPlays, minLikes, commerceOnly, autoDownload },
      fetchedAt: new Date().toISOString(),
    };
  }
}

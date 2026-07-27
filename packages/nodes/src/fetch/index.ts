import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

/**
 * TK 视频抓取节点（走浏览器 · CDP 网络级捕获 + 精确带货判定）
 *
 * 通过 Web Access CDP Proxy（默认 http://localhost:3456）操作浏览器，
 * 导航至 TikTok 搜索页，使用 CDP Network 域拦截 TikTok 内部 API 响应，
 * 从原始 JSON 提取视频数据（含 siECVideo/commerceInfo/shoppingCart 等带货字段），
 * 不受 TikTok 自定义请求库对 window.fetch 的覆盖影响。
 *
 * 前置：Web Access 浏览器需开启远程调试，CDP 代理应在 localhost:3456 运行。
 */

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

export class FetchTKVideoNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.FETCH_TK,
    label: 'TK 视频抓取',
    description: '通过浏览器搜索 TK（CDP 网络级捕获），支持精确带货判定（siECVideo/commerceInfo/shoppingCart）',
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
    // engine 传递格式: { sourceNodeId: { cookie, valid, username, ... } }
    const cookie = (input && typeof input === 'object')
      ? (() => {
          const values = Object.values(input as Record<string, any>);
          for (const v of values) {
            if (v && typeof v === 'object' && v.cookie) return String(v.cookie).trim();
          }
          return '';
        })()
      : '';

    ctx.logger(`[TK视频抓取] 搜索关键词="${keyword}" 最大${maxCount}条 地区=${region} 带货=${commerceOnly ? '仅带货' : '全部'}`);

    const searchUrl = `https://www.tiktok.com/search/video?q=${encodeURIComponent(keyword)}&lang=en&region=${region}`;

    // 1) 创建后台 tab
    ctx.onProgress(10);
    let newRes: any;
    try {
      newRes = await proxyFetch('/new', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'about:blank',
      });
    } catch {
      throw new Error('Web Access 浏览器未连接（localhost:3456 无响应）。请先启动浏览器远程调试。');
    }
    const targetId = newRes?.targetId;
    if (!targetId) throw new Error('创建浏览器 tab 失败：' + JSON.stringify(newRes));

    let videos: any[] = [];
    let totalOnPage = 0;
    let dataSource = '';

    try {
      // 2) 注入 Cookie
      if (cookie) {
        ctx.onProgress(20);
        const cookies = parseCookieString(cookie);
        if (cookies.length > 0) {
          await proxyFetch(`/setCookie?target=${encodeURIComponent(targetId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies }),
          }).catch(() => ctx.logger('⚠️ Cookie 注入异常'));
          ctx.logger(`已注入 ${cookies.length} 个 Cookie（用于搜索）`);
        }
      } else {
        ctx.logger('⚠️ 未配置 Cookie，搜索可能受限');
      }

      // 3) 启动 CDP 网络级捕获（仅捕获 TikTok 搜索 API 的响应）
      ctx.onProgress(30);
      const capRes = await proxyFetch(`/startCapture?target=${encodeURIComponent(targetId)}&urlPattern=/api/search`, {
        method: 'POST',
      }, 10000).catch(() => ({}));
      if (capRes?.ok) {
        ctx.logger('已启动 CDP 网络级捕获（等待 TikTok 搜索 API 响应）');
      } else {
        ctx.logger('⚠️ 网络捕获启动失败，降级为 DOM 提取');
      }

      // 4) 导航到搜索页
      ctx.onProgress(40);
      await proxyFetch(`/navigate?target=${encodeURIComponent(targetId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: searchUrl,
      }).catch(() => {});
      ctx.logger(`已导航到搜索页：${searchUrl}`);

      // 4a) 排序设置（非默认相关度时，通过点击页面排序按钮切换）
      if (sortBy && sortBy !== 'relevance') {
        ctx.onProgress(48);
        const sortMap: Record<string, string> = { date: '1', likes: '2' };
        const sortVal = sortMap[sortBy];
        if (sortVal) {
          await sleep(2000);
          const sortJs = `
            (() => {
              try {
                const sortBtn = document.querySelector('[data-e2e*="sort"],[class*="sort"],[class*="Sort"]');
                if (!sortBtn) return 'no_sort_btn';
                sortBtn.click();
                return 'clicked_sort';
              } catch(e) { return 'error:'+e.message; }
            })()
          `;
          const sortResult = await proxyFetch(`/eval?target=${encodeURIComponent(targetId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: sortJs,
          }, 15000).catch(() => ({}));
          ctx.logger(`排序方式=${sortBy} ${sortResult?.value || ''}`);
          // 等待排序生效后的 API 调用
          await sleep(3000);
        }
      }

      // 5) 轮询等待 API 响应或 DOM 渲染
      ctx.onProgress(55);
      for (let i = 0; i < 20; i++) {
        await sleep(1500);

        // 5a) 优先从 CDP 网络捕获提取
        const capResult = await proxyFetch(`/getCapture?target=${encodeURIComponent(targetId)}`, {}, 15000)
          .catch(() => ({ captured: 0, extracted: [] }));
        const capItems = capResult?.extracted || [];
        if (capItems.length > 0) {
          videos = capItems;
          dataSource = 'network';
          totalOnPage = videos.length;
          ctx.logger(`第 ${i + 1} 次检测到 ${videos.length} 条视频（CDP 网络级捕获）`);
          break;
        }

        // 5b) 兜底：DOM 提取（无 API 字段，但可获取基本数据）
        if (i > 3) {
          const domResult = await proxyFetch(`/eval?target=${encodeURIComponent(targetId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: `(() => {
              const results = []; const seen = new Set();
              const links = document.querySelectorAll('a[href*="/video/"][href*="/@"]');
              for (const a of links) {
                const href = a.getAttribute('href') || '';
                if (!href.includes('/video/') || seen.has(href)) continue;
                seen.add(href);
                if (results.length >= ${Math.min(maxCount, 50)}) break;
                const parts = href.match(/\\/video\\/(\\d+)/);
                const authorMatch = href.match(/@([^\\/]+)/);
                const card = a.closest('[class*="DivItem"],[class*="divItem"],[data-e2e*="card"],li') || a;
                const descEl = card.querySelector('[data-e2e="video-desc"],[class*="desc"],[class*="title"]');
                const allText = card.textContent || '';
                const nums = [...allText.matchAll(/[\\d,.]+[KMBkmb]?/g)].map(m => { const c=m[0].replace(/,/g,''); const n=parseFloat(c); return isNaN(n)?0:/[Kk]/.test(m[0])?n*1000:/[Mm]/.test(m[0])?n*1000000:n; });
                results.push({ id: parts?.[1]||'', author: authorMatch?.[1]||'', description: descEl?.textContent?.trim()||'', url: href.startsWith('http')?href:'https://www.tiktok.com'+href, plays: nums[0]||0, likes: nums[1]||0, isCommerce: false, commerceSignal: {} });
              }
              return JSON.stringify({ results: results.slice(0,${Math.min(maxCount,50)}), totalOnPage: seen.size });
            })()`,
          }, 25000).catch(() => ({}));
          const domParsed = typeof domResult?.value === 'string' ? JSON.parse(domResult.value) : domResult?.value || {};
          if (domParsed?.results?.length > 0 && videos.length === 0) {
            videos = domParsed.results;
            dataSource = 'dom';
            totalOnPage = domParsed.totalOnPage || videos.length;
            ctx.logger(`第 ${i + 1} 次检测到 ${videos.length} 条视频（DOM 兜底）`);
            break;
          }
        }

        if (i === 0) ctx.logger('等待搜索结果加载...');
      }

      ctx.onProgress(75);

      // 6) 应用过滤
      if (minPlays > 0 || minLikes > 0) {
        const before = videos.length;
        videos = videos.filter((v: any) => {
          if (minPlays > 0 && (v.plays || 0) < minPlays) return false;
          if (minLikes > 0 && (v.likes || 0) < minLikes) return false;
          return true;
        });
        ctx.logger(`播放量/点赞过滤：${before} → ${videos.length} 条`);
      }

      // 6a) 带货来源过滤（commerceSource 控制用哪个信号判定带货）
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

      // 6b) 视频时长过滤
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

      // 6c) 发布时间过滤（基于 API 返回的 createTime 时间戳）
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
          videos = videos.filter((v: any) => {
            const ct = v.createTime || 0;
            return ct >= cutoffTs;
          });
          ctx.logger(`发布时间过滤(${publishTime})：${before} → ${videos.length} 条`);
        }
      }

      if (videos.length > maxCount) videos = videos.slice(0, maxCount);

      // 6b) 自动下载视频文件
      if (autoDownload && dataSource === 'network' && videos.length > 0) {
        ctx.onProgress(82);
        const fs = require('fs');
        const path = require('path');
        const cacheDir = path.join(process.cwd(), '.cache', 'videos');
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        const storageUrl = process.env.MINIO_ENDPOINT || '';
        let downloaded = 0;
        for (const v of videos) {
          // 获取视频下载链接（方式1: API 返回的 playAddr；方式2: 通过 TikTok 视频页提取）
          const videoUrl = v.downloadUrl || v.playUrl || '';
          if (!videoUrl) continue;
          const videoId = v.id;
          const ext = 'mp4';
          const localPath = path.join(cacheDir, `${videoId}.${ext}`);
          if (fs.existsSync(localPath)) {
            v.localPath = localPath;
            v.cacheHit = true;
            downloaded++;
            continue;
          }
          try {
            const resp = await fetch(videoUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            });
            if (!resp.ok) continue;
            const buffer = Buffer.from(await resp.arrayBuffer());
            fs.writeFileSync(localPath, buffer);
            v.localPath = localPath;
            v.cacheHit = false;
            downloaded++;
            ctx.logger(`已下载视频 ${videoId} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
            // 如果有 MinIO 则上传
            if (storageUrl) {
              try {
                const formData = new FormData();
                formData.append('file', new Blob([buffer]), `${videoId}.${ext}`);
                const upResp = await fetch(`${storageUrl}/videos/${videoId}.${ext}`, {
                  method: 'PUT', body: buffer,
                });
                if (upResp.ok) v.storageUrl = `${storageUrl}/videos/${videoId}.${ext}`;
              } catch {}
            }
          } catch (e: any) {
            ctx.logger(`⚠️ 下载失败 ${videoId}: ${e.message}`);
          }
        }
        if (downloaded > 0) ctx.logger(`视频下载：成功 ${downloaded}/${videos.length} 个`);
      }

      ctx.onProgress(90);

      const commerceCount = videos.filter((v: any) => v.isCommerce).length;
      ctx.onProgress(100);

      if (dataSource === 'network') {
        ctx.logger(`✅ 抓取完成：共获取 ${videos.length} 个视频（数据源：CDP 网络级捕获）` +
          (commerceCount > 0 ? `，其中带货视频 ${commerceCount} 个` : ''));
      } else {
        ctx.logger(`✅ 抓取完成：共获取 ${videos.length} 个视频（数据源：${dataSource}）`);
      }

    } finally {
      // 停止捕获 + 关闭 tab
      try { await proxyFetch(`/stopCapture?target=${encodeURIComponent(targetId)}`, {}, 5000).catch(() => {}); } catch {}
      try { await proxyFetch(`/close?target=${encodeURIComponent(targetId)}`, { method: 'GET' }, 5000).catch(() => {}); } catch {}
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

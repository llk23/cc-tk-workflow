# 如何开发新节点

## 基本步骤

1. 在 `packages/nodes/src/` 下创建目录，如 `my-node/`
2. 继承 `BaseNode` 抽象基类
3. 实现 `execute(config, input, ctx)` 方法
4. 定义 `static definition`（节点元数据）
5. 在 `packages/nodes/src/index.ts` 中导出并注册

## 节点定义（NodeDefinition）

```typescript
static definition: NodeDefinition = {
  type: 'my-custom-type' as NodeTypeEnum,  // 枚举值，须在 NodeTypeEnum 中定义
  label: '我的节点',                         // 前端显示名称
  description: '节点功能描述',               // 节点库 tooltip
  category: 'process',                      // 分组
  icon: '🔧',                               // 显示的 Emoji
  inputs: [{ id: 'in', name: '输入', type: 'any', required: true }],
  outputs: [{ id: 'out', name: '输出', type: 'any', required: true }],
  defaultConfig: { key: 'value' },          // 默认配置，前端自动读取
};
```

## 基础示例

```typescript
import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

export class MyNode extends BaseNode {
  static definition: NodeDefinition = {
    type: 'my-custom-type' as NodeTypeEnum,
    label: '我的节点',
    description: '描述',
    category: 'process',
    icon: '🔧',
    inputs: [{ id: 'in', name: '输入', type: 'any', required: true }],
    outputs: [{ id: 'out', name: '输出', type: 'any', required: true }],
    defaultConfig: { key: 'value' },
  };

  async execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    ctx.logger('开始执行自定义逻辑');
    ctx.onProgress(50);
    // ... 业务逻辑
    ctx.onProgress(100);
    return { result: 'success' };
  }
}
```

## 真实实现模式：FetchTKVideoNode

以下是在本项目中实际落地的关键模式，开发新节点时可以直接参考：

### 1. CDP 浏览器自动化模式

通过 Web Access CDP Proxy（默认 `http://localhost:3456`）操作 Chrome 浏览器，适用于需要 JS 渲染或模拟用户操作的场景。

```typescript
// 创建浏览器标签页
const newRes = await proxyFetch('/new', {
  method: 'POST',
  body: 'about:blank',
});
const targetId = newRes.targetId;

// 导航到目标页面
await proxyFetch(`/navigate?target=${targetId}`, {
  method: 'POST',
  body: 'https://example.com/search?q=keyword',
});

// 执行 JS 提取数据
const evalResult = await proxyFetch(`/eval?target=${targetId}`, {
  method: 'POST',
  body: `(() => { return document.title; })()`,
});

// 关闭标签页
await proxyFetch(`/close?target=${targetId}`);
```

### 2. CDP 网络级捕获（绕过 JS 请求覆盖）

有些网站（如 TikTok）自定义了 `window.fetch`，导致 JS 级别的网络拦截失效。CDP Network 域在协议层拦截，不受影响。

```typescript
// 步骤1：启动捕获（匹配 URL 模式）
await proxyFetch(`/startCapture?target=${targetId}&urlPattern=/api/search`, {
  method: 'POST',
});

// 步骤2：等待 API 响应
await sleep(5000); // 等待页面发出请求

// 步骤3：获取捕获结果
const capResult = await proxyFetch(`/getCapture?target=${targetId}`);
const items = capResult.extracted; // 解析后的 JSON 数据
```

**工作原理**：
- cdp-proxy.mjs 在 WebSocket 消息循环中监听 `Network.responseReceived` 和 `Network.loadingFinished`
- 过滤匹配 `urlPattern` 的请求
- 调用 `Network.getResponseBody` 获取原始响应体
- 自动解析 JSON 返回给调用方

### 3. Cookie 注入与上游节点数据传递

Cookie 由 TK 账号验证节点管理，抓取节点从上游自动获取：

```typescript
// 从上游节点获取 Cookie（统一由 input 传递）
const cookie = (input && typeof input === 'object')
  ? String((input as any).cookie || '').trim()
  : '';

// 注入到浏览器
if (cookie) {
  const cookies = parseCookieString(cookie);
  await proxyFetch(`/setCookie?target=${targetId}`, {
    method: 'POST',
    body: JSON.stringify({ cookies }),
  });
  ctx.logger(`已注入 ${cookies.length} 个 Cookie`);
}
```

### 4. 过滤链（Filter Chain）模式

抓取数据后用链式过滤处理：

```typescript
let videos = capResult.extracted || [];

// 播放量/点赞过滤
if (minPlays > 0 || minLikes > 0) {
  videos = videos.filter(v => {
    if (minPlays > 0 && (v.plays || 0) < minPlays) return false;
    if (minLikes > 0 && (v.likes || 0) < minLikes) return false;
    return true;
  });
}

// 带货来源过滤（精确信号）
if (commerceSource && commerceSource !== 'all') {
  videos = videos.filter(v => {
    const sig = v.commerceSignal || {};
    if (commerceSource === 'siECVideo') return sig.siECVideo === true;
    if (commerceSource === 'commerceInfo') return sig.hasCommerceInfo === true;
    if (commerceSource === 'shoppingCart') return sig.hasShoppingCart === true;
    return true;
  });
}

// 视频时长过滤（秒级）
if (videoDuration && videoDuration !== 'all') {
  videos = videos.filter(v => {
    const dur = v.duration || 0;
    if (videoDuration === 'short') return dur <= 30;
    if (videoDuration === 'medium') return dur > 30 && dur <= 60;
    if (videoDuration === 'long') return dur > 60;
    return true;
  });
}

// 发布时间过滤（时间戳）
if (publishTime && publishTime !== 'all') {
  const now = Math.floor(Date.now() / 1000);
  const cutoffs = { today: now - 86400, week: now - 86400 * 7, month: now - 86400 * 30 };
  const cutoff = cutoffs[publishTime];
  if (cutoff) {
    videos = videos.filter(v => (v.createTime || 0) >= cutoff);
  }
}

// 限数
if (videos.length > maxCount) videos = videos.slice(0, maxCount);
```

### 5. 文件下载缓存模式

```typescript
if (autoDownload && videos.length > 0) {
  const cacheDir = path.join(process.cwd(), '.cache', 'videos');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  for (const v of videos) {
    const videoUrl = v.downloadUrl || v.playUrl || '';
    if (!videoUrl) continue;
    const localPath = path.join(cacheDir, `${v.id}.mp4`);

    // 缓存命中直接跳过
    if (fs.existsSync(localPath)) {
      v.localPath = localPath;
      v.cacheHit = true;
      continue;
    }

    // 下载到本地
    const resp = await fetch(videoUrl);
    const buffer = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    v.localPath = localPath;
  }
}
```

## 前端集成

修改 `apps/web/src/views/WorkflowEditor.vue`：

1. **defaultConfig** — 在 `function defaultConfig(nodeType)` 中添加节点配置默认值
2. **FIELD_LABELS** — 添加配置字段的中文标签
3. **GROUPS_BY_TYPE** — 按逻辑分组配置字段（搜索参数/过滤条件/下载选项）
4. **模板** — 为特殊字段类型添加 `<select>` `<textarea>` 等自定义渲染
5. **画布节点** — 修改 `CustomNode.vue` 支持类型色彩编码

## 注册

在 `packages/nodes/src/index.ts` 的 `registerBuiltinNodes` 中添加一行即可：

```typescript
import { MyNode } from './my-node';

export function registerBuiltinNodes(executor: typeof NodeExecutor): void {
  const nodes = [
    new MyNode(),
    // ... 已有节点
  ];
}
```

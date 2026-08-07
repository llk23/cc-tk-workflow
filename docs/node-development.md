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

### 6. 外部 Agent 调用模式（WorkBuddyAgentAnalyzeNode）

通过 `execFile` 调起 WorkBuddy 自带 CLI（`codebuddy`，随 WorkBuddy 安装自带，无需下载），让 Agent 自主发现并使用项目内 skills 分析视频。参考实现：`packages/nodes/src/workbuddy-agent-analyze/index.ts`。

```typescript
import { execFile } from 'child_process';

// CLI 路径自动探测（留空即用默认）
const DEFAULT_CLI_CANDIDATES = [
  'D:/workbuddy/resources/app.asar.unpacked/cli/dist/codebuddy.js',  // node 脚本，用 node 执行
  'D:/workbuddy/resources/app.asar.unpacked/cli/bin/codebuddy',
];
const DEFAULT_NODE_CANDIDATES = [
  'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe',
  'C:/Program Files/nodejs/node.exe',
];

// 调起 CLI（注意参数顺序坑：--add-dir 会吞掉其后的所有参数，prompt 必须放前面）
const args = [
  cliPath,
  '-p',                        // 非交互，输出即退出
  '--output-format', 'json',   // 结构化返回
  '--permission-mode', 'bypassPermissions',  // acceptEdits 读不了外部视频路径
  taskPrompt,                  // ⚠️ prompt 必须在 --add-dir 之前
  '--add-dir', videoDir,
];
if (model) args.push('--model', model);

execFile(nodePath, args, { timeout: 300000, maxBuffer: 64 * 1024 * 1024, cwd: projectRoot }, (err, stdout) => {
  // cwd 必须是项目根：Agent 在此发现 .claude/skills/seedance-2.0-main
  // stdout 是 JSON 消息数组，取最后一条 type=result 的 result 字段为最终输出
});
```

**关键点（踩坑记录）**：
- `--add-dir` 会吞掉其后所有参数 → prompt 必须放在它之前
- 权限必须 `bypassPermissions`（`acceptEdits` 无法读取外部视频，Agent 会拒绝并遵循 SKILL.md「不得虚构观察」原则）
- CLI 与 WorkBuddy 桌面共享配置/模型网关/账号积分；换账号不影响 CLI 路径（路径由安装位置决定）
- `--model <id>` 可指定模型；不指定走 `auto` 网关自动路由
- 模型列表来源：CLI 安装目录 `product.json` 的 `models` 字段（后端 `POST /api/ai/workbuddy-models` 封装）

### 7. AI 分析节点模式（SeedanceAnalyzeNode）

即梦 Seedance 2.0 视频分析节点（`ai-analyze-seedance`），把本地 Skill 的完整指南注入 AI 模型 System Prompt，让模型输出**完整分析报告 + 可复刻的 Seedance 提示词**。参考实现：`packages/nodes/src/seedance-analyze/index.ts`。

#### 数据流

```
TK 视频 URL → yt-dlp 下载 → 优先 Ark Files 上传完整视频
                              └─ 失败回退 ffmpeg 抽帧(10帧)
→ AI 模型（System Prompt = seedance-prompt-zh 技能全文 + 输出要求）
→ rawOutput（Markdown 分析报告全文）
```

#### 技能加载模式（读文件而非"调用"Skill）

WorkBuddy Skill 无法在 Node.js 后端直接调用，但 Skill 本质是 Markdown 文件，运行时读取并注入 System Prompt 即可等效使用：

```typescript
private loadSkill(): string {
  // 候选路径（用户级 skills 目录 → 项目内嵌兜底）
  const candidates = [
    path.join(process.env.USERPROFILE || 'C:/Users/Administrator',
      '.workbuddy', 'skills', 'seedance-prompt-en', 'zh', 'SKILL.md'),
    // ...
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  }
  return '';
}
```

#### System Prompt 设计（⚠️ 重要踩坑）

**不要用 JSON schema 约束输出**。历史教训：早期版本要求模型按 `{visual:{...}, structure:{...}}` 固定结构输出，模型只会"填表"，产出极其简陋；改成自由报告后模型才会写出帧级拆解、技术参数、卖点提炼等完整内容。

正确做法（当前版本）：

```
你是即梦 Seedance 2.0 专业提示词工程师。分析这个视频，输出完整的视频分析报告
+ 可直接在 Seedance 2.0 中使用的复刻提示词。

## 工作指南
[seedance-prompt-zh SKILL.md 全文]

## 输出要求
### 第一部分：视频分析报告
1. 基本信息（时长/分辨率/帧率/音轨格式/水印/视频类型）
2. 帧级时间轴分镜拆解（精确到秒：画面内容/镜头运镜/音效对白）
3. 核心卖点提炼（3-5 条按重要性排序）
4. 视觉风格分析（色调/质感/氛围/剪辑节奏）
### 第二部分：Seedance 2.0 复刻提示词
@引用说明 / 分时段描述 / 主体场景运镜音频 / 生成参数建议

注意：输出不是 JSON，是一份可直接阅读的分析报告。写详细、写完整。
```

**不要设计评分体系**（qualityScore/hookRating 等被业务明确否决——不符合运营预期）。

#### 输出字段（最终版）

```typescript
// analyzeSingle 返回
{
  videoId,              // 视频 ID
  rawOutput,            // AI 完整分析报告（核心数据，Markdown 全文）
  analyzedAt,           // 分析时间
  modelUsed,            // 使用的模型
}
// execute 合并视频元数据
{
  author, description, plays, likes, comments, duration,
  coverUrl, isCommerce, hashtags,   // hashtags 来自抓取节点（原作者真实话题）
}
```

**已删除的死字段**：`qualityScore`、`hookRating`、`styleCategory`、`captionStructure`、`targetAudience`、`suggestions`、`generatedTags`。

**死字段成因**（避免重蹈覆辙）：System Prompt 从"JSON 结构化输出"改成"自由报告"后，代码里 `JSON.parse(raw)` 解析逻辑失效（模型不再返回 JSON），`parsed.xxx` 全部取不到 → 字段永远落默认值。改 System Prompt 时必须同步清理 return 字段。

#### hashtags 来源约定

标签不用 AI 生成（AI 猜的标签不准），改用**原作者真实发布的话题**，从抓取节点携带：

```typescript
// fetch/playwright.ts — API 路径（TikTok 响应的 challenges 字段）
hashtags: (item.challenges || []).map((c: any) => (c?.title || '').replace(/^#/, '')).filter(Boolean),
// fetch/playwright.ts — DOM 兜底路径（从描述提取 #tag）
hashtags: ((descEl?.textContent?.match(/#[\w]+/g) || []) as string[]).map(t => t.replace(/^#/, '')),
```

#### 视频上传 → 抽帧回退模式

完整视频优先上传 Ark Files API（模型能看全视频，分析更准）；上传失败自动回退 ffmpeg 抽帧（不阻塞主流程）：

```typescript
try {
  raw = await this.analyzeWithFullVideo(...);   // multipart 上传 + ark://fileId 引用
} catch (upErr) {
  ctx.logger(`⚠️ 视频上传不可用，回退到抽帧: ${upErr.message}`);
  raw = await this.analyzeWithFrames(...);      // ffmpeg fps=时长/10 抽 10 帧
}
```

已知限制：Ark Files API 目前报 `Purpose must be one of [use...]`（purpose 参数校验不通过），实际运行总是走抽帧回退。

#### 前端集成（Lv2 卡片 + Lv3 报告弹窗）

- **Lv2 卡片**（CustomNode.vue）：封面占位 + 作者 + ▶播放/❤点赞 + 描述摘要 + 前 3 个 hashtags 标签；点击卡片 → 打开报告弹窗（不再显示评分徽标）
- **Lv3 报告弹窗**（WorkflowEditor.vue）：可拖拽、可关闭，`<pre>` 原样铺开 `rawOutput` 全文（技术参数表、分镜表、卖点、复刻提示词）。不引入 Markdown 渲染库，纯文本展示
- 数据传递：`provide('openSeedanceReport', ...)` → 子组件 `inject` 调用
- 历史记录加载：按节点 `props.id` 精确匹配 `allResults[props.id]`，**不允许 fallback 抓取其他节点结果**（历史教训：宽松 fallback 会把 AI 分析节点的历史串到 SD 节点上）

#### 注册清单（新节点要改的全部位置）

1. `packages/types/src/index.ts` — `NodeTypeEnum` 加 `AI_ANALYZE_SEEDANCE`
2. `packages/nodes/src/index.ts` — 导出 + `registerBuiltinNodes` 注册
3. `apps/server/src/modules/workflow/workflow.service.ts` — `createNodeInstance` switch 加 case
4. `apps/web/src/views/WorkflowEditor.vue` — 节点库列表、iconMap、defaultConfig、GROUPS_BY_TYPE、report 弹窗 + provide
5. `apps/web/src/components/CustomNode.vue` — iconMap、边框色、展开按钮、Lv2 卡片

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

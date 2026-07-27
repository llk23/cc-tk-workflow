# TK 平台对接说明

## 当前方案：CDP 浏览器自动化（已实现）

这是本项目使用的正式方案，通过 Chrome DevTools Protocol (CDP) 模拟真实用户浏览器访问 TikTok。

### 架构

```
FetchTKVideoNode ──REST──→ CDP Proxy (localhost:3456) ──WebSocket──→ Chrome DevTools (localhost:9222)
```

- **CDP Proxy**: `scripts/cdp-proxy.mjs` — 封装 CDP 协议的高层 HTTP API
- **Chrome**: 需以 `--remote-debugging-port=9222` 启动

### CDP Proxy API 端点

| 方法 | 端点 | 用途 |
|------|------|------|
| POST | `/new` | 创建浏览器标签页，返回 targetId |
| POST | `/navigate?target=` | 导航到指定 URL |
| POST | `/eval?target=` | 在页面中执行 JavaScript，返回结果 |
| POST | `/setCookie?target=` | 注入多个 Cookie（支持 domain/path/secure 等参数） |
| POST | `/startCapture?target=&urlPattern=` | 启动 CDP Network 域捕获（匹配 URL 模式） |
| GET  | `/getCapture?target=` | 获取捕获的 API 响应 JSON |
| POST | `/stopCapture?target=` | 停止捕获 |
| GET  | `/close?target=` | 关闭标签页 |
| POST | `/addInitScript?target=` | 在页面加载前注入初始化脚本 |

### Cookie 流程

```
用户 → TK账号验证节点(5.1) 输入Cookie → 校验通过 → 输出cookie字段
   ↓
TK视频抓取节点(5.2) 从input.cookie读取 → 注入浏览器 → 带Cookie访问TK搜索页
```

Cookie 由 TK 账号验证节点统一管理，抓取节点**不直接配置**，从上游工作流自动获取。

### CDP 网络级带货判定（核心特性）

TikTok 使用自定义请求库覆盖 `window.fetch`，常规 JS 拦截无法捕获 API 响应。本项目在 CDP 协议层（Network 域）实现拦截：

1. 调用 `/startCapture?urlPattern=/api/search` 注册监听
2. CDP Proxy 在 WebSocket 消息循环中处理 `Network.responseReceived` 事件
3. 匹配 URL 时记录 `requestId`，等待 `Network.loadingFinished`
4. 通过 `Network.getResponseBody` 获取原始响应体
5. 从 TikTok API 的 JSON 响应 (`item_list`) 中提取：

| 带货信号 | 字段路径 | 说明 |
|---------|---------|------|
| siECVideo | `item_list[].itemModule.linkContext?.siECVideo` | TikTok 内部带货标记 |
| commerceInfo | `item_list[].itemModule.commerceInfo?.productInfo` | 商品信息结构 |
| shoppingCart | `item_list[].itemModule.shoppingCart` | 购物车数据 |

### 视频过滤条件（execute 内链式执行）

| 过滤条件 | 配置项 | 类型 |
|---------|--------|------|
| 播放量 | minPlays | number |
| 点赞量 | minLikes | number |
| 带货来源 | commerceSource | enum: all/siECVideo/commerceInfo/shoppingCart |
| 仅带货 | commerceOnly | boolean |
| 视频时长 | videoDuration | enum: all/short(≤30s)/medium(30~60s)/long(>60s) |
| 发布时间 | publishTime | enum: all/today(24h)/week(7d)/month(30d) |

### 视频下载缓存

启用 `autoDownload` 时，视频文件下载到 `{cwd}/.cache/videos/{videoId}.mp4`：
- 缓存命中直接复用（`cacheHit: true`）
- 可选 MinIO 对象存储上传（`MINIO_ENDPOINT` 环境变量）

## 后续可选方案（待开发）

| 类型 | 说明 | 认证方式 | 状态 |
|------|------|---------|------|
| TikAPI | 第三方 TK 数据 API | API Key | 🔜 待接入 |
| TikAnalytics | TK 分析网站 | Cookie/Token | 🔜 待接入 |

接入方式：在 `packages/nodes/src/fetch/` 下实现新的节点类，按实际 API 文档对接即可。

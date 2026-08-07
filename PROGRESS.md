# TK AI Video Pipeline — 开发进度跟踪

## 项目概况
TK 美区平台短视频 AI 工作流系统。核心管线：**自动抓取 TK 视频 → AI 多模态分析 → AI 视频生成**。

> 流程表按「基础设施 → 画布交互 → 节点功能 → 完善优化」四个大阶段组织，每个阶段下的细分项逐步推进。

---

## Phase 1: 项目框架搭建 ✅

| 模块 | 状态 | 说明 |
|------|------|------|
| `.claude/` 配置体系 | ✅ 完成 | CLAUDE.md + agents + skills + rules |
| `packages/types` 类型定义 | ✅ 完成 | workflow/node/video/pipeline 类型 |
| `packages/core` 工作流引擎 | ✅ 完成 | PipelineEngine + DAG + NodeExecutor + ContextStore |
| `packages/providers` AI Provider | ✅ 完成 | OpenAI(完成) + Claude(占位) + Ollama(占位) |
| `packages/nodes` 节点库 | ✅ 完成 | BaseNode + 6 个内置节点(占位逻辑) |
| `apps/server` NestJS 后端 | ✅ 完成 | 4 个模块(workflow/task/video/auth) |
| `apps/web` Vue 3 前端 | ✅ 完成 | 4 个视图 + Vue Flow 框架 + Pinia + API |
| `apps/cli` CLI 工具 | ✅ 完成 | commander 命令框架 |
| `docker/` 基础设施 | ✅ 完成 | docker-compose(Redis + SQL Server) |
| `docs/` 文档 | ✅ 完成 | 架构/生命周期/节点开发/TK接入 |

---

## Phase 2: 环境运行 & 链路验证 ✅

| 任务 | 状态 | 说明 |
|------|------|------|
| 安装 Redis | ✅ 完成 | winget 安装 Redis 3.0.504，服务已启动 |
| 启动 NestJS 后端 | ✅ 完成 | http://localhost:3000，0 errors |
| 启动 Vue 前端 | ✅ 完成 | http://localhost:5173，HTTP 200 |
| 创建默认工作流管线 | ✅ 完成 | 抓取→分析→生成 三步骤管线 |
| 执行管线 API | ✅ 完成 | 返回 executionId，queued 状态 |
| SQL Server 连接 | ✅ 已有 | MSSQLSERVER 服务运行中 |
| 前后端 API 通信 | ✅ 完成 | POST/GET 全链路正常 |

---

## Phase 3: 架构级补全（P0 基础设施）✅

> 不补齐则后续节点功能写完也无存储与执行载体，故排在最前。

| 任务 | 状态 | 说明 |
|------|------|------|
| 补对象存储层（MinIO + MongoDB） | ✅ 已完成 | docker-compose 增加 MinIO(S3 兼容) + MongoDB(存分析报告) |
| 异步执行改造（PipelineEngine → BullMQ Consumer） | ✅ 已完成 | API 只入队，Worker 后台真实驱动引擎，WebSocket 推真实进度 |
| 分析结果/生成结果落库 | ✅ 已完成 | 定义 TypeORM 实体 + MongoDB 写入，重启不丢数据 |

---

## Phase 4: 可视化画布交互 ✅

| 功能 | 状态 | 说明 |
|------|------|------|
| Vue Flow 画布（拖拽 + 连线） | ✅ 已实现 | 左侧节点库拖拽落点生成节点，输出口连线形成执行顺序 |
| 节点配置面板 | ✅ 已实现 | 点击节点右侧滑出面板，按节点类型渲染不同配置字段 |
| 工作流保存/加载 | ✅ 已实现 | 序列化 nodes+edges 调 API 创建/读取 |
| 运行按钮 + WebSocket 进度推送 | ✅ 已实现 | 点运行入队并连 WS 收进度，节点按运行状态变色 + 底部日志 |
| 节点删除 | ✅ 已实现 | 配置面板按钮 + 键盘 Delete/Backspace 连带连线一并删除 |
| 连线删除 | ✅ 已实现 | 点击边选中（红色高亮），Delete/Backspace 删除单条连线，支持撤销 |
| 撤销（Undo） | ✅ 已实现 | 维护变更快照栈，上限 50 步 |

---

## Phase 5: 工作流节点功能实现 🔥

> 画布基础做通后，逐个实现画布里每个业务节点的真实逻辑。
> 辅助配置节点：**AI 模型配置** ✅ — 自定义 API 地址/Key，自动拉取模型列表下拉选择（2026-07-21）

### 5.0 AI 模型配置节点 ✅ 已完成

| 子功能 | 状态 | 说明 |
|--------|------|------|
| 自定义 API 地址/Key | ✅ 完成 | 用户可填入 OpenAI 兼容接口的地址和密钥 |
| 自动拉取模型列表 | ✅ 完成 | 点击「获取模型列表」调用后端 /api/ai/models 代理接口，列出可选模型 |
| 模型选择下拉 | ✅ 完成 | 从拉取的模型列表中自行选择 |
| 输出对接分析节点 | ✅ 完成 | 输出 modelConfig 对象，AI 分析节点自动从上游读取 |

### 5.1 TK 账号验证节点 ✅ 已完成

> Cookie 在此节点配置，验证通过后自动传递给下游抓取节点。
> **实现原理（2026-08-06 更新）**：已从 CDP 外部代理方案迁移为 **Playwright 进程内浏览器**（`chromium.launchPersistentContext` + 本机 Chrome），不再依赖 CDP Proxy (:3456) / 手动启动的 Chrome (:9222)。

| 子功能 | 状态 | 说明 |
|--------|------|------|
| Cookie 登录校验 | ✅ 完成 | Playwright 进程内启动浏览器 → `context.addCookies()` 注入 Cookie（含 httpOnly）→ 打开 TikTok 首页 → `page.evaluate()` 轮询检测登录态（头像/@账号链接/上传按钮/登录按钮/标题角标） |
| Cookie 配置 | ✅ 完成 | Cookie 完整字符串在此节点配置面板填写，不出现在其他节点中 |
| 输出传递 | ✅ 完成 | 验证结果（含 cookie 字符串）自动沿工作流连线传给下游节点 |
| 浏览器生命周期 | ✅ 完成 | 用到才启动、用完即关；启动前清理 profile 残留锁文件 + 失败重试，多节点串行启动稳定 |

### 5.2 TK 视频抓取节点 ✅ 完成

> **实现原理（2026-08-06 更新）**：节点类型 `fetch-tk-playwright`，已从 CDP 外部代理方案迁移为 **Playwright 进程内浏览器**。
> - 旧方案（fetch-tk / CDP Proxy）：依赖外部 `localhost:3456` 代理 + 手动启动的 Chrome `:9222`，重启电脑后环境丢失即报"浏览器未连接"。
> - 新方案：`launchPersistentContext` 进程内自管浏览器（channel: chrome / headless / 独立 userDataDir `.cache/playwright-tk`），用完即关，无外部进程依赖。

| 子功能 | 状态 | 说明 |
|--------|------|------|
| Playwright 进程内浏览器搜索 + 数据提取 | ✅ 完成 | 进程内启动浏览器 → 导航至 TikTok 搜索页 → `page.on('response')` 监听搜索 API + DOM 兜底两级提取视频信息 |
| API 网络级带货判定 | ✅ 完成 | 监听 TikTok `/api/search/` 响应，读取 siECVideo/commerceInfo/shoppingCart 字段（等价原 CDP Network 域捕获） |
| Cookie 从上游验证节点自动传递 | ✅ 完成 | cookie 不出现在本节点配置中，由 5.1 账号验证节点输出自动流入；兼容平铺 `{cookie}` 与嵌套 `{sourceId:{cookie}}` 两种上游格式 |
| 配置面板下拉选项 | ✅ 完成 | 排序方式/地区/带货来源改为直观的 `<select>` 下拉框 |
| 排序/带货来源字段逻辑落地 | ✅ 完成 | sortBy 走页面点击排序按钮切换；commerceSource 信号过滤已实现 |
| 视频下载缓存（autoDownload） | ✅ 完成 | 下载至 `.cache/videos/`，支持本地缓存 + MinIO 上传 |
| 视频时长筛选（videoDuration） | ✅ 完成 | 短(≤30s)/中(30~60s)/长(>60s) 下拉选择 |
| 发布时间筛选（publishTime） | ✅ 完成 | 近24h/近7天/近30天 下拉选择（基于 API createTime，新方案已补齐该字段） |

### 5.3 AI 视频分析节点 🔥 开发中

| 子功能 | 状态 | 说明 |
|--------|------|------|
| 两种分析模式配置 | ✅ 完成 | metadata(元数据分析)/video(全视频分析) 下拉选择 |
| 元数据分析（metadata） | ✅ 完成 | 基于视频元数据调用 AI 做文本分析，无需下载视频 |
| 全视频分析（video） | ✅ 完成 | 下载视频 → 通过 File API 上传给模型 → AI 返回六层结构化分析报告 |
| 视频分析系统提示词 | ✅ 完成 | 覆盖视觉/结构/音频/文案/爆款归因/复刻蓝图六层维度 |
| 模型配置 | ✅ 完成 | 从上游 model-config 节点读取 |

### 5.3.1 WorkBuddy Agent 分析节点 🎯 最小验证完成

> 独立于 5.3 的全新分析节点：不经过 sd 节点的输出约束，直接调起 **WorkBuddy 自带 CLI（codebuddy）**，让 Agent 自主发现并使用项目内 `seedance-2.0-main` 技能体系分析视频。

| 子功能 | 状态 | 说明 |
|--------|------|------|
| 节点实现 | ✅ 完成 | `packages/nodes/src/workbuddy-agent-analyze/index.ts`（类型 `ai-analyze-workbuddy-agent`） |
| CLI 通路验证 | ✅ 完成 | 实测：Agent 自主发现 3 个 skills、加载子技能知识、5分26秒输出 2.1MB 完整分析 + 5 段中英双语复刻提示词 |
| CLI 参数自动探测 | ✅ 完成 | `cliPath`/`nodePath` 内置候选路径自动探测，留空即用，无需手动填写 |
| 权限模式 | ✅ 完成 | `permissionMode` 可配置，默认 `bypassPermissions`（acceptEdits 无法读取外部视频，Agent 会拒绝并遵循 SKILL.md"不得虚构观察"原则） |
| 模型自主选择 | ✅ 完成 | 后端 `POST /api/ai/workbuddy-models` 读取 CLI `product.json` 返回 44 个可用模型（含积分倍率/图片/工具能力标记）；前端「🔍 探测可用模型」按钮 + 下拉（首项 Auto） |
| 刷新不丢配置 | ✅ 完成 | ① 下拉兜底显示已保存模型「⭐ xxx（已保存）」；② 选中节点自动探测模型列表；③ 刷新后自动恢复上次工作流（localStorage `tk_wf_last_open`） |
| 防抖自动保存 | ✅ 完成 | 配置修改 800ms 后静默同步后端，失败走本地兜底（已在 5.3.1 中启用） |
| 输出约束 | ⬜ 待细化 | 当前不约束输出结构与内容，Agent 返回什么存什么（rawOutput 原样），待后续按需求细分节点功能 |

**CLI 关键参数坑（已踩坑记录）**：
- `--add-dir` 会吞掉其后的所有参数 → prompt 必须放在 `--add-dir` 之前
- 非交互分析必须 `--permission-mode bypassPermissions`（`acceptEdits` 读不了外部路径）
- CLI 与 WorkBuddy 桌面共享配置（`~/.workbuddy/settings.json`）、同一模型网关（127.0.0.1:15721）、同一账号积分；CLI 路径随安装位置固定，换账号不影响

### 5.3.2 即梦 SD2.0 分析节点（ai-analyze-seedance）✅ 开发完成

> 独立于 5.3 的专用分析节点：加载 seedance-prompt-zh 技能全文注入 AI 模型 System Prompt，输出完整分析报告 + 可直接复制的 Seedance 2.0 复刻提示词。

| 子功能 | 状态 | 说明 |
|--------|------|------|
| 节点实现 | ✅ 完成 | `packages/nodes/src/seedance-analyze/index.ts`（类型 `ai-analyze-seedance`） |
| 技能加载 | ✅ 完成 | 运行时读取 `~/.workbuddy/skills/seedance-prompt-en/zh/SKILL.md`（18445 字符）注入 System Prompt，等效直接使用 Skill |
| 视频输入 | ✅ 完成 | yt-dlp 下载 → 优先 Ark Files 上传完整视频，失败自动回退 ffmpeg 抽帧 10 帧 |
| 输出内容 | ✅ 完成 | 自由报告（非 JSON）：基本信息 + 帧级时间轴分镜 + 核心卖点 + 视觉风格 + Seedance 复刻提示词 |
| 输出字段 | ✅ 完成 | videoId / rawOutput / analyzedAt / modelUsed + 元数据（author/描述/播放点赞/时长/封面/带货/hashtags） |
| hashtags 来源 | ✅ 完成 | 从抓取节点携带原作者真实话题（API challenges 字段 / DOM 描述提取），不用 AI 生成 |
| 前端 Lv2 卡片 | ✅ 完成 | 封面 + 作者 + 播放/点赞 + 描述摘要 + 前 3 标签；无评分徽标；点击进报告 |
| 前端 Lv3 报告弹窗 | ✅ 完成 | 可拖拽可关闭，`<pre>` 原样铺开 rawOutput 全文（技术参数表/分镜表/卖点/提示词） |
| 历史记录隔离 | ✅ 完成 | 按节点 `props.id` 精确匹配执行历史，杜绝不同节点历史串扰 |
| 注册全链路 | ✅ 完成 | types 枚举 + nodes 注册 + server createNodeInstance + WorkflowEditor + CustomNode 五处 |

**设计决策记录（踩坑沉淀）**：
- ⚠️ **System Prompt 禁用 JSON schema 约束**：早期要求模型按固定 JSON 结构输出，模型只会"填表"产出简陋；改为自由报告后才会写出帧级拆解/技术参数/卖点提炼。参考 `docs/node-development.md` §7
- ⚠️ **无评分体系**：qualityScore/hookRating 被业务明确否决（不符合运营预期）
- 死字段清理：styleCategory / captionStructure / targetAudience / suggestions / generatedTags（JSON 改自由报告后的残留，全部删除）
- 已知限制：Ark Files 上传 `purpose` 参数校验失败（`Purpose must be one of [use...]`），实际运行走抽帧回退，不影响分析质量

### 5.3.3 节点架构重构：能力拆分（Agent 配置 / Skill 选择 / 视频分析）✅ 开发完成

> 针对 5.3.2 的反思：sd 节点把"配置+技能+分析"耦合在一起，违背节点职责单一。重构为三个独立可复用节点，**sd 节点已删除**（skill 节点选 seedance-2.0-main 完全替代）。

| 节点 | 改动 | 说明 |
|------|------|------|
| 模型配置（model-config） | 扩展 | 新增 Agent 配置：cliPath/nodePath/permissionMode/workingDir + **agentModel**（CLI 网关模型，与直调 model 分离）；条件校验（OpenAI 三件套或 Agent CLI 至少满足其一） |
| Skill 配置（skill-config） | 新增 | 后端 `POST /api/ai/skills` 扫描 `.claude/skills/`（兼容目录型 SKILL.md + 单文件型 .md，31 个 skill），前端下拉选择，输出 `{name, path, content, description}` |
| 视频分析（workbuddy-agent） | 改造 | 移除全部配置，只留**分析要求模板**（textarea 可编辑）；CLI/Node/模型/权限/目录从上游 `modelConfig` 读，skill 内容从上游 `skill` 对象读并注入 prompt |
| sd 节点（ai-analyze-seedance） | **删除** | 类型枚举/源码/注册/createNodeInstance/前端节点库/工作流关联全清（源码已备份为 `seedance-analyze_bak_*`） |

**关键工程决策（踩坑）**：
- ⚠️ **引擎多上游合并改造**：`collectNodeInput` / `executeUpstreamNodes` 对 model-config 与 skill-config 输出**保留对象结构**（`merged.modelConfig` / `merged.skill`），其余仍平铺——否则下游读不到 `inputObj.modelConfig` 对象
- ⚠️ **两套模型体系分离**：OpenAI 直调模型（doubao-seed-2-0-pro 等）与 WorkBuddy CLI 网关模型（deepseek-v4-flash 等）完全不同，不能共用一个 `model` 字段 → 新增独立 `agentModel` 字段（踩坑：曾复用 model 导致 CLI 报 `model service info not found`）
- 删除动作放最后：重构期间 sd 节点保留作对照与回退，wb-demo 新链路验证通过后才删除

**验证结果**（wb-demo 新链路 model-config → skill-config → workbuddy-agent）：
- 2 视频分析成功，skillUsed=seedance-20（skill 内容注入生效）、modelUsed=deepseek-v4-flash（agentModel 生效）
- 产出 1.2~3.7MB 完整 Markdown 分析报告（画面规格/品牌/卖点/Seedance 复刻提示词）
- 历史记录展开正常

### 5.4 AI 视频生成节点 ⬜ 待开发

| 子功能 | 状态 | 说明 |
|--------|------|------|
| 确定视频生成工具 | ⬜ 待开始 | Runway / Pika / Kling / 可灵 |
| 接入生成 API | ⬜ 待开始 | 替换 generate 节点占位逻辑 |
| 生成 5 步流水线 | ⬜ 待开始 | 脚本撰写 → 画面素材匹配/AI 视频 → AI 配音 → BGM 搭配 → FFmpeg 合成 |
| 成片质量检查（Quality Gate） | ⬜ 待开始 | 生成后自动质检，不达标打回重生成 |

### 5.5 辅助节点（条件判断 / 数据转换 / 结果输出）🔥 开发中

| 节点 | 状态 | 说明 |
|------|------|------|
| 结果输出 | ✅ 已有壳子 | 占位，无输出逻辑 |
| 条件判断 | ✅ 完成 | 按 duration/plays/likes/comments/shares 等字段做比较筛选，字段选项根据上游节点类型动态生成；输出符合条件视频数组 + filtered 统计 |
| 数据转换 | ⬜ 未实现 | 占位，无逻辑 |

---

## Phase 6: 完善与可观测性 ⬜

| 任务 | 状态 | 说明 |
|------|------|------|
| 可观测性（Prometheus/Grafana） | ⬜ 待开始 | 指标采集 + 仪表盘，监控管线吞吐/失败率/各环节耗时 |
| 成本监控 | ⬜ 待开始 | 按视频追踪 AI/代理/存储调用成本，超阈值告警 |
| 质量卡点 + 人工审核（3 道门） | ⬜ 待开始 | 脚本/画面/成片三道审核门，支持人工确认后再进入下一环节 |

---

## 技术债务 / 待优化

- [x] TypeORM + SQL Server 实体定义（Phase 3 已完成）
- [x] BullMQ 任务队列集成（Phase 3 已完成）
- [x] WebSocket 实时通信（Phase 3 已实现真实进度推送）
- [ ] 用户认证（JWT）
- [ ] 错误日志系统
- [ ] 单元测试覆盖
- [ ] API 参数校验（ValidationPipe）
- [ ] 多账号并发调度与限流
- [ ] 成本计量与告警

---

## 修改日志

| 日期 | 修改内容 | 备注 |
|------|---------|------|
| 2026-07-07 | 项目框架搭建完成，80 个文件，全链路编译通过 | Phase 1 ✅ |
| 2026-07-07 | 安装 Redis + 启动后端/前端 + API 全链路验证通过 | Phase 2 ✅ |
| 2026-07-10 | Phase 3 架构级补全：StorageModule + BullMQ Worker + 落库 | Phase 3 ✅ |
| 2026-07-13 | Phase 3 优化价值澄清文档 | 实务说明 |
| 2026-07-21 | AI 模型配置节点开发（model-config） | 5.0 ✅ |
| 2026-07-21 | 条件判断节点改造（按 duration/plays/likes 筛选视频）+ AI 分析节点三种模式（metadata/frames/full）+ 元数据分析模式实现 | 5.5 条件 ✅ / 5.3 部分 ✅ |
| 2026-07-21 | 画布连线选中高亮 + 删除功能 | Phase 4 ✅ |
| 2026-07-21 | AI 分析节点去自身配置，纯从上游 model-config 读取模型 | 5.3 精简 |
| 2026-07-21 | 条件节点字段选项根据上游节点类型动态生成 | 5.5 条件 ✅ |
| 2026-07-21 | 调试功能增强：递归执行上游节点获取真实输入数据 | 基础设施优化 |
| 2026-07-21 | 前端 API 超时 10s → 120s，适配 CDP 长时操作 | 基础设施优化 |
| 2026-07-22 | AI 分析节点 metadata 模式打通真实 API 调用链路 | 5.3 ✅ |
| 2026-07-22 | 全视频分析（video）模式实现：File API 上传 → 六层结构化分析输出（视觉/结构/音频/文案/爆款归因/复刻蓝图） | 5.3 ✅ |
| 2026-07-22 | 去掉 frames/抽帧模式，精简为 metadata + video 双模式 | 5.3 重构 |
| 2026-07-22 | 视频检测功能全部回滚移除 | 清理 |
| 2026-08-05 | 新建 WorkBuddy Agent 分析节点（ai-analyze-workbuddy-agent）：调起 codebuddy CLI，Agent 自主使用 seedance-2.0-main 技能分析视频；CLI 完整链路实测通过（5分26秒/2.1MB输出，含5段中英双语复刻提示词） | 5.3.1 ✅ |
| 2026-08-05 | WorkBuddy 模型探测：后端 POST /api/ai/workbuddy-models（读 CLI product.json，44 个模型）+ 前端「探测可用模型」按钮/下拉/分组 | 5.3.1 ✅ |
| 2026-08-05 | 前端防抖自动保存（nodes 变化 800ms 后静默同步后端，失败本地兜底） | 基础设施优化 |
| 2026-08-05 | 修复"刷新后模型选择不显示"：下拉兜底已保存值 + 选中节点自动探测模型 + 刷新自动恢复上次工作流（localStorage tk_wf_last_open） | 5.3.1 ✅ |
| 2026-08-06 | 新建即梦 SD2.0 分析节点（ai-analyze-seedance）：技能全文注入 System Prompt、自由报告输出（非 JSON 约束）、无评分体系、字段精简（删 5 死字段）、hashtags 从抓取节点携带、前端 Lv2 卡片无评分 + Lv3 报告全文弹窗、历史记录按 props.id 精确隔离 | 5.3.2 ✅ |
| 2026-08-06 | **TK 账号验证 + TK 视频抓取两节点迁移为 Playwright 进程内浏览器**：移除 CDP Proxy(:3456)/外部 Chrome(:9222) 依赖，根治"浏览器未连接"；旧 fetch-tk(CDP版) 全部删除（源码/类型/注册/前端/工作流关联）；网络捕获改 `page.on('response')` 监听；补齐 createTime 字段（发布时间筛选）；启动前清锁+重试防串行冲突；cookie 兼容平铺/嵌套两种上游格式 | 5.1 ✅ / 5.2 ✅ |
| 2026-08-06 | **节点架构重构（能力拆分）**：①后端 `POST /api/ai/skills` 扫描 .claude/skills（兼容目录型+单文件型，31 个）；②引擎多上游合并对 modelConfig/skill 保留对象结构；③新增 skill-config 节点（下拉选 skill 输出内容）；④model-config 扩展 Agent 配置（cliPath/nodePath/permissionMode/workingDir + agentModel 独立字段，条件校验）；⑤workbuddy-agent 瘦身为纯分析模板节点（配置读上游）；⑥**删除 sd 节点**（ai-analyze-seedance 全清）；wb-demo 新链路验证通过（model-config→skill→workbuddy 产出 1.2~3.7MB 完整报告） | 5.3.3 ✅ |
| 2026-08-07 | **sd 节点恢复 + workbuddy 改名**：用户保留 sd 节点（其自由报告 System Prompt 已调完善，比"抽帧+JSON打分"的 ai-analyze 更符合多模态分析预期）——从备份 seedance-analyze_bak_121743 还原目录并注册回 types/nodes/server/前端；workbuddy 节点 label 改为「Agent 分析」；前端节点库名称同步（AI 多模态模型分析 / Agent 分析）；补回 wb-demo 丢失的 model-config→workbuddy 连线；双节点验证通过（sd: doubao 直调 2/2 成功；agent: deepseek-v4-flash + seedance-20 skill 2/2 成功） | 5.3.2 恢复 / 5.3.3 调整 |
| 2026-08-07 | **历史加载性能根治（13.8s → 97ms）**：根因链=后端 history 全量读 result（最大 17.6MB 巨型报告字段）→ 13.8s → 前端 axios 10s 超时必失败 → 历史永远空白。修复：①前端全部 history/单条请求 timeout 提到 40s；②后端 getExecutionHistory 改原生 SQL `SUBSTRING(CONVERT(nvarchar(max), result),1,500000)` 在 DB 层截断大字段，巨型记录标记 `_truncatedRecord` 只返元数据；③前端巨型批次占位"点击加载…"，展开时按需调 `GET :id/history/:execId`（5MB 825ms）；④乱码修复：弹窗 workbuddyReportText 解析失败显示友好提示、Records.vue renderRaw 对 CLI JSON 消息流提取 type=result 正文而非格式化整个数组。另清理 wb-demo 重复的孤立 workbuddy 节点、补回 model-config→sd 连线（注：model-config→sd 不连线是用户故意停用，已还原用户意图） | 性能修复 ✅ |

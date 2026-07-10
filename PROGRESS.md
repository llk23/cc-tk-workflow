# TK AI Video Pipeline — 开发进度跟踪

## 项目概况
TK 美区平台短视频 AI 工作流系统。核心管线：**自动抓取 TK 视频 → AI 多模态分析 → AI 视频生成**。

> 说明：2026-07-08 对照 WB（WorkBuddy）架构方案补齐缺口，新增 Phase 3（架构级补全）并将原 Phase 3-6 顺延为 Phase 4-7。所有由 WB 补充的条目均在「说明」列以 `【wb添加】` 标注，原流程表既有条目保持不变。

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

## Phase 3: 架构级补全（P0 基础设施）【wb添加】

> 以下为 WB 对照上一轮架构方案识别出的架构级前置缺口。不补齐，后续分析/生成写完也无存储与执行载体，故排在所有业务对接之前。

| 任务 | 状态 | 说明 |
|------|------|------|
| 补对象存储层（MinIO + MongoDB） | ✅ 已完成 | 【wb添加】docker-compose 增加 MinIO(S3 兼容，存原始/生成视频、音频、抽帧) + MongoDB(存分析报告/生成指令)；SQL Server 只存元数据，二进制不再塞 FILESTREAM <!-- 大白话：现在 docker 里只有 Redis(内存缓存) 和 SQL Server(表格库)。视频、音频、抽帧图都是"大文件"，塞进 SQL 表格又慢又占地方。MinIO 就是你的"私有云盘/S3"，专门放大文件，存完给个链接就能随时下载给 AI 分析或合成；MongoDB 是另一个库，专门存"结构不固定的大坨分析结果"(比如某视频的画面标签、节奏、钩子句、生成指令)，这种嵌套 JSON 用 Mongo 比用 SQL 表格方便。例子：抓到爆款视频→文件存 MinIO 拿到链接→AI 分析完的详细报告(JSON)存 Mongo→SQL Server 只记一条"元数据"(名字/链接/谁抓的/分析ID)。 --> |
| 异步执行改造（PipelineEngine → BullMQ Consumer） | ✅ 已完成 | 【wb添加】API 只入队，真实调用引擎在 worker 中执行；解决 workflow.service 返回假 queued、引擎 for 循环同步阻塞卡死 API 的问题 <!-- 大白话：现在点"执行"后代码是"一条线挨个等"地跑(同步)，而且后端直接返回"已排队"但其实啥也没干(假排队)。视频抓取/AI 分析动辄几分钟，同步跑会把网页服务器卡死，别人访问就转圈。BullMQ 是个"任务排队叫号系统"：前端一点执行就往队列塞一张"任务单"，马上返回"收到，排队中"；后台另有"工人(worker)"专门从队列取任务慢慢干，干完通知前端。这样网站不卡，还能多个工人同时处理多个账号。例子：点"跑 10 个账号分析"→API 只把 10 张任务单丢进 Redis 队列(毫秒返回)→后台 worker 一个一个(或几个并排)取出来真跑→跑完写库，前端通过 WebSocket 看进度。 --> |
| 分析结果/生成结果落库 | ✅ 已完成 | 【wb添加】定义 TypeORM 实体 + MongoDB 写入，替换 workflow.service 内存 Map 与仅存 Redis 的 context，重启不丢数据 <!-- 大白话：现在工作流和结果存在"内存"里(程序一关就没)，引擎中间数据只丢在 Redis(重启可能丢)。等于你分析完的视频报告，服务器一重启全没了。落库就是把这些结果老老实实写进数据库(SQL Server 记元数据，Mongo 记详细报告)，下次打开还在。例子：分析完 100 个视频→100 份报告写进 Mongo→关掉服务明天再开→报告还在，能直接拿去生成视频，不用重新分析。 --> |

---

> **2026-07-10 更新（WB 实现）**：Phase 3 三项已全部落地 —— ① **对象存储**：新增 `StorageModule`（`MinioStorageService` 实现 + 未配 `MINIO_ENDPOINT` 时自动回退本地磁盘），`docker-compose.yml` 增加 `minio`/`mongodb` 服务；② **异步执行**：新增 `WorkflowConsumer`(BullMQ Worker) 真实驱动 `PipelineEngine`，每节点开始/完成通过 `WorkflowGateway` 推送**真实** WS 进度（替换原模拟循环）；③ **落库**：`WorkflowService` 改用 TypeORM(SQL Server) 存工作流/执行/分析/生成元数据 + MongoDB 存结构化分析报告，`execute()` 改为入队返回 `queued`。**注意**：节点业务逻辑(fetch/analyze/generate)仍为占位(mock)，待 Phase 4/5/6 写实；运行时需 `docker-compose up` 起 redis + sqlserver + minio + mongodb。

---

## Phase 4: 对接真实数据源

| 任务 | 状态 | 说明 |
|------|------|------|
| 确定 TK 数据源方案 | ⬜ 待开始 | TikAPI / TikAnalytics / 其他 |
| 接入抓取 API | ⬜ 待开始 | 替换 fetch 节点占位逻辑 |
| 实现视频下载缓存 | ⬜ 待开始 | 本地文件管理 |
| 住宅代理 + 反检测策略 | ⬜ 待开始 | 【wb添加】住宅代理池 + 签名算法(Argus/Khronos/Gorgon) + UA/设备指纹轮换 + 频率控制，解决从国内抓美区被风控 |
| 多账号批量监控 + FastMoss 接入 | ⬜ 待开始 | 【wb添加】账号列表/标签批量抓取、定时调度、FastMoss 热门标签与账号数据集成 |

---

## Phase 5: 接入 AI 模型

| 任务 | 状态 | 说明 |
|------|------|------|
| 配置 AI API Key | ⬜ 待开始 | OpenAI / Claude |
| 多模态视频分析调通 | ⬜ 待开始 | 替换 analyze 节点占位逻辑 |
| 分析结果结构化输出 | ⬜ 待开始 | 确保返回可用格式 |
| Provider 抽象补全（vision/transcription/bgm） | ⬜ 待开始 | 【wb添加】AIProvider 接口增加 vision()/transcribe()/recognizeBGM() 方法，接 Whisper/ACRCloud，不再只有 chat/analyze |
| 结构化分析 Schema 定义 | ⬜ 待开始 | 【wb添加】定义 visual/pacing/script/bgm/viral_elements/generation_prompt 嵌套 JSON，可直接喂给生成模块当生成指令 |
| BGM 识别（ACRCloud） | ⬜ 待开始 | 【wb添加】音频指纹识别背景音乐 + 情绪标签，供爆款元素标注 |
| 视频转写（Whisper） | ⬜ 待开始 | 【wb添加】语音转文字，供文案结构/钩子技巧提取 |

---

## Phase 6: 对接 AI 视频生成

| 任务 | 状态 | 说明 |
|------|------|------|
| 确定视频生成工具 | ⬜ 待开始 | Runway / Pika / Kling / 可灵 |
| 接入生成 API | ⬜ 待开始 | 替换 generate 节点占位逻辑 |
| 生成 5 步流水线 | ⬜ 待开始 | 【wb添加】脚本撰写 → 画面素材匹配/AI 视频 → AI 配音 → BGM 搭配 → FFmpeg 合成的端到端流水线 |
| 成片质量检查（Quality Gate） | ⬜ 待开始 | 【wb添加】生成后自动质检（时长/画质/字幕/音画同步），不达标打回重生成 |

---

## Phase 7: 完善可视化编辑器与可观测性

> 更新于 2026-07-09（WB 直接实现）。下表区分「已实现 / 部分实现 / 未实现」，其中画布内可见的抓取/分析/生成节点目前**仅是可拖拽编辑的壳子，节点背后的真实业务逻辑均未实现**（分别对应 Phase 4/5/6）。

### 7.1 可视化画布 — 已实现（WB 直接写代码，前端构建通过）

| 功能 | 状态 | 说明 |
|------|------|------|
| Vue Flow 画布（拖拽 + 连线） | ✅ 已实现 | 【wb添加】`<VueFlow>` + Background + Controls，左侧节点库拖拽落点生成节点，输出口拉到下一节点输入口形成执行顺序 |
| 节点配置面板 | ✅ 已实现 | 【wb添加】点击节点右侧滑出面板，按节点类型渲染不同配置字段（fetch 的 source/keyword/maxVideos、analyze 的 model 等），写回节点 data |
| 工作流保存/加载 | ✅ 已实现 | 【wb添加】序列化 nodes+edges 调 `workflowApi.create/get`；当前后端用内存 Map 存储，重启即丢（持久化待 Phase 3 落库） |
| 运行按钮 + WebSocket 进度推送 | ✅ 已实现 | 【wb添加】点运行调 `execute` 入队并连 WS 收进度，节点按 running/success/failed 变色 + 底部日志；**进度为真实**（Worker 驱动引擎逐节点推送，2026-07-10 Phase 3 落地后已替换原模拟循环） |
| 节点删除 | ✅ 已实现 | 【wb添加】配置面板「删除节点」按钮 + 键盘 Delete/Backspace 删除选中节点（连同其连线一并删除），禁用 Vue Flow 内置删除改用自管逻辑 |
| 撤销（Undo） | ✅ 已实现 | 【wb添加】维护结构性变更快照栈（新增/删除/连线前入栈），工具栏「撤销」按钮恢复上一步；上限 50 步 |

### 7.2 画布中的业务节点 — 功能未实现（仅壳子，逻辑待 Phase 4/5/6）

| 画布节点 | 状态 | 说明 |
|----------|------|------|
| 自动抓取（TK 视频抓取） | ⚠️ 节点已可拖拽编辑，**功能未实现** | 画布里能拖出「TK 视频抓取」节点并配 keyword/source/maxVideos，但其背后的真实抓取逻辑（TikAPI/代理/下载）尚未写，待 Phase 4 |
| AI 视频分析 | ⚠️ 节点已可拖拽编辑，**功能未实现** | 画布里能拖出「AI 视频分析」节点，但 GPT-4V/Whisper/ACRCloud 真实分析逻辑未写，待 Phase 5 |
| AI 视频生成 | ⚠️ 节点已可拖拽编辑，**功能未实现** | 画布里能拖出「AI 视频生成」节点，但 Runway/Pika/FFmpeg 合成逻辑未写，待 Phase 6 |
| 数据转换 / 条件判断 / 结果输出 | ⬜ 未实现 | 节点已存在于面板，仅占位，无逻辑 |

> 一句话：本次把「可视化画布」的交互闭环做通了（拖拽、连线、配置、保存加载、运行模拟进度、删除、撤销），但画布上那些业务节点（自动抓取等）只是能摆能连的空壳——点了运行也只会走模拟进度，不会真去抓视频/分析/生成。要让它们真干活，按 Phase 4→5→6 逐阶段把节点逻辑写实。

### 7.3 可观测性 / 成本 / 审核 — 未实现（原 wb添加 项）

| 任务 | 状态 | 说明 |
|------|------|------|
| 可观测性（Prometheus/Grafana） | ⬜ 待开始 | 【wb添加】指标采集 + 仪表盘，监控管线吞吐/失败率/各环节耗时 |
| 成本监控 | ⬜ 待开始 | 【wb添加】按视频追踪 AI/代理/存储调用成本，超阈值告警 |
| 质量卡点 + 人工审核（3 道门） | ⬜ 待开始 | 【wb添加】脚本/画面/成片三道审核门，支持人工确认后再进入下一环节，避免批量产出垃圾内容 |

---

## 技术债务 / 待优化

- [x] TypeORM + SQL Server 实体定义（✅ Phase 3 已完成）
- [x] BullMQ 任务队列集成（✅ Phase 3 已完成）
- [x] WebSocket 实时通信（✅ Phase 3 已实现真实进度推送）
- [ ] 用户认证（JWT）
- [ ] 错误日志系统
- [ ] 单元测试覆盖
- [ ] API 参数校验（ValidationPipe）
- [ ] 【wb添加】多账号并发调度与限流（参考 Phase 4 住宅代理 + 批量监控）
- [ ] 【wb添加】成本计量与告警（参考 Phase 7 成本监控）

---

## 修改日志

| 日期 | 修改内容 | 备注 |
|------|---------|------|
| 2026-07-07 | 项目框架搭建完成，80 个文件，全链路编译通过 | Phase 1 ✅ |
| 2026-07-07 | 安装 Redis + 启动后端/前端 + API 全链路验证通过 | Phase 2 ✅ |
| 2026-07-08 | 对照 WB 架构方案补齐流程表缺口：新增 Phase 3(架构级补全：对象存储/异步执行/落库)，原 Phase 3-6 顺延为 4-7；补充代理+反检测、多账号+FastMoss、Provider 补全、结构化 Schema、BGM 识别、Whisper 转写、5 步生成、成片质量门、可观测性、成本监控、3 道审核门等【wb添加】项 | 效果优化路线图 |
| 2026-07-09 | Phase 7 可视化画布：WB 直接写代码实现 拖拽+连线 / 节点配置面板 / 保存加载 / 运行按钮+WebSocket 模拟进度 / 节点删除 / 撤销(Undo)；前端构建通过。更新 PROGRESS.md Phase 7 状态表，明确区分「已实现 / 部分实现 / 未实现」，并标明画布中自动抓取/分析/生成节点仅壳子（功能未实现，逻辑待 Phase 4/5/6） | 从画布交互入手迭代 |
| 2026-07-10 | Phase 3 架构级补全 WB 实现：StorageModule(MinIO+本地兜底) + docker-compose 增 minio/mongodb；BullMQ Worker(WorkflowConsumer) 真实驱动引擎并推 WS 进度；WorkflowService 改用 TypeORM+Mongo 落库、execute 入队。后端 nest build 通过、启动越过 NestFactory（仅因 sandbox 未起 DB 而挂起连接，结构正确）。节点业务逻辑仍为占位 | 攻克架构地基，让"运行"从假变真 |

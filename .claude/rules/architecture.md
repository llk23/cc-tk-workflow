# 架构决策记录

## 项目结构
- **Monorepo + npm workspaces** — 模块解耦，共享类型
- **packages/** — 纯逻辑，零框架依赖
- **apps/** — 框架层（NestJS / Vue 3）

## 核心架构
- **工作流引擎**: DAG 有向无环图 + 拓扑排序执行
- **节点系统**: 每个节点继承 BaseNode，定义 input/output schema
- **Context Store**: Redis 缓存节点间传递的上下文
- **任务队列**: BullMQ 异步处理长时间任务

## 关键技术决策
1. NestJS 作为 API 网关 — 模块化结构适合复杂业务
2. Vue Flow 作为可视化编辑器 — Vue 3 原生流程图库
3. SQL Server + TypeORM — 用户指定数据库
4. AI Provider 抽象层 — 可插拔设计，支持多模型切换
5. BullMQ 异步队列 — 视频处理任务必须异步

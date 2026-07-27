# 🎬 TK AI Video Pipeline

TK 美区平台的短视频 AI 工作流系统。核心管线：**自动抓取 TK 视频 → AI 多模态分析 → AI 视频生成**。

## 当前开发状态

| 阶段 | 状态 |
|------|------|
| Phase 1: 项目框架搭建 | ✅ 完成 |
| Phase 2: 环境运行 & 链路验证 | ✅ 完成 |
| Phase 3: 架构级补全 (队列/存储/WebSocket) | ✅ 完成 |
| Phase 4: 可视化画布交互 | ✅ 完成 |
| Phase 5: 工作流节点功能实现 | 🔥 进行中 |
| Phase 6: 完善与可观测性 | ⬜ 待开始 |

### 已实现的节点

- **5.1 TK 账号验证** ✅ — Cookie 注入验证，输出传递给下游
- **5.2 TK 视频抓取** ✅ — CDP 浏览器搜索、网络级带货判定、7 种过滤条件、视频下载缓存
- 5.3 AI 视频分析 ⬜、5.4 AI 视频生成 ⬜、5.5 辅助节点 ⬜

### 核心组件

| 组件 | 端口 | 用途 |
|------|------|------|
| **NestJS 后端** | `:3000` | 工作流 CRUD、执行调度、WebSocket 进度推送 |
| **Vue 3 前端** | `:5173` | Vue Flow 可视化编辑器、节点配置面板 |
| **CDP Proxy** | `:3456` | Chrome DevTools Protocol 代理，封装抓取 API |
| **Chrome** | `:9222` | 远程调试浏览器，用于 TikTok 数据抓取 |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动基础设施（需要 Docker）
docker compose -f docker/docker-compose.yml up -d

# 3. 构建类型包
npm run build:types

# 4. 启动后端
npm run dev:server

# 5. 启动前端（新开终端）
npm run dev:web
```

Windows 一键启动：双击 `start.bat`

## 项目结构

```
TK-workflow-cc/
├── packages/
│   ├── types/         # 共享类型定义 (NodeTypeEnum, Workflow, TKVideo 等)
│   ├── core/          # 工作流引擎 (DAG Pipeline + 节点执行器 + 上下文存储)
│   ├── providers/     # AI 供应商抽象层 (OpenAI / Claude / Ollama)
│   └── nodes/         # 工作流节点库 (fetch/analyze/generate/transform/condition/output)
├── apps/
│   ├── server/        # NestJS 后端 (workflow CRUD + BullMQ + WebSocket)
│   ├── web/           # Vue 3 前端 (Vue Flow 画布 + 配置面板 + Pinia)
│   └── cli/           # CLI 工具 (commander)
├── docker/            # Redis + SQL Server + MinIO + MongoDB 编排
├── docs/              # 开发文档
└── scripts/           # 启动脚本 + 数据库初始化
```

## 技术栈

| 层面 | 技术 |
|------|------|
| 后端 | NestJS (TypeScript) |
| 前端 | Vue 3 + Vue Flow + Pinia |
| 数据库 | SQL Server |
| 任务队列 | BullMQ + Redis |
| 对象存储 | MinIO |
| 分析存储 | MongoDB |
| 浏览器自动化 | Chrome DevTools Protocol (CDP) |
| AI 模型 | OpenAI / Claude / Ollama (可插拔) |

## 文档

- [架构说明](docs/architecture.md)
- [节点开发指南](docs/node-development.md)
- [TK 平台对接](docs/tk-integration.md)
- [工作流生命周期](docs/workflow-lifecycle.md)
- [开发进度](PROGRESS.md)

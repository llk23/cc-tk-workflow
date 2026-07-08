# TK AI Video Pipeline

TK 美区平台的短视频 AI 工作流系统。核心管线：**自动抓取 TK 视频 → AI 多模态分析 → AI 视频生成**。

## 项目结构

```
TK-workflow-cc/
├── packages/
│   ├── types/         # 共享类型定义
│   ├── core/          # 工作流引擎核心
│   ├── providers/     # AI 供应商抽象层
│   └── nodes/         # 工作流节点库
├── apps/
│   ├── server/        # NestJS 后端 API
│   ├── web/           # Vue 3 前端
│   └── cli/           # CLI 工具
├── docker/            # Docker 编排
└── docs/              # 文档
```

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

## 技术栈

| 层面 | 技术 |
|------|------|
| 后端 | NestJS (TypeScript) |
| 前端 | Vue 3 + Vue Flow + Pinia |
| 数据库 | SQL Server |
| 任务队列 | BullMQ + Redis |
| AI 模型 | OpenAI / Claude / Ollama (可插拔) |

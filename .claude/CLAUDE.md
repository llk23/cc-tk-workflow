# TK AI Video Pipeline — Claude Code 项目指令

## 项目简介
TK 美区平台的短视频 AI 工作流系统。核心管线：**自动抓取 TK 视频 → AI 多模态分析 → AI 视频生成**。

## 技术栈
- **后端**: NestJS (TypeScript) + SQL Server + BullMQ/Redis
- **前端**: Vue 3 + TypeScript + Vue Flow + Pinia
- **核心引擎**: 自定义 DAG 工作流引擎 (packages/core)

## 开发守则
1. **类型先行** — 所有数据模型在 `packages/types/src/` 定义，修改前先查阅
2. **模块化** — 每个功能模块独立目录，通过 npm workspace 引用
3. **Provider 抽象** — AI 调用通过 `packages/providers` 统一接口
4. **节点复用** — 新增节点继承 `packages/nodes/src/base/BaseNode`

## 执行需求
    每次输出内容时，开头必须携带"-"符号

## 常用命令
| 命令 | 说明 |
|------|------|
| `npm run dev:server` | 启动 NestJS 开发服务器 |
| `npm run dev:web` | 启动 Vue 前端开发服务器 |
| `npm run build` | 构建所有 workspaces |
| `npm run build:types` | 仅构建类型包 |
| `npm test` | 运行所有测试 |

## 架构目录
- `packages/` — 纯核心逻辑，不依赖框架
- `apps/server` — NestJS API 网关
- `apps/web` — Vue 3 前端
- `.claude/agents/` — 自定义 Agent
- `.claude/skills/` — 自定义技能
- `.claude/rules/` — 代码规范

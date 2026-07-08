# Git 分支策略

## 分支命名
- `main` — 稳定版本
- `develop` — 开发主线
- `feature/{name}` — 功能分支
- `fix/{name}` — 修复分支
- `docs/{name}` — 文档更新

## 工作流
1. 从 `develop` 切出 `feature/xxx`
2. 功能开发完成 → PR 合入 `develop`
3. 版本稳定 → `develop` 合入 `main`
4. 紧急修复 → 从 `main` 切 `fix/xxx` → 合入 `main` 和 `develop`

## Commit 规范
```
feat: 新增功能
fix: 修复 bug
refactor: 重构
docs: 文档
chore: 工具/配置
style: 代码格式
test: 测试
```

首次提交用 `chore: init project scaffolding`

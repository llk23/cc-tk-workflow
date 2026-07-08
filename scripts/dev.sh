#!/bin/bash

# TK AI Video Pipeline — 开发环境启动脚本

echo "===== TK AI Video Pipeline 开发环境 ====="

# 1. 安装依赖
echo "📦 安装依赖..."
npm install

# 2. 构建类型包
echo "🔨 构建类型定义..."
npm run build:types

# 3. 启动后端 (后台)
echo "🚀 启动 NestJS 后端..."
npx nest start -w apps/server &

# 4. 启动前端 (后台)
echo "🎨 启动 Vue 前端..."
npx vite apps/web &

echo "✅ 环境已启动"
echo "  后端: http://localhost:3000"
echo "  前端: http://localhost:5173"

wait

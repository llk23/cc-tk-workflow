@echo off
chcp 65001 >nul
title TK AI Video Pipeline

echo ╔══════════════════════════════════════════╗
echo ║     TK AI Video Pipeline — 一键启动      ║
echo ╚══════════════════════════════════════════╝
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [*] 首次运行，正在安装依赖...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [错误] 依赖安装失败，请尝试手动运行: npm install
        pause
        exit /b 1
    )
)

echo [1/3] 启动后端服务 ^(NestJS, localhost:3000^)...
start "TK-Backend" cmd /c "title TK-Backend && npm run dev:server"

echo [2/3] 启动前端界面 ^(Vue 3, localhost:5173^)...
start "TK-Frontend" cmd /c "title TK-Frontend && npm run dev:web"

echo [3/3] 等待服务启动...
choice /t 6 /d y /n >nul 2>&1

echo.
echo ────────────────────────────────────────────
echo   ✅ 项目已启动！
echo.
echo   前端界面:  http://localhost:5173
echo   后端 API:   http://localhost:3000
echo ────────────────────────────────────────────
echo.

start "" http://localhost:5173

echo  浏览器已自动打开，若未弹出请手动访问上方地址。
echo  关闭此窗口不会影响后端和前端运行。
echo  如需停止服务，请关闭对应的命令行窗口。
echo.

exit /b 0

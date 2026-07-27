@echo off
cd /d %~dp0
title TK Workflow
set NPM=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2\npm.cmd
start "TK-Backend" cmd /k "cd /d %~dp0 && %NPM% run dev:server"
start "TK-Frontend" cmd /k "cd /d %~dp0 && %NPM% run dev:web"
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo Close TK-Backend / TK-Frontend windows to stop.
echo.
pause

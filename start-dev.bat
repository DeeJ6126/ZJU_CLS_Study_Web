@echo off
chcp 65001 >nul
setlocal

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

echo ====================================================
echo   Study_Web 开发服务启动器
echo   Project: %PROJECT_DIR%
echo ====================================================
echo.

echo [1/2] 启动后端服务 (127.0.0.1:5175) ...
start "Study_Web Backend (5175)" cmd /k "cd /d %PROJECT_DIR% && npm.cmd run server"

echo [2/2] 启动前端开发服务 (127.0.0.1:5174) ...
start "Study_Web Frontend (5174)" cmd /k "cd /d %PROJECT_DIR% && npm.cmd run dev"

echo.
echo 两个服务已经在独立窗口里运行。
echo   资源网站:  http://127.0.0.1:5174/
echo   管理页面:  http://127.0.0.1:5174/#/admin
echo   后端 API:  http://127.0.0.1:5175/
echo.
echo 浏览器不会自动打开 — 请手动复制地址访问。
echo 关掉对应窗口即可停止服务(关掉本窗口不会影响它们)。
echo.
pause

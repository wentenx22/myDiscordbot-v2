@echo off
REM 修复中文乱码的启动脚本
chcp 65001 >nul 2>&1
cls
echo Starting Discord Bot...
echo 启动 Discord Bot...
node index.js
pause

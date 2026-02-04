@echo off
chcp 65001 > nul 2>&1
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo 正在推送到GitHub...
echo.

git add -A
git commit -m "chore: 代码同步更新" 2>nul
git push

if errorlevel 1 (
    echo.
    echo 推送失败！如被Secret Scanning阻止，访问：
    echo https://github.com/wentenx22/myDiscordbot-v2/security/secret-scanning
    echo.
)

pause

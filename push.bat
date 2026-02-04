@echo off
chcp 65001 > nul 2>&1
setlocal enabledelayedexpansion
cls

echo.
echo ════════════════════════════════════════════════════════════════
echo           Discord Bot - GitHub 推送助手
echo ════════════════════════════════════════════════════════════════
echo.

REM 获取当前目录
cd /d "%~dp0"

REM 检查git是否安装
git --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到Git，请先安装Git
    pause
    exit /b 1
)

REM 显示git状态
echo [信息] 当前分支和状态：
git status -s
echo.

REM 检查是否有未提交的更改
git diff-index --quiet HEAD --
if errorlevel 1 (
    echo [警告] 检测到未提交的更改
    echo.
    echo 选项：
    echo   1 = 直接推送（推荐）
    echo   2 = 先提交更改再推送
    echo   其他 = 退出
    echo.
    set /p choice="请选择 [1-2]："
    
    if "!choice!"=="2" (
        echo.
        echo [信息] 提交更改...
        git add -A
        set /p message="请输入提交信息 [默认: chore: 代码同步]："
        if "!message!"=="" set message=chore: 代码同步
        
        git commit -m "!message!"
        if errorlevel 1 (
            echo [错误] 提交失败
            pause
            exit /b 1
        )
    ) else if not "!choice!"=="1" (
        echo [取消] 用户中止
        pause
        exit /b 0
    )
) else (
    echo [信息] 没有未提交的更改
)

echo.
echo [推送] 正在推送到GitHub...
echo.

REM 执行推送
git push

REM 检查推送结果
if errorlevel 1 (
    echo.
    echo [错误] 推送失败！
    echo.
    echo 可能的原因和解决方案：
    echo   1. GitHub Secret Scanning：
    echo      - 前往: https://github.com/wentenx22/myDiscordbot-v2/security/secret-scanning
    echo      - 点击被检测到的secret旁的"Allow"按钮
    echo.
    echo   2. 网络连接问题：
    echo      - 检查网络连接
    echo      - 确保可以访问 github.com
    echo.
    echo   3. 认证问题：
    echo      - 运行: git config --global user.email "your-email@example.com"
    echo      - 运行: git config --global user.name "Your Name"
    echo.
    echo 更多帮助：
    echo   https://docs.github.com/code-security/secret-scanning
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo [成功] 推送完成！
    echo.
)

pause

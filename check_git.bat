@echo off
cd /d "C:\Users\Zx\Desktop\myDiscordbot\陪玩"

echo ============ Git Status ============
git status

echo.
echo ============ Git Remote ============
git remote -v

echo.
echo ============ Git Log ============
git log --oneline -5

echo.
echo ============ All Files ============
dir /b

pause

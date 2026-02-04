# 删除gitignore并重新提交所有文件

Set-Location "C:\Users\Zx\Desktop\myDiscordbot\陪玩"

Write-Host "📋 当前git状态:" -ForegroundColor Green
git status

Write-Host "`n🔄 删除.gitignore..." -ForegroundColor Cyan
git rm .gitignore -f 2>$null
git add .gitignore 2>$null

Write-Host "🔄 清除所有缓存文件..." -ForegroundColor Cyan
git rm --cached -r . 2>$null

Write-Host "🔄 重新添加所有文件..." -ForegroundColor Cyan
git add .

Write-Host "`n📊 检查状态:" -ForegroundColor Green
git status

Write-Host "`n📝 提交更改..." -ForegroundColor Cyan
git commit -m "chore: 移除gitignore限制，追踪所有文件和数据库" --allow-empty

Write-Host "`n📤 推送到GitHub..." -ForegroundColor Cyan
git push origin main

Write-Host "`n✅ 完成！" -ForegroundColor Green

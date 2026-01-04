# 快速迁移检查脚本 (Windows PowerShell)
# 用途：验证迁移设置是否完整

Write-Host "🔍 检查迁移状态..." -ForegroundColor Cyan
Write-Host ""

# 检查必要的文件
Write-Host "📁 检查文件..." -ForegroundColor Yellow
$files = @("db.js", "migrate.js", "index.js", "package.json")
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file 缺失" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📦 检查依赖..." -ForegroundColor Yellow
$packageJson = Get-Content package.json | ConvertFrom-Json
if ($packageJson.dependencies.sqlite3) {
    Write-Host "✅ sqlite3 已添加到 package.json" -ForegroundColor Green
} else {
    Write-Host "❌ sqlite3 未在 package.json 中" -ForegroundColor Red
}

Write-Host ""
Write-Host "🗄️ 检查数据库..." -ForegroundColor Yellow
if (Test-Path "data.db") {
    $dbSize = (Get-Item "data.db").Length / 1KB
    Write-Host "✅ data.db 已存在 (大小: $([math]::Round($dbSize, 2)) KB)" -ForegroundColor Green
} else {
    Write-Host "⏳ data.db 将在首次启动时创建" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "📋 快速开始指南:" -ForegroundColor Yellow
Write-Host "1️⃣  npm install" -ForegroundColor Cyan
Write-Host "2️⃣  node migrate.js   (如果你有现存的 JSON 数据)" -ForegroundColor Cyan
Write-Host "3️⃣  node index.js" -ForegroundColor Cyan

Write-Host ""
Write-Host "📖 更多信息:" -ForegroundColor Yellow
Write-Host "查看 MIGRATION_COMPLETE.md - 迁移完成指南" -ForegroundColor Cyan
Write-Host "查看 MIGRATION.md - 详细迁移文档" -ForegroundColor Cyan

Write-Host ""
Write-Host "✨ 迁移检查完成！" -ForegroundColor Green

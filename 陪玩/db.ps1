# Database Management Helper for Windows
# 用法: .\db.ps1 [命令]

param(
    [string]$Command = "info"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        📊 SQLite 数据库管理 (快捷脚本)           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

switch ($Command.ToLower()) {
    "info" {
        Write-Host "📊 显示数据库信息..." -ForegroundColor Yellow
        node db-info.js
    }
    
    "manager" {
        Write-Host "🔧 进入交互式数据库管理器..." -ForegroundColor Yellow
        node db-manager.js
    }
    
    "view" {
        Write-Host "📋 显示所有订单..." -ForegroundColor Yellow
        node db-manager.js view
    }
    
    "stats" {
        Write-Host "📈 显示统计数据..." -ForegroundColor Yellow
        node db-manager.js stats
    }
    
    "recent" {
        $limit = $args[0] -as [int]
        if (-not $limit) { $limit = 10 }
        Write-Host "📋 显示最近 $limit 条订单..." -ForegroundColor Yellow
        node db-manager.js recent $limit
    }
    
    "get" {
        if (-not $args[0]) {
            Write-Host "❌ 请提供订单 ID" -ForegroundColor Red
            exit 1
        }
        $id = $args[0]
        Write-Host "🔍 查看订单 ID: $id..." -ForegroundColor Yellow
        node db-manager.js get $id
    }
    
    "search" {
        if (-not $args[0]) {
            Write-Host "❌ 请提供搜索关键词" -ForegroundColor Red
            exit 1
        }
        $keyword = $args[0]
        Write-Host "🔍 搜索: $keyword..." -ForegroundColor Yellow
        node db-manager.js search $keyword
    }
    
    "backup-json" {
        Write-Host "💾 导出为 JSON..." -ForegroundColor Yellow
        node db-manager.js export-json
    }
    
    "backup-csv" {
        Write-Host "💾 导出为 CSV..." -ForegroundColor Yellow
        node db-manager.js export-csv
    }
    
    "backup" {
        Write-Host "💾 导出数据备份 (JSON 和 CSV)..." -ForegroundColor Yellow
        node db-manager.js export-json
        node db-manager.js export-csv
        Write-Host "✅ 备份完成！" -ForegroundColor Green
    }
    
    "help" {
        Write-Host "可用命令:" -ForegroundColor Green
        Write-Host "  info              - 显示数据库信息摘要" -ForegroundColor Cyan
        Write-Host "  manager           - 进入交互式管理器" -ForegroundColor Cyan
        Write-Host "  view              - 显示所有订单" -ForegroundColor Cyan
        Write-Host "  stats             - 显示统计数据" -ForegroundColor Cyan
        Write-Host "  recent [n]        - 显示最近 n 条订单 (默认 10)" -ForegroundColor Cyan
        Write-Host "  get [id]          - 按 ID 查看订单" -ForegroundColor Cyan
        Write-Host "  search [keyword]  - 搜索订单" -ForegroundColor Cyan
        Write-Host "  backup-json       - 导出为 JSON" -ForegroundColor Cyan
        Write-Host "  backup-csv        - 导出为 CSV" -ForegroundColor Cyan
        Write-Host "  backup            - 导出所有格式" -ForegroundColor Cyan
        Write-Host "  help              - 显示帮助" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "示例:" -ForegroundColor Green
        Write-Host "  .\db.ps1 info" -ForegroundColor Gray
        Write-Host "  .\db.ps1 search 豆豆" -ForegroundColor Gray
        Write-Host "  .\db.ps1 get 5" -ForegroundColor Gray
        Write-Host "  .\db.ps1 backup" -ForegroundColor Gray
    }
    
    default {
        Write-Host "❌ 未知命令: $Command" -ForegroundColor Red
        Write-Host "运行 '.\db.ps1 help' 查看帮助" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""

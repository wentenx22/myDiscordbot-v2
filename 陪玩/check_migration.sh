#!/bin/bash
# 快速迁移脚本 - 用于快速验证迁移状态

echo "🔍 检查迁移状态..."
echo ""

# 检查是否存在必要的文件
echo "📁 检查文件..."
if [ -f "db.js" ]; then echo "✅ db.js"; else echo "❌ db.js 缺失"; fi
if [ -f "migrate.js" ]; then echo "✅ migrate.js"; else echo "❌ migrate.js 缺失"; fi
if [ -f "index.js" ]; then echo "✅ index.js"; else echo "❌ index.js 缺失"; fi
if [ -f "package.json" ]; then echo "✅ package.json"; else echo "❌ package.json 缺失"; fi

echo ""
echo "📦 检查依赖..."
if grep -q "sqlite3" package.json; then
  echo "✅ sqlite3 已添加到 package.json"
else
  echo "❌ sqlite3 未在 package.json 中"
fi

echo ""
echo "🗄️ 检查数据库..."
if [ -f "data.db" ]; then
  echo "✅ data.db 已存在"
else
  echo "⏳ data.db 将在首次启动时创建"
fi

echo ""
echo "📋 快速开始："
echo "1️⃣  npm install"
echo "2️⃣  node migrate.js   (如果你有现存的 JSON 数据)"
echo "3️⃣  node index.js"

echo ""
echo "✨ 迁移检查完成！"

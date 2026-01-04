# 📌 数据库工具快速参考

## 🚀 快速开始

### Windows 用户
```powershell
# 查看数据库信息
.\db.ps1 info

# 搜索订单
.\db.ps1 search 豆豆

# 备份数据
.\db.ps1 backup
```

### 所有用户
```bash
# 快速查看数据库
node db-info.js

# 打开交互式管理器
node db-manager.js

# 编辑数据
node db-edit.js
```

---

## 🛠️ 可用工具

| 工具 | 文件 | 用途 | 快速使用 |
|------|------|------|---------|
| 📊 信息 | db-info.js | 快速查看数据库摘要 | `node db-info.js` |
| 🔧 管理 | db-manager.js | 查看、搜索、导出数据 | `node db-manager.js` |
| ✏️ 编辑 | db-edit.js | 修改和删除数据 | `node db-edit.js` |
| ⚡ 快捷 | db.ps1 | Windows PowerShell 脚本 | `.\db.ps1 help` |
| 📚 库文件 | db.js | 底层数据库驱动 | (无需直接使用) |

---

## 📋 常用命令

### 查看数据
```bash
node db-info.js                    # 快速概览
node db-manager.js view            # 所有订单
node db-manager.js stats           # 统计数据
node db-manager.js recent 10       # 最近 10 条
node db-manager.js get 5           # ID 为 5 的订单
```

### 搜索和导出
```bash
node db-manager.js search 豆豆     # 搜索玩家
node db-manager.js export-json     # 导出 JSON
node db-manager.js export-csv      # 导出 CSV (Excel)
```

### 修改数据
```bash
node db-edit.js                    # 交互式编辑
node db-manager.js reset-stats     # 重置统计 ⚠️
```

---

## 🎯 场景速查

### "我想查看数据库里有多少订单"
```bash
node db-info.js
```

### "我想找某个玩家的订单"
```bash
node db-manager.js search 玩家名
```

### "我想导出数据到 Excel"
```bash
node db-manager.js export-csv
```

### "我想修改一个订单的单号"
```bash
node db-edit.js
# 选择选项 2
```

### "我想删除一条错误的订单"
```bash
node db-edit.js
# 选择选项 3
```

### "我想备份所有数据"
```bash
node db-manager.js export-json
```

---

## 💾 数据库文件

- **data.db** - SQLite 数据库文件 (24.6 KB)
  - 包含所有订单数据
  - 自动保存每个操作
  - 不要手动编辑

---

## ✅ 数据库状态

✅ **数据库正常运行**
- 总订单数：32
- 数据库中记录：70
- 总收入：RM 1569

---

## 📞 需要帮助？

📖 **详细文档**
- [DATABASE_GUIDE.md](DATABASE_GUIDE.md) - 完整数据库指南
- [TOOLS_GUIDE.md](TOOLS_GUIDE.md) - 所有工具详解

🔗 **快速链接**
- 查看 db.ps1 帮助：`.\db.ps1 help`
- 运行 db-manager.js：`node db-manager.js`

---

⏰ **最后更新**：2026-01-02

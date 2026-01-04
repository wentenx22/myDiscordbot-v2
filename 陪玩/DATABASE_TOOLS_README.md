# ✨ 数据库检查和编辑 - 完整指南

你现在可以通过多种方式检查和编辑 SQLite 数据库！

## 🎯 一句话总结

```bash
# 最快的方法：查看数据库信息
node db-info.js

# 管理数据库的方法：打开管理工具
node db-manager.js

# 编辑数据的方法：打开编辑工具
node db-edit.js

# Windows 快捷方法
.\db.ps1 info
```

---

## 🛠️ 我为你创建的工具

### 1. **db-info.js** - 📊 快速查看
- **用途**：快速查看数据库概览
- **特点**：快速、简洁、无需交互
- **输出**：总订单数、总收入、最近订单

```bash
node db-info.js
```

### 2. **db-manager.js** - 🔧 完整管理
- **用途**：查看、搜索、导出、管理数据
- **特点**：功能全面、支持多种操作
- **支持**：JSON/CSV 导出、搜索、备份

```bash
# 交互式：按菜单选择
node db-manager.js

# 快速命令
node db-manager.js view           # 查看所有
node db-manager.js stats          # 统计数据
node db-manager.js search 豆豆    # 搜索
node db-manager.js export-json    # 导出
```

### 3. **db-edit.js** - ✏️ 编辑数据
- **用途**：修改、删除、编辑数据
- **特点**：安全、需要确认、有日志
- **支持**：修改单号、删除订单、编辑统计

```bash
node db-edit.js
```

### 4. **db.ps1** - ⚡ Windows 快捷脚本
- **用途**：Windows 用户一键访问所有工具
- **特点**：方便、易用、颜色标记
- **支持**：所有 db-manager.js 功能

```powershell
.\db.ps1 info              # 信息
.\db.ps1 search 豆豆       # 搜索
.\db.ps1 backup            # 备份
.\db.ps1 help              # 帮助
```

---

## 📊 当前数据库状态

✅ **数据库完全就绪**

```
总订单数：32 条
数据库记录：70 条 (包含历史数据)
总收入：RM 1569
平均单价：RM 49.03
数据库文件：data.db (24.6 KB)
```

---

## 🎬 使用示例

### 例子 1：我想快速检查数据库
```bash
node db-info.js
```
输出：数据库摘要、最近订单、文件大小

### 例子 2：我想找某个玩家的订单
```bash
node db-manager.js search 豆豆
```
输出：所有包含"豆豆"的订单

### 例子 3：我想修改订单单号
```bash
node db-edit.js
# 选择 "2. 修改订单单号"
# 输入订单 ID 和新单号
```

### 例子 4：我想导出数据到 Excel
```bash
node db-manager.js export-csv
```
输出：backup_2026-01-02.csv (可用 Excel 打开)

### 例子 5：我想删除一条错误的订单
```bash
node db-edit.js
# 选择 "3. 删除特定订单"
# 输入订单 ID，确认删除
```

### 例子 6：我想备份所有数据
```bash
node db-manager.js export-json
# 和
node db-manager.js export-csv
```

---

## 🔐 安全提示

✅ **安全的操作**（不会修改数据）
- ✅ 查看数据 (info, view, search, get)
- ✅ 导出数据 (export-json, export-csv)

⚠️ **需谨慎的操作**
- ⚠️ 修改单号（修改前会显示当前信息）
- ⚠️ 删除订单（删除前需要确认）

🚨 **危险操作**
- 🚨 清空所有订单（不可撤销，需要特殊确认）
- 🚨 重置统计数据（不可撤销，需要特殊确认）

### 💡 最佳实践
1. 定期备份：`node db-manager.js export-json`
2. 修改前检查：`node db-manager.js get [ID]`
3. 修改后验证：`node db-info.js`

---

## 📚 文件清单

创建的文件：

| 文件 | 大小 | 用途 |
|------|------|------|
| db.js | 7.9 KB | 核心数据库模块 |
| db-info.js | 2.2 KB | 快速查看工具 |
| db-manager.js | 12.6 KB | 完整管理工具 |
| db-edit.js | 6.1 KB | 编辑工具 |
| db.ps1 | 4.2 KB | Windows 脚本 |
| data.db | 24.6 KB | SQLite 数据库文件 |
| DATABASE_GUIDE.md | 6.8 KB | 详细指南 |
| TOOLS_GUIDE.md | 6.5 KB | 工具说明 |
| QUICK_START.md | 2.5 KB | 快速参考 |

---

## 🚀 快速命令速查

### Windows PowerShell
```powershell
.\db.ps1 info                # 数据库概览
.\db.ps1 view                # 所有订单
.\db.ps1 stats               # 统计数据
.\db.ps1 recent 10           # 最近 10 条
.\db.ps1 get 5               # ID=5 的订单
.\db.ps1 search 豆豆         # 搜索
.\db.ps1 backup-json         # 导出 JSON
.\db.ps1 backup-csv          # 导出 CSV
.\db.ps1 backup              # 备份所有
.\db.ps1 manager             # 打开管理器
.\db.ps1 help                # 显示帮助
```

### Node.js (所有平台)
```bash
node db-info.js                    # 快速查看
node db-manager.js                 # 打开管理器
node db-manager.js view            # 查看所有
node db-manager.js search 豆豆     # 搜索
node db-manager.js get 5           # 查看详情
node db-manager.js recent 20       # 最近 20 条
node db-manager.js export-json     # 导出 JSON
node db-manager.js export-csv      # 导出 CSV
node db-edit.js                    # 编辑数据
```

---

## 🆘 常见问题

**Q: 数据库在哪里？**
A: `data.db` 文件就是你的 SQLite 数据库

**Q: 我可以用 Excel 打开吗？**
A: 不能直接打开 data.db，但可以导出为 CSV 后用 Excel 打开
```bash
node db-manager.js export-csv
```

**Q: 如何恢复删除的数据？**
A: 如果有备份可以恢复，否则无法恢复。建议定期备份！

**Q: 性能如何？**
A: SQLite 非常快，即使有 1000+ 订单也很快

**Q: 数据会自动保存吗？**
A: 是的，每个操作都会自动保存到 data.db

---

## 📞 需要帮助？

1. **快速参考**：打开 `QUICK_START.md`
2. **详细指南**：打开 `DATABASE_GUIDE.md`
3. **工具说明**：打开 `TOOLS_GUIDE.md`
4. **查看帮助**：`.\db.ps1 help` 或 `node db-manager.js`

---

## ✨ 总结

你现在有 4 个强大的工具来：
- ✅ 快速查看数据库信息
- ✅ 搜索和查找订单
- ✅ 修改和删除数据
- ✅ 导出数据备份
- ✅ 管理统计数据

所有工具都有安全保护，重要操作都需要确认！

开始使用吧！ 🚀

---

**创建时间**：2026-01-02
**数据库文件**：data.db (24.6 KB)
**状态**：✅ 完全就绪

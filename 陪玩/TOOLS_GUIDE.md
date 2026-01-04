# 🛠️ 数据库工具总览

## 快速开始

### Windows 用户：使用 PowerShell 脚本
```powershell
# 查看数据库信息
.\db.ps1 info

# 进入管理器
.\db.ps1 manager

# 其他命令
.\db.ps1 search 豆豆
.\db.ps1 backup
```

### 所有用户：使用 Node.js 工具
```bash
# 快速查看
node db-info.js

# 交互式管理
node db-manager.js

# 编辑数据
node db-edit.js
```

---

## 📚 可用工具详解

### 1️⃣ **db-info.js** - 快速信息查看 ⭐ 推荐

**用途**：快速查看数据库概览

**使用**：
```bash
node db-info.js
```

**输出包含**：
- 📈 总订单数、总收入、平均单价
- 💾 数据库文件大小
- 📋 最近 5 条订单

**优点**：快速、简洁、无需交互

---

### 2️⃣ **db-manager.js** - 完整数据库管理工具

**用途**：查看、搜索、导出数据库

**交互式使用**：
```bash
node db-manager.js
```

**命令行使用**：

| 命令 | 说明 | 示例 |
|------|------|------|
| `view` | 查看所有订单 | `node db-manager.js view` |
| `stats` | 查看统计 | `node db-manager.js stats` |
| `recent N` | 最近 N 条 | `node db-manager.js recent 20` |
| `get ID` | 查看订单详情 | `node db-manager.js get 5` |
| `search 关键词` | 搜索订单 | `node db-manager.js search 豆豆` |
| `export-json` | 导出 JSON | `node db-manager.js export-json` |
| `export-csv` | 导出 CSV | `node db-manager.js export-csv` |
| `clear` | 清空所有 | `node db-manager.js clear` ⚠️ |
| `reset-stats` | 重置统计 | `node db-manager.js reset-stats` ⚠️ |

**常用示例**：
```bash
# 查看所有订单
node db-manager.js view

# 查看最近 10 条
node db-manager.js recent 10

# 查看某个订单详情
node db-manager.js get 5

# 搜索某个玩家
node db-manager.js search 豆豆

# 备份数据
node db-manager.js export-json
```

---

### 3️⃣ **db-edit.js** - 编辑数据工具

**用途**：修改订单、删除订单、编辑统计

**使用**：
```bash
node db-edit.js
```

**支持操作**：
1. 查看所有订单
2. 修改订单单号 ✏️
3. 删除特定订单 🗑️
4. 编辑统计数据 📊

**安全特性**：
- 修改前显示当前数据
- 修改前需要确认
- 所有操作都有日志

---

### 4️⃣ **db.ps1** - Windows PowerShell 脚本快捷方式

**用途**：Windows 用户快速访问所有工具

**使用**：
```powershell
.\db.ps1 [命令] [参数]
```

**可用命令**：
```powershell
.\db.ps1 info              # 数据库信息
.\db.ps1 manager           # 进入管理器
.\db.ps1 view              # 查看所有订单
.\db.ps1 stats             # 查看统计
.\db.ps1 recent 20         # 最近 20 条
.\db.ps1 get 5             # ID 为 5 的订单
.\db.ps1 search 豆豆       # 搜索玩家
.\db.ps1 backup-json       # 导出 JSON
.\db.ps1 backup-csv        # 导出 CSV
.\db.ps1 backup            # 导出所有
.\db.ps1 help              # 显示帮助
```

---

## 🎯 常见使用场景

### 场景 1：检查数据库状态
```bash
# 最快的方法
node db-info.js
```

### 场景 2：查找特定玩家的订单
```bash
# 使用搜索功能
node db-manager.js search 豆豆
```

### 场景 3：查看某个订单的完整信息
```bash
# 按 ID 查看
node db-manager.js get 5
```

### 场景 4：修改订单单号
```bash
# 进入编辑工具
node db-edit.js
# 选择 "2" 修改订单单号
```

### 场景 5：删除错误的订单
```bash
# 进入编辑工具
node db-edit.js
# 选择 "3" 删除订单
```

### 场景 6：备份数据
```bash
# 导出为 JSON（包含所有数据）
node db-manager.js export-json

# 导出为 CSV（可用 Excel 打开）
node db-manager.js export-csv

# PowerShell 一键备份
.\db.ps1 backup
```

### 场景 7：重置统计数据
```bash
# 进入编辑工具
node db-edit.js
# 选择 "4" 编辑统计数据

# 或使用管理器
node db-manager.js reset-stats
```

---

## 📊 工具对比

| 功能 | db-info | db-manager | db-edit | db.ps1 |
|------|---------|-----------|---------|--------|
| 快速查看 | ✅ | ✅ | ❌ | ✅ |
| 详细信息 | ⭐ | ✅ | ✅ | ✅ |
| 搜索功能 | ❌ | ✅ | ❌ | ✅ |
| 修改数据 | ❌ | ⚠️ | ✅ | ⚠️ |
| 导出数据 | ❌ | ✅ | ❌ | ✅ |
| 交互式 | ❌ | ✅ | ✅ | ❌ |
| 命令行 | ✅ | ✅ | ❌ | ✅ |

---

## 🔐 安全建议

### ✅ 安全操作
- ✅ 查看数据（info, view, get, search）
- ✅ 导出数据（export-json, export-csv）

### ⚠️ 需谨慎的操作
- ⚠️ 修改订单单号（修改前显示当前数据）
- ⚠️ 删除订单（需要确认）
- ⚠️ 编辑统计数据（需要确认）

### 🚨 危险操作
- 🚨 清空所有订单（需要确认，不可撤销）
- 🚨 重置统计数据（需要确认，不可撤销）

### 💡 备份建议
```bash
# 定期运行
node db-manager.js export-json

# 保存到安全位置
cp backup_*.json /backup/location/
```

---

## 📋 订单信息字段说明

```
ID          - 订单唯一标识符
type        - 订单类型 (report/gift/dispatch 等)
boss        - 老板/发单者名称
player      - 陪玩者名称
orderType   - 订单类别 (如：永劫、原神)
duration    - 陪玩时长 (如：1小时)
amount      - 金额数值
date        - 订单日期时间
source      - 数据来源 (表单提交/系统派单等)
orderNo     - 订单编号/单号
createdAt   - 系统创建时间
```

---

## 🆘 故障排除

### 问题：找不到数据库
```bash
# 确保在正确目录
cd "\\zx\Excel\陪玩"

# 检查是否存在
dir data.db
```

### 问题：权限错误
```bash
# 确保有写入权限
# Windows: 以管理员身份运行 PowerShell

# 或者检查文件权限
dir data.db
```

### 问题：数据未更新
```bash
# 重新初始化数据库
node migrate.js

# 检查数据库文件大小是否增加
dir data.db
```

### 问题：导出失败
```bash
# 检查磁盘空间
# 检查写入权限
# 尝试手动导出
node db-manager.js export-json
```

---

## 📚 更多信息

详细文档请查看：[DATABASE_GUIDE.md](DATABASE_GUIDE.md)

---

**提示**：所有查询操作都是安全的，不会修改数据！✅

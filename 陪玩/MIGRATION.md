# JSON 转 SQLite 迁移指南

## 🎯 概述
本项目已从 JSON 文件存储升级为 SQLite 数据库。这提供了更好的性能、数据完整性和可扩展性。

## 📋 迁移步骤

### 1️⃣ 安装依赖
```bash
npm install
```

### 2️⃣ 执行迁移脚本
首次启动前，运行迁移脚本将现有 JSON 数据导入 SQLite：
```bash
node migrate.js
```

**输出应该类似于：**
```
✅ 数据库连接成功
✅ orders 表已创建/存在
✅ stats 表已创建/存在
✅ stats 数据已初始化
🚀 开始迁移数据...
📋 迁移订单数据...
✅ 已导入 32 条订单记录
📊 迁移统计数据...
✅ 已导入统计数据 - 订单数: 32, 收入: 1569
✨ 迁移完成！
```

### 3️⃣ 启动应用
```bash
node index.js
```

数据库将在应用启动时自动初始化（如果还未创建的话）。

## 📊 数据库结构

### orders 表
存储所有订单和报备记录：
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  type TEXT,           -- 订单类型: report, gift, renew_report
  boss TEXT,           -- 老板名字
  player TEXT,         -- 陪玩者名字
  orderType TEXT,      -- 订单详细类型（如：永劫、原神等）
  duration TEXT,       -- 陪玩时长
  amount INTEGER,      -- 金额
  date TEXT,           -- 日期
  source TEXT,         -- 来源: reportForm, giftReportForm, renewReportForm
  orderNo TEXT,        -- 单号（可选）
  createdAt DATETIME   -- 创建时间
)
```

### stats 表
存储统计数据：
```sql
CREATE TABLE stats (
  id INTEGER PRIMARY KEY,
  totalOrders INTEGER,      -- 总订单数
  totalRevenue INTEGER,      -- 总收入
  lastUpdated DATETIME       -- 最后更新时间
)
```

## 🔄 重要变更

### 代码中的改变
- ❌ `readJSON(ORDERS_PATH)` → ✅ `await db.getAllOrders()`
- ❌ `writeJSON(ORDERS_PATH, data)` → ✅ `await db.addOrder(data)`
- ❌ `readStats()` → ✅ `await db.getStats()`
- ❌ `resetStatsCounts()` → ✅ `await db.updateStats(0, 0)`

### 新增数据库方法
- `db.getLastReportWithoutOrderNo()` - 获取最后一条未填写单号的报备
- `db.updateOrderNumber(id, orderNo)` - 更新订单单号
- `db.queryOrders(filter)` - 高级查询（支持过滤条件）

## ✨ 优势

| 功能 | JSON | SQLite |
|------|------|--------|
| 性能 | ⚠️ 较慢（大文件） | ✅ 快速 |
| 数据完整性 | ⚠️ 易损坏 | ✅ 强大 |
| 并发操作 | ⚠️ 有风险 | ✅ 安全 |
| 复杂查询 | ❌ 困难 | ✅ 容易 |
| 数据分析 | ⚠️ 需自己解析 | ✅ 原生支持 |

## 📁 文件说明

- **db.js** - SQLite 数据库模块，包含所有数据库操作
- **migrate.js** - 迁移脚本，用于从 JSON 导入数据
- **data.db** - 生成的 SQLite 数据库文件（自动创建）
- **index.js** - 更新后的主应用文件，使用数据库模块

## ⚠️ 备份建议

迁移前建议备份原始的 JSON 文件：
```bash
# 备份原文件
cp orders.json orders.json.backup
cp stats.json stats.json.backup
```

## 🐛 故障排除

### 问题：数据库文件损坏
**解决方案：** 删除 `data.db` 并重新运行迁移脚本
```bash
rm data.db
node migrate.js
```

### 问题：导入数据失败
**检查：** 原始 JSON 文件格式是否正确，可使用在线 JSON 验证器检查

### 问题：权限错误
**解决方案：** 确保有写入权限
```bash
# Windows: 以管理员身份运行
# Linux/Mac: 检查文件夹权限
chmod 755 .
```

## 📞 支持
如有任何问题，请检查 console 输出的错误信息。所有数据库操作都会输出详细的日志。

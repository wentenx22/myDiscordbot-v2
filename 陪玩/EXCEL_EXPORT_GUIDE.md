# SQLite 数据导出为 Excel 指南

## 📋 概述
本项目支持直接从SQLite数据库导出所有数据到Excel文件，包括报备记录和派单记录。

## 🚀 使用方法

### 方法1：使用导出脚本（推荐）
```bash
# 进入陪玩目录
cd 陪玩

# 运行导出脚本（默认文件名）
node export-to-excel.js

# 或指定自定义文件名
node export-to-excel.js 我的订单统计.xlsx
```

**输出：**
- 生成的Excel文件会保存在 `陪玩/tmp/` 目录中
- 包含多个Sheet页：
  - **报备记录** - 所有的报备数据
  - **派单记录** - 所有的派单数据
  - **汇总统计** - 统计信息

### 方法2：使用Discord Bot命令（在线）
在Discord中使用以下命令：

```
/db export
```
Bot会自动生成Excel文件并发送到指定频道。

### 方法3：在Node.js脚本中调用
```javascript
const db = require('./db');
const exporter = require('./exporter');

async function exportData() {
  await db.init();
  const orders = db.getAllOrders();
  
  // 导出单个Sheet
  const filePath1 = exporter.exportToExcel(orders);
  
  // 导出多个Sheet
  const filePath2 = exporter.exportToExcelMultiSheet(orders);
}

exportData().catch(err => console.error(err));
```

## 📊 Excel文件结构

### 报备记录 Sheet
| 序号 | 类型 | 报备类型 | 老板 | 陪陪 | 单子类型 | 时长 | 金额 | 单号 | 报备时间 |
|------|------|--------|------|------|--------|------|------|------|---------|
| 1 | 单子报备 | 新单 | 老板名 | 陪玩员 | 游戏名 | 2小时 | 100 | PO-xxx | 2025-01-04 |

### 派单记录 Sheet
| 序号 | 单号 | 派单员 | 陪玩员 | 游戏 | 时长 | 价格 | 派单时间 |
|------|------|--------|--------|------|------|------|---------|
| 1 | PO-xxx | 派单员 | 陪玩员 | 游戏名 | 2小时 | 100 | 2025-01-04 |

## 🔍 数据库表结构

### orders 表
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,                    -- 'report' 或 'ticket'
  boss TEXT,                    -- 报备者
  player TEXT,                  -- 陪玩员
  assigner TEXT,                -- 派单员
  orderType TEXT,               -- 单子类型（游戏）
  game TEXT,                    -- 游戏名
  duration TEXT,                -- 时长
  amount REAL,                  -- 金额/价格
  price REAL,                   -- 价格
  date TEXT,                    -- 时间戳
  orderNo TEXT,                 -- 订单号
  source TEXT,                  -- 来源
  source_channel TEXT,          -- 来源频道
  customer TEXT,                -- 客户ID
  originalOrder TEXT,           -- 原始订单
  createdAt TEXT                -- 创建时间
);
```

## 💾 导出的文件位置
所有导出的Excel文件默认保存在：
```
陪玩/tmp/
```

例如：
- `陪玩/tmp/完整数据导出_2025-01-04.xlsx`
- `陪玩/tmp/单子统计_2025-01-04.xlsx`

## ✨ 功能特性

✅ **智能导出**
- 自动分离报备和派单记录
- 中文列名，易于理解
- 格式化的日期和金额

✅ **多Sheet支持**
- 可在同一个Excel文件中包含多个工作表
- 每个Sheet都有优化的列宽设置

✅ **灵活配置**
- 支持自定义文件名
- 支持指定输出目录
- 支持多种导出格式（Excel/JSON）

## 🐛 故障排除

### 问题：导出失败，提示 "数据为空"
**解决：** 确保SQLite数据库中有数据
```bash
# 检查数据库是否存在
ls -la 陪玩/data.db

# 如果没有，可以通过Bot添加一些测试数据
```

### 问题：Excel文件乱码
**解决：** 使用UTF-8编码打开文件，或在Excel中设置编码

### 问题：找不到 export-to-excel.js
**解决：** 确保文件在 `陪玩/` 目录中

## 📈 示例输出
```
📊 开始从SQLite导出数据到Excel...

⏳ 初始化数据库...
✅ 数据库已初始化

📋 正在读取SQLite数据...
✅ 获取到 50 条记录

📊 数据统计:
  - 报备记录: 30 条
  - 派单记录: 20 条
  - 总计: 50 条

💾 正在生成Excel文件...

✅ 导出成功！
📁 文件位置: C:\Users\Zx\Desktop\myDiscordbot\陪玩\tmp\完整数据导出_2025-01-04.xlsx
```

## 📞 需要帮助？
如有问题，请检查：
1. Node.js版本是否 >= 12
2. 是否安装了依赖：`npm install`
3. SQLite数据库文件是否存在
4. 文件权限是否正确

---
**最后更新:** 2025-01-04

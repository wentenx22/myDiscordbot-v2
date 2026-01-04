# 数据合并迁移指南

## 📋 概述
这个迁移脚本将把 `orders.json` 中的所有数据合并到 SQLite 数据库中，实现数据统一存储。

## 🚀 使用方法

### 运行迁移脚本
```bash
cd 陪玩
node migrate-and-merge.js
```

### 迁移过程
1. **读取orders.json** - 获取所有JSON数据
2. **读取SQLite** - 获取数据库中的现有数据
3. **去重合并** - 根据orderNo去除重复数据
4. **导入数据** - 将新数据导入到SQLite
5. **备份清空** - 备份orders.json并清空它

## 🔍 迁移规则

### 重复检测
- 使用 `orderNo`（订单号）作为唯一标识
- 如果两条记录的orderNo相同，则认为是重复
- SQLite中已有的数据优先保留，JSON中的新数据才会导入

### 处理流程
```
SQLite数据（100条）
    ↓
合并到Map中
    ↓
添加orders.json数据
    ↓
如果orderNo不存在 → 导入为新数据
如果orderNo已存在 → 标记为重复，跳过
    ↓
将新数据插入SQLite
    ↓
备份orders.json → 清空orders.json
    ↓
数据统一存储完成 ✅
```

## 📊 示例输出
```
📊 开始合并orders.json和SQLite数据...

⏳ 初始化数据库...
✅ 数据库已初始化

📖 读取orders.json...
✅ 获取到 50 条JSON数据

📖 读取SQLite数据...
✅ 获取到 30 条SQLite数据

🔄 进行去重和合并...
  SQLite数据 - 30 条
  [新增] 导入: PO-20251215-0001
  [新增] 导入: PO-20251215-0002
  [重复] 跳过: PO-20251215-0003

📊 合并结果:
  - 新增数据: 47 条
  - 重复数据: 3 条
  - 合并后总数: 77 条

💾 导入新数据到SQLite...
✅ 成功导入 47 条新数据

✅ 数据库已保存

📦 备份orders.json...
✅ 备份已保存: C:\...\orders_backup.json

🧹 清空orders.json...
✅ orders.json已清空

📈 最终数据统计:
  - 报备记录: 45 条
  - 派单记录: 32 条
  - 总计: 77 条

✨ 合并完成！所有数据现已统一存储在SQLite数据库中。
```

## ⚠️ 注意事项

### 迁移前
- ✅ 确保data.db存在
- ✅ 确保orders.json存在
- ✅ 备份重要数据（脚本会自动备份）

### 迁移后
- ✅ orders.json会被清空（数据已合并到SQLite）
- ✅ 自动生成backup `orders_backup.json`
- ✅ SQLite数据库现在是唯一的数据源

## 🔄 后续操作

### 继续使用Bot
- Bot会继续往SQLite中添加新数据
- 不再产生orders.json数据
- 所有数据统一在SQLite中管理

### 导出数据
```bash
# 导出为Excel
node export-to-excel.js
```

### 查询数据
```bash
# 在Discord中使用
/db 查询
/datacenter 统计
```

## 🐛 故障排除

### 问题：迁移失败，提示"数据库错误"
**解决：** 确保data.db文件未被其他程序占用

### 问题：合并后数据丢失
**解决：** 检查orders_backup.json中是否有数据备份

### 问题：重复数据太多
**解决：** 检查orderNo字段是否正确填写

## 📈 数据统计

迁移后可以使用这些命令查询统计数据：

```javascript
// 获取所有订单
const orders = db.getAllOrders();

// 按类型过滤
const reports = orders.filter(o => o.type === 'report');
const tickets = orders.filter(o => o.type !== 'report');

// 统计
console.log(`报备: ${reports.length}, 派单: ${tickets.length}`);
```

## ✨ 迁移完成后的优势

✅ **数据统一** - 所有数据在一个SQLite数据库中
✅ **性能提升** - 数据库查询更快
✅ **自动备份** - 脚本自动备份原JSON文件
✅ **去重合并** - 自动处理重复数据
✅ **易于维护** - 一个数据源，管理更简单

---
**最后更新:** 2025-01-04

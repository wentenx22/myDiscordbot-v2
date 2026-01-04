# 导出功能重构总结 - SQLite CSV 统一方案

## 📋 概述

完成了 Discord Bot 的全面导出功能重构，删除所有基于 `orders.json` 的 Excel 导出逻辑，统一改为使用 **SQLite 数据库** 作为唯一数据源，配合 **SQLite CLI** 的 CSV 导出能力。

## 🔄 重构内容

### 1. 新增模块：`sqlite-exporter.js`
- **功能**：使用 SQLite CLI 实现 CSV 导出
- **导出方法**：`sqlite3 data.db ".mode csv" ".output file.csv" "SELECT * FROM orders;"`
- **关键函数**：
  - `exportToCSV(filename)` - 导出单表 CSV
  - `exportMultiTableToCSV(filename)` - 多表导出（保留用于扩展）
  - `deleteFileAsync(filePath, delayMs)` - 异步删除临时文件
  - `getFileStats(filePath)` - 获取文件信息

### 2. 重构的导出按钮（共5处）

#### ✅ 按钮1：`datacenter_export_excel` - 数据管理中心导出
- **变化**：`exporter.exportToExcelMultiSheet()` → `sqliteExporter.exportToCSV()`
- **数据源**：`statistics.loadOrdersData()` → `db.getAllOrders()`
- **格式**：Excel → CSV
- **文件名**：`单子统计_YYYY-MM-DD.csv`

#### ✅ 按钮2：`export_excel` - 单子统计导出
- **变化**：`exporter.exportToExcelMultiSheet()` → `sqliteExporter.exportToCSV()`
- **数据源**：`orders.json` (fs.readFileSync) → `db.getAllOrders()`
- **格式**：Excel → CSV
- **文件名**：`单子统计_YYYY-MM-DD.csv`

#### ✅ 按钮3：`db_export_excel` - 订单中心导出
- **变化**：`exporter.exportToExcelMultiSheet()` → `sqliteExporter.exportToCSV()`
- **数据源**：`orders.json` (fs.readFileSync) → `db.getAllOrders()`
- **格式**：Excel → CSV
- **文件名**：`订单数据_YYYY-MM-DD.csv`

#### ✅ 按钮4：`datacenter_export_telegram` - Telegram导出（数据管理中心）
- **变化**：`exporter.exportExcelMultiSheetToTelegram()` → 使用 `axios` + `FormData` 发送 CSV
- **数据源**：`statistics.loadOrdersData()` → `db.getAllOrders()`
- **格式**：Excel → CSV
- **集成**：使用 Telegram Bot API 的 `sendDocument` 端点

#### ✅ 按钮5：`export_telegram` - Telegram导出（单子统计）
- **变化**：`exporter.exportExcelMultiSheetToTelegram()` → 使用 `axios` + `FormData` 发送 CSV
- **数据源**：`orders.json` (fs.readFileSync) → `db.getAllOrders()`
- **格式**：Excel → CSV
- **集成**：使用 Telegram Bot API 的 `sendDocument` 端点

### 3. 保留的功能：JSON 导出
- **按钮**：`db_export_json`
- **状态**：✅ 已更新数据源从 `orders.json` 到 `db.getAllOrders()`
- **格式**：保留 JSON 格式（用于备份）
- **模块**：继续使用 `exporter.exportToJSON()`

## 📊 数据流程对比

### 旧流程（已删除）
```
orders.json 或 statistics.loadOrdersData()
    ↓
exporter.exportToExcelMultiSheet()
    ↓
生成 .xlsx 文件
    ↓
发送给 Discord/Telegram
    ↓
删除临时文件
```

### 新流程（现在实施）
```
db.getAllOrders() 来自 SQLite(data.db)
    ↓
sqliteExporter.exportToCSV()
    ↓
使用 sqlite3 CLI: .mode csv + .output
    ↓
生成 .csv 文件
    ↓
发送给 Discord/Telegram
    ↓
5秒后删除临时文件
```

## 🗑️ 删除的依赖

以下函数不再使用，但 `exporter.js` 仍保留以支持 JSON 导出：
- `exportToExcelMultiSheet()` ✗
- `exportExcelMultiSheetToTelegram()` ✗
- 所有 Excel 生成相关的 XLSX 库调用

## 📦 文件变更

### 新增
- `sqlite-exporter.js` - SQLite CLI CSV导出模块（111行）

### 修改
- `index.js` - 重构5个按钮的导出逻辑（+200行, -87行）
- 保持不变：
  - `db.js` - SQLite 数据库管理（已支持 `getAllOrders()`）
  - `statistics.js` - 数据分析模块（已改为优先 SQLite）
  - `exporter.js` - 保留用于 JSON 导出

## 🔧 技术细节

### SQLite CSV 导出命令
```bash
sqlite3 data.db ".mode csv" ".output filename.csv" "SELECT * FROM orders;"
```

### Telegram CSV 上传流程
```javascript
const form = new FormData();
form.append('chat_id', chatId);
form.append('document', fs.createReadStream(filePath), fileName);
form.append('caption', messageText);
form.append('parse_mode', 'HTML');
await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form);
```

## ✅ 验证清单

- [x] 所有 Excel 导出按钮已重构为 CSV
- [x] 数据源统一为 SQLite (`db.getAllOrders()`)
- [x] 删除了所有 `orders.json` 直接读取操作
- [x] CSV 文件导出功能测试
- [x] Discord 附件发送测试
- [x] Telegram 文件上传测试
- [x] 临时文件自动清理测试
- [x] JSON 导出功能保留并测试
- [x] Git 提交和推送

## 📝 提交信息
```
refactor: 统一所有导出功能使用SQLite CSV格式而非Excel

- 删除所有基于 orders.json 的Excel导出逻辑
- 创建 sqlite-exporter.js 模块实现SQLite CLI CSV导出
- 修改以下导出按钮使用SQLite作为唯一数据源:
  - datacenter_export_excel: 数据管理中心导出
  - db_export_excel: 订单中心导出
  - export_excel: 单子统计导出
  - datacenter_export_telegram: Telegram导出（数据管理中心）
  - export_telegram: Telegram导出（单子统计）
- CSV文件通过Discord/Telegram发送后自动删除（5秒延迟）
- 保留JSON导出功能用于备份（已从SQLite读取）
```

## 🎯 后续优化建议

1. **可选**：删除 `exporter.js` 中的 Excel 相关代码，只保留 JSON 导出逻辑
2. **可选**：在 `sqlite-exporter.js` 中添加更多的 SQL 查询选项（如按日期范围、订单类型等）
3. **监控**：定期检查临时文件清理是否正常工作
4. **文档**：更新 README.md 中的导出功能说明

## 💾 数据备份

当前 SQLite 数据库包含：
- **记录数**：33 条（经过去重处理）
- **日期范围**：2025-12-15 ~ 2026-01-02
- **数据类型**：报备记录 + 派单记录
- **备份位置**：`陪玩/data.db`

JSON 导出仍可用于额外备份。

---

**重构完成时间**：2026-01-XX  
**状态**：✅ 已推送到 GitHub (commit: a51d4e2)

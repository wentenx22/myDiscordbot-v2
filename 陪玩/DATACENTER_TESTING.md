# 🧪 数据管理中心 - 快速测试指南

## 前置检查

在运行任何测试之前，请确保：

```bash
# 1. 检查 orders.json 是否存在且包含数据
ls -la orders.json

# 2. 检查 config.json 是否有完整配置
cat config.json | grep -E "(token|clientId|telegramToken|telegramChatId)"

# 3. 启动Bot
node index.js
```

## 测试流程 (按顺序)

### 测试 1️⃣ : 主命令执行
**命令:** `/datacenter`

**预期结果:**
- ✅ 立即显示一个Embed
- ✅ 标题: "📊 数据管理中心"
- ✅ 两个字段: "📈 数据概览" 和 "⚠️ 数据质量"
- ✅ 显示数据统计 (报备数、派单数、金额等)
- ✅ 显示两行按钮 (共6个按钮)

**问题排查:**
```
如果看不到按钮:
  → 检查 Discord 权限
  → 检查 index.js 中的 ActionRowBuilder 和 ButtonBuilder

如果看不到数据:
  → 确认 orders.json 存在且有数据
  → 检查 statistics.loadOrdersData() 是否正确
```

---

### 测试 2️⃣ : 导出 Excel
**步骤:** 
1. 执行 `/datacenter`
2. 点击 "📥 导出 Excel" 按钮

**预期结果:**
- ✅ Bot 显示 "已导出..." 消息
- ✅ 弹出下载对话框 (文件名包含日期)
- ✅ Excel 文件包含两个Sheet标签页:
  - "报备记录" (10列: 序号, 类型, 报备类型, 老板, 陪陪, 单子类型, 时长, 金额, 单号, 报备时间)
  - "派单记录" (8列: 序号, 单号, 派单员, 陪玩员, 游戏, 时长, 价格, 派单时间)

**问题排查:**
```
如果出现错误 "StringSelectMenuBuilder is not defined":
  → 已修复！确保 index.js 导入了 StringSelectMenuBuilder
  → 检查第17行是否有: StringSelectMenuBuilder,

如果 Excel 为空:
  → 检查 orders.json 中是否真的有数据
  → 运行: cat orders.json | head -50

如果 Excel 列数不对:
  → 检查 exporter.js 中的 exportToExcelMultiSheet 函数
```

---

### 测试 3️⃣ : 查看排行
**步骤:**
1. 执行 `/datacenter`
2. 点击 "📊 查看排行" 按钮

**预期结果:**
- ✅ 显示排行榜Embed
- ✅ 三个字段: "派单员排行", "陪玩员排行", "老板排行"
- ✅ 每个排行显示 Top 10 (或所有不足10条)
- ✅ 格式: "N. 名称: RM 金额 (条数)"

**示例输出:**
```
🏆 派单员排行 (Top 10)
1. Alice: RM 5000.00 (25单)
2. Bob: RM 4500.00 (20单)
...

⭐ 陪玩员排行 (Top 10)
1. Player1: RM 8000.00
2. Player2: RM 7500.00
...

👑 老板排行 (Top 10)
1. Boss1: RM 10000.00 (50单)
2. Boss2: RM 9000.00 (45单)
...
```

**问题排查:**
```
如果显示 "暂无数据":
  → orders.json 可能为空或格式不对
  → 检查数据结构

如果排行顺序错误:
  → 检查 statistics.js 中的 sort() 函数
  → 应该按 totalPrice 从大到小排序
```

---

### 测试 4️⃣ : 数据检查
**步骤:**
1. 执行 `/datacenter`
2. 点击 "🔍 数据检查" 按钮

**预期结果 (3种可能):**

**情况A - 数据完整:**
- ✅ 显示绿色Embed (颜色: 0x51cf66)
- ✅ 内容: "✅ 恭喜！数据完整无误～"

**情况B - 有问题:**
- ✅ 显示红色Embed (颜色: 0xff6b6b)
- ✅ 问题项 (⚠️) 例如:
  - "⚠️ 5条报备记录缺少单号"
  - "⚠️ 3个重复的单号"

**情况C - 有提醒:**
- ✅ 显示黄色Embed
- ✅ 提醒项 (📌) 例如:
  - "📌 2条报备记录缺少老板信息"
  - "📌 1条记录金额为零"

**问题排查:**
```
如果一直显示错误:
  → 检查 statistics.performDataQualityCheck() 实现
  → 查看控制台错误日志 (console.error)

如果没有检测到实际存在的问题:
  → 检查数据质量检查的逻辑
  → 验证字段名是否匹配 orders.json 结构
```

---

### 测试 5️⃣ : 时间筛选
**步骤:**
1. 执行 `/datacenter`
2. 点击 "📅 时间筛选" 按钮
3. 从菜单中选择时间范围 (例如: "最近7天")

**预期结果:**
- ✅ 显示时间范围统计Embed
- ✅ 包含该时间范围内的:
  - 报备数、金额、时长
  - 派单数、金额、时长
  - 派单员和陪玩员Top 5排行
- ✅ 显示两个按钮: "📥 导出 Excel" 和 "🔄 返回主面板"

**时间范围说明:**
```
选项           | 范围              | 用途
今天           | 当天 00:00-23:59  | 每日统计
最近7天        | 过去7天           | 周度统计
最近30天       | 过去30天          | 月度统计
全部数据       | 全历史            | 全面统计
```

**问题排查:**
```
如果菜单不显示:
  → 检查 StringSelectMenuBuilder 是否正确导入
  → 检查代码 line ~1589

如果显示 "暂无数据":
  → 该时间范围确实没有数据
  → 试试选择"全部数据"

如果导出后文件为空:
  → 缓存可能过期 (5分钟)
  → 重新选择时间范围后再试
```

---

### 测试 6️⃣ : Telegram 导出
**步骤:**
1. 执行 `/datacenter`
2. 点击 "✈️ 发送到飞机" 按钮

**预期结果:**
- ✅ Bot 显示 "已导出至 Telegram～" 消息
- ✅ 配置的Telegram频道收到Excel文件

**前置条件:**
```json
config.json 中需要有:
{
  "telegramToken": "YOUR_BOT_TOKEN",
  "telegramChatId": "CHANNEL_ID",
  "telegramMessageThreadId": "THREAD_ID (可选)"
}
```

**问题排查:**
```
如果提示错误 "TELEGRAM TOKEN NOT FOUND":
  → config.json 中缺少 telegramToken
  → 添加有效的 Telegram Bot Token

如果提示错误 "CHAT ID NOT FOUND":
  → config.json 中缺少 telegramChatId
  → 使用 @userinfobot 获取频道ID

如果文件没有发送到Telegram:
  → 检查网络连接
  → 验证Token和ChatId是否有效
  → 查看控制台错误信息
```

---

### 测试 7️⃣ : 刷新按钮
**步骤:**
1. 执行 `/datacenter`
2. 稍微修改 orders.json (例如: 改变一个金额)
3. 点击 "🔄 刷新" 按钮

**预期结果:**
- ✅ 面板数据更新到最新
- ✅ 时间戳更新为最新时间
- ✅ 所有统计数字重新计算

**问题排查:**
```
如果刷新后数据没有变化:
  → orders.json 修改可能没有保存
  → 检查文件修改时间: ls -la orders.json

如果显示错误:
  → 检查 statistics.loadOrdersData() 是否能正确读取更新的数据
```

---

## 高级测试场景

### 测试 8️⃣ : 大数据量处理
**场景:** orders.json 包含 1000+ 条记录

**测试步骤:**
```bash
# 生成测试数据 (可选)
# 编写脚本添加大量测试数据到 orders.json

# 执行各个功能
1. /datacenter
2. 导出 Excel (检查是否卡顿)
3. 查看排行 (检查性能)
4. 时间筛选 (检查响应时间)
```

**预期结果:**
- ✅ 所有操作在5秒内完成
- ✅ 不会导致Bot无响应
- ✅ 内存占用不超过正常水平

---

### 测试 9️⃣ : 边界情况
**场景 1:** orders.json 为空

**测试:**
```
/datacenter
→ 应该显示: 统计全为0
→ 查看排行 → 应该显示: "暂无"
→ 导出Excel → 应该提示: "暂无数据可导出"
```

**场景 2:** 所有记录都缺少某个字段

**测试:**
```
/datacenter
→ 数据检查 → 应该列出缺失字段
→ 排行榜 → 应该显示"未知"或"未指定"
```

**场景 3:** 重复的订单号

**测试:**
```
/datacenter
→ 数据检查 → 应该显示重复单号警告
```

---

## 故障排查 Checklist

```
常见问题检查清单:

[ ] 模块导入
  [ ] StringSelectMenuBuilder 已导入
  [ ] statistics 模块已导入
  [ ] exporter 模块已导入

[ ] 数据源
  [ ] orders.json 存在
  [ ] orders.json 有有效数据
  [ ] 数据格式正确 (JSON)

[ ] 配置
  [ ] config.json 存在
  [ ] token, clientId 有效
  [ ] telegramToken, telegramChatId 配置 (可选)

[ ] 权限
  [ ] Bot 有 Administrator 权限
  [ ] 使用者是 Administrator

[ ] 代码
  [ ] 没有语法错误
  [ ] 所有函数都已导出
  [ ] 所有交互ID正确拼写

[ ] 运行
  [ ] Bot 正常启动
  [ ] 没有 uncaught exception
  [ ] 控制台显示初始化成功
```

---

## 控制台日志解读

### 正常启动
```
✅ [启动] index.js 正在加载...
✅ [启动] config.json 读取成功
✅ [启动] config 字段验证成功
✅ Slash 指令注册成功
✅ [Bot已上线] 成功登录为 YourBotName
```

### 执行 /datacenter 时的日志
```
[/datacenter] 用户执行命令
[statistics] 加载数据: X条
[statistics] 计算统计...
[statistics] 数据质量检查...
✅ 主面板已发送
```

### 导出 Excel 时的日志
```
[exporter] 规范化报备记录...
[exporter] 规范化派单记录...
[exporter] 生成Excel: file_YYYYMMDD.xlsx
✅ 文件已清理
```

---

## 最终检查清单

在部署到生产环境前，请确保：

- [x] 所有6个主要功能都能正常工作
- [x] Excel导出包含正确的数据
- [x] 排行榜显示Top 10
- [x] 数据质量检查发现问题
- [x] 时间筛选正确过滤数据
- [x] Telegram导出成功发送 (如启用)
- [x] 刷新功能更新最新数据
- [x] 所有错误都有详细提示
- [x] 没有控制台错误警告
- [x] 文档完整可用

**一切就绪？✅ 可以投入生产！**


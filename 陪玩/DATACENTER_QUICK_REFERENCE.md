# 📌 数据管理中心 - 快速参考卡

## 🚀 快速启动

```bash
# 1. 确保依赖安装
npm install discord.js xlsx axios

# 2. 启动Bot
node index.js

# 3. 在Discord中使用
/datacenter
```

---

## 📊 主要功能速览

| 功能 | 命令/按钮 | 效果 | 快捷键 |
|------|---------|------|--------|
| **打开管理中心** | `/datacenter` | 显示主面板 | - |
| **导出Excel** | 📥 按钮 | 下载包含两个Sheet的Excel | - |
| **查看排行** | 📊 按钮 | 显示Top 10排行榜 | - |
| **检查数据** | 🔍 按钮 | 数据质量检查 | - |
| **筛选时间** | 📅 按钮 | 时间范围筛选 | - |
| **发送Telegram** | ✈️ 按钮 | 导出到Telegram | - |
| **刷新数据** | 🔄 按钮 | 重新加载最新数据 | - |

---

## 📁 文件结构

```
陪玩/
├── index.js                          (主程序)
├── statistics.js                     (数据统计模块)
├── exporter.js                       (导出模块)
├── orders.json                       (数据源)
├── config.json                       (配置文件)
│
└── 📚 文档文件/
    ├── DATACENTER_GUIDE.md           (用户指南)
    ├── DATACENTER_API.md             (开发者参考)
    ├── DATACENTER_TESTING.md         (测试指南)
    ├── DATACENTER_VERIFICATION.md    (验证清单)
    └── DATACENTER_IMPLEMENTATION_SUMMARY.md (实现总结)
```

---

## 🔧 配置要求

### config.json 最小配置
```json
{
  "token": "YOUR_BOT_TOKEN",
  "clientId": "YOUR_CLIENT_ID",
  "adminRoleId": "ADMIN_ROLE_ID"
}
```

### 可选配置 (Telegram导出)
```json
{
  "telegramToken": "YOUR_TELEGRAM_BOT_TOKEN",
  "telegramChatId": "CHANNEL_ID",
  "telegramMessageThreadId": "THREAD_ID (可选)"
}
```

---

## 📊 数据统计字段说明

### 报备系统 (type === "report")
```
总计(count) + 金额(sum of amount) + 时长(sum of duration hours) + 缺号(count)
例: 50条 | RM 25000 | 150小时 | 3条缺号
```

### 派单系统 (type !== "report")
```
总计(count) + 金额(sum of price) + 时长(sum of duration hours) + 缺号(count)
例: 80条 | RM 40000 | 240小时 | 5条缺号
```

---

## 🎯 Excel 导出格式

### Sheet 1: 报备记录
| 序号 | 类型 | 报备类型 | 老板 | 陪陪 | 单子类型 | 时长 | 金额 | 单号 | 报备时间 |
|------|------|---------|------|------|---------|------|------|------|----------|
| 1 | 报备 | 新单 | 张三 | 玩家A | LOL | 2:00 | 100 | 001 | 2024/1/1 10:30:00 |

**报备类型规则:**
- `source === 'reportForm'` → 新单
- `source === 'renewReportForm'` → 续单
- `source === 'giftReportForm'` → 赠送

### Sheet 2: 派单记录
| 序号 | 单号 | 派单员 | 陪玩员 | 游戏 | 时长 | 价格 | 派单时间 |
|------|------|--------|--------|------|------|------|----------|
| 1 | 001 | 管理员 | 玩家A | LOL | 2:00 | 100 | 2024/1/1 10:30:00 |

---

## 🔍 数据质量检查项

### ⚠️ 问题项 (严重)
- 缺少订单号的记录
- 重复的订单号
- 其他关键数据缺失

### 📌 提醒项 (警告)
- 缺少老板信息
- 缺少陪玩员信息
- 金额为零的记录

---

## 🏆 排行榜维度

### 派单员排行
- 排序: 按派单金额 (从高到低)
- 显示: 名字 | 派单金额 | 派单数量
- 示例: "Alice: RM 5000 (25单)"

### 陪玩员排行
- 排序: 按总收入 (从高到低)
- 显示: 名字 | 总收入
- 示例: "Player1: RM 8000"

### 老板排行
- 排序: 按报备金额 (从高到低)
- 显示: 名字 | 报备金额 | 报备数量
- 示例: "Boss1: RM 10000 (50单)"

---

## ⏰ 时间筛选选项

| 选项 | 范围 | 查询场景 |
|------|------|---------|
| **今天** | 当天 00:00-23:59 | 每日回顾 |
| **最近7天** | 过去7天 | 周度统计 |
| **最近30天** | 过去30天 | 月度分析 |
| **全部数据** | 所有历史记录 | 全面回顾 |

---

## 🔐 权限检查

- ✅ 执行 `/datacenter` 需要 **管理员权限**
- ✅ 所有按钮交互需要 **管理员权限**
- ✅ Bot 需要 **Administrator** 权限
- ✅ Telegram 导出需要 **有效的Token和ChatId**

---

## 🐛 常见问题快速解决

### Q: 显示 "StringSelectMenuBuilder is not defined"
**A:** 导入缺失
```javascript
// 检查 index.js 第16行
const { ..., StringSelectMenuBuilder } = require("discord.js");
```

### Q: 导出的Excel为空
**A:** 检查数据源
```bash
# 确保 orders.json 有内容
cat orders.json | head -20
```

### Q: 排行榜显示 "暂无"
**A:** 数据可能不符合条件
```
1. 检查是否真的有派单员/陪玩员/老板信息
2. 查看数据质量检查结果
3. 尝试导出Excel看具体数据
```

### Q: Telegram 导出失败
**A:** 配置检查
```json
{
  "telegramToken": "xxx", // 确保不为空
  "telegramChatId": "xxx"  // 确保是有效的频道ID
}
```

### Q: 时间筛选后无数据
**A:** 该时间范围确实无数据
```
1. 尝试选择 "全部数据"
2. 检查 orders.json 中日期格式
3. 确认数据日期与选择的时间范围匹配
```

---

## 🚀 部署检查清单

在投入生产前，请：

- [ ] 测试 `/datacenter` 命令
- [ ] 测试导出Excel功能
- [ ] 测试排行榜显示
- [ ] 测试数据质量检查
- [ ] 测试时间筛选
- [ ] 测试Telegram导出 (如启用)
- [ ] 测试刷新功能
- [ ] 检查 orders.json 有足够的测试数据
- [ ] 检查 config.json 配置完整
- [ ] 检查控制台无错误信息

---

## 📞 开发者联系信息

**遇到问题？**
1. 查看对应的文档文件
2. 检查 DATACENTER_TESTING.md 的故障排查清单
3. 查看控制台错误日志
4. 检查 orders.json 数据格式

**想扩展功能？**
1. 参考 DATACENTER_API.md 的扩展指南
2. 在 statistics.js 中添加新函数
3. 在 index.js 中添加新的交互处理器

---

## 📈 性能指标

| 操作 | 预期时间 | 大数据量表现 |
|------|---------|-------------|
| 加载数据 | < 1s | < 2s (1000+ 条) |
| 计算统计 | < 1s | < 2s |
| 生成排行 | < 1s | < 2s |
| 导出Excel | 2-5s | 5-10s |
| 数据检查 | < 2s | < 5s |
| 时间筛选 | < 1s | < 3s |

---

## 🎓 文档导航

- **想快速开始？** → DATACENTER_GUIDE.md
- **想了解所有细节？** → DATACENTER_API.md
- **想进行测试？** → DATACENTER_TESTING.md
- **想做代码审查？** → DATACENTER_VERIFICATION.md
- **想了解实现？** → DATACENTER_IMPLEMENTATION_SUMMARY.md

---

## 💡 最佳实践

### 定期检查数据质量
```
每周执行一次: /datacenter → 🔍 数据检查
确保没有缺号、缺信息等问题
```

### 按时间段分析
```
/datacenter → 📅 时间筛选
选择不同时间范围查看趋势
```

### 定期导出备份
```
/datacenter → 📥 导出 Excel
保存Excel文件作为备份记录
```

### 实时监控排行
```
/datacenter → 📊 查看排行
关注员工业绩排名变化
```

---

## 🎉 功能完成度

```
✅ 主命令实现
✅ 6个主要功能按钮
✅ 1个副菜单系统
✅ Excel导出 (两个Sheet)
✅ Telegram导出
✅ 数据质量检查
✅ 时间范围筛选
✅ 实时排行榜
✅ 完整文档

总体完成度: 100% ✨
```

---

**最后更新**: 2024年 | v1.0 正式版
**状态**: ✅ 生产就绪
**许可证**: 内部使用


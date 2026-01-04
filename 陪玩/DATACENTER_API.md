# 🎮 数据管理中心 - 交互ID参考

## 所有交互ID列表

### 🎯 主命令
| 命令 | 功能 | 权限 |
|------|------|------|
| `/datacenter` | 打开数据管理中心主面板 | 管理员 |

### 🔘 主面板按钮 (Row 1)
| ID | 按钮标签 | 功能 | 响应类型 |
|---|---------|------|---------|
| `datacenter_export_excel` | 📥 导出 Excel | 生成并下载Excel文件 | Button |
| `datacenter_ranking` | 📊 查看排行 | 显示Top 10排行榜 | Button |
| `datacenter_quality_check` | 🔍 数据检查 | 执行数据质量检查 | Button |

### 🔘 主面板按钮 (Row 2)
| ID | 按钮标签 | 功能 | 响应类型 |
|---|---------|------|---------|
| `datacenter_time_filter` | 📅 时间筛选 | 打开时间范围选择菜单 | Button |
| `datacenter_export_telegram` | ✈️ 发送到飞机 | 导出到Telegram频道 | Button |
| `datacenter_refresh` | 🔄 刷新 | 刷新数据和显示 | Button |

### 📋 时间筛选菜单
| ID | 功能 | 返回值类型 |
|---|------|-----------|
| `time_filter_select` | 时间范围选择 | StringSelectMenu |

**可选值:**
```javascript
{
  "label": "今天",
  "value": "YYYY-MM-DD_YYYY-MM-DD" // 当天
}
{
  "label": "最近7天",
  "value": "YYYY-MM-DD_YYYY-MM-DD" // 过去7天
}
{
  "label": "最近30天", 
  "value": "YYYY-MM-DD_YYYY-MM-DD" // 过去30天
}
{
  "label": "全部数据",
  "value": "all" // 无日期限制
}
```

### 🔘 筛选结果界面按钮
| ID | 按钮标签 | 功能 | 说明 |
|---|---------|------|------|
| `time_filter_export_excel` | 📥 导出 Excel | 导出筛选范围的数据 | 基于缓存 |
| `datacenter_refresh` | 🔄 返回主面板 | 返回主面板 | 重用ID |

## 全局变量缓存

### 筛选结果缓存
```javascript
global.filteredOrdersCache = []       // 筛选后的订单数据
global.filteredOrdersCacheTime = 0    // 缓存时间戳
```

**用途**: 时间筛选后导出Excel时使用，避免重复查询

## 状态流转图

```
╔─────────────────────────────────────────╗
║   用户执行 /datacenter 命令              ║
╚────────────┬────────────────────────────╝
             │
             ▼
    ┌────────────────────┐
    │   主面板Embed      │
    │ + 两行按钮菜单     │
    └────────┬───────────┘
             │
      ┌──────┴──────────────┬─────────┬──────────┬─────────────┐
      │                     │         │          │             │
      ▼                     ▼         ▼          ▼             ▼
  导出Excel            查看排行   数据检查   时间筛选      发送Telegram
  (直接生成)            (嵌入)    (嵌入)    (菜单)        (后台发送)
                                            │
                                            ▼
                                   ┌─────────────────┐
                                   │ 时间范围选择    │
                                   │ (StringSelect)  │
                                   └────────┬────────┘
                                            │
                          ┌─────────────────┼─────────────────┬──────────┐
                          │                 │                 │          │
                          ▼                 ▼                 ▼          ▼
                        今天            最近7天         最近30天      全部数据
                          │                 │                 │          │
                          └─────────────────┴─────────────────┴──────────┘
                                            │
                                            ▼
                                  ┌─────────────────────┐
                                  │ 筛选结果Embed       │
                                  │ + 导出/返回按钮     │
                                  └─────────────────────┘
```

## 代码集成点

### 在 index.js 中的位置

```javascript
// 1. 导入
const statistics = require("./statistics");  // 行~33
const exporter = require("./exporter");      // 行~32

// 2. 命令注册
const commands = [
  new SlashCommandBuilder()
    .setName("datacenter")  // 行~503-505
    ...
];

// 3. 交互处理
client.on("interactionCreate", async (interaction) => {
  
  // /datacenter 命令处理 (行~1283+)
  if (interaction.isChatInputCommand() && 
      interaction.commandName === "datacenter") { ... }
  
  // 主面板按钮处理
  - datacenter_export_excel (行~1348)
  - datacenter_ranking (行~1391)
  - datacenter_quality_check (行~1434)
  - datacenter_time_filter (行~1478)
  - datacenter_export_telegram (行~1481)
  - datacenter_refresh (行~1520)
  
  // 时间筛选菜单处理
  - time_filter_select (行~1589+)
});
```

## 错误处理

所有交互都包含完整的错误处理:

```javascript
try {
  // 功能实现
} catch (err) {
  console.error("错误描述:", err);
  await interaction.reply({
    content: `❌ 操作失败: ${err.message}`,
    ephemeral: true,  // 仅用户可见
  });
}
```

## 数据流向

```
orders.json
    │
    ├─── statistics.loadOrdersData()
    │       │
    │       ├─── calculateSummary() ──────────┐
    │       ├─── getAssignerRanking() ────────┼─► 主面板 Embed
    │       ├─── performDataQualityCheck() ───┤
    │       └─── filterByDateRange() ─────────┤
    │
    └─► exporter.exportToExcelMultiSheet()
            │
            └─► Discord / Telegram
```

## 扩展指南

### 添加新的时间筛选选项

在 `datacenter_time_filter` 处理器中的 `addOptions()`:

```javascript
{
  label: "自定义日期",
  value: "custom",
  description: "选择自定义日期范围",
}
```

### 添加新的功能按钮

1. 在主面板添加按钮:
```javascript
new ButtonBuilder()
  .setCustomId("datacenter_newfeature")
  .setLabel("🆕 新功能")
  .setStyle(ButtonStyle.Primary)
```

2. 添加处理器:
```javascript
if (interaction.isButton() && 
    interaction.customId === "datacenter_newfeature") {
  try {
    // 功能实现
  } catch (err) {
    // 错误处理
  }
  return;
}
```

## 性能提示

- 所有操作都是异步的，不会阻塞主线程
- 文件操作最后自动清理临时文件
- 缓存机制避免重复计算
- 建议在数据量>5000条时添加分页显示

## 安全提示

- ✅ 所有操作都需要管理员权限
- ✅ 文件路径使用绝对路径，防止目录遍历
- ✅ 用户输入在菜单中选择，不接受自由输入
- ✅ Telegram配置从环境变量读取，不硬编码

---

**最后更新**: 2024年
**版本**: 1.0

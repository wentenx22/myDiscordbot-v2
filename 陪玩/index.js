// =============================================================
// index.js - v4.2c-Pink (v4.2b-Pink 基础上新增：开机自动检测并发送派单统计中心面板)
// 变更说明：
// - 在 client.once("ready") 中增加自动检测 LOG_CHANNEL_ID 是否存在 "📊 派单统计中心" embed
// - 若不存在则自动发送统计 embed + 按钮（粉色可爱风）
// 其它：继承 v4.2b-Pink 的 UI 与功能（移除关键词自动回复）
// =============================================================

// ---------------- IMPORTS ----------------
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const db = require("./db");
const exporter = require("./exporter"); // 【旧版】导入导出模块
const sqliteExporter = require("./sqlite-exporter"); // 【新版】SQLite CLI导出模块
const statistics = require("./statistics"); // 【新增】导入统计模块

console.log("📌 [启动] index.js 正在加载...");

// ---------------- CONFIG ----------------
let config = {};
try {
  config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
  console.log("✅ [启动] config.json 读取成功");
  
  // 【新增】验证必填字段
  const requiredFields = ['token', 'clientId', 'telegramToken', 'telegramChatId', 'adminRoleId'];
  const missingFields = requiredFields.filter(f => !config[f]);
  if (missingFields.length > 0) {
    throw new Error(`config.json 缺少必填字段: ${missingFields.join(', ')}`);
  }
  console.log("✅ [启动] config 字段验证成功");
} catch (err) {
  console.error("❌ 配置错误:", err.message);
  process.exit(1);
}

// ---------------- CONSTANTS ----------------
const TICKET_CATEGORY_ID = "1434345592997548033";
const SUPPORT_CATEGORY_ID = "1433718201690357808";
const SUPPORT_SECOND_ROLE_ID = "1434475964963749909";
const LOG_CHANNEL_ID = "1433987480524165213"; // 统计频道
const AUTO_REPORTBB_CHANNEL = "1436684853297938452";
const DB_PANEL_CHANNEL_ID = "1456648851384438978"; // /db 面板频道

const SUPPORT_PATH = "./support_logs.json";

// 主题颜色（樱花粉）
const THEME_COLOR = 0xff99cc;

// 【修复问题 6】数据缓存机制
const cacheManager = {
  orders: null,
  lastFetchTime: 0,
  cacheDuration: 5000, // 5秒缓存
  
  async getOrders() {
    const now = Date.now();
    if (this.orders && now - this.lastFetchTime < this.cacheDuration) {
      return this.orders; // 返回缓存
    }
    this.orders = await db.getAllOrders();
    this.lastFetchTime = now;
    return this.orders;
  },
  
  invalidate() {
    this.orders = null;
    this.lastFetchTime = 0;
  }
};

// 【修复问题 8】Map 清理机制
const addOrderContext = new Map();
const addOrderContextCleanup = (key, timeout = 300000) => {
  setTimeout(() => {
    if (addOrderContext.has(key)) {
      addOrderContext.delete(key);
      console.log(`🗑️ 上下文已清理: ${key}`);
    }
  }, timeout);
};

// 【修复问题 8】Ticket Timer 清理机制
const ticketTimers = new Map();
const ticketTimerCleanup = (key) => {
  if (ticketTimers.has(key)) {
    clearTimeout(ticketTimers.get(key));
    ticketTimers.delete(key);
  }
};

// 报备频道 ID（用于消息监听）
const REPORT_CHANNEL_ID = config.reportChannelId || AUTO_REPORTBB_CHANNEL;

// ticket超时时间（24小时）
const TICKET_TIMEOUT = 24 * 60 * 60 * 1000;

// =============================================================
// JSON STORAGE UTILITIES (仅用于 support_logs.json)
// =============================================================
const initFile = (p, d) => !fs.existsSync(p) && (fs.writeFileSync(p, JSON.stringify(d, null, 2), "utf8"), console.log(`✅ 已创建 ${p}`));
const initStorage = () => initFile(SUPPORT_PATH, []);

// 【修复问题 11】改进 JSON 读取，添加详细错误日志
const readJSON = p => { 
  try { 
    if (!fs.existsSync(p)) {
      console.warn(`⚠️ 文件不存在: ${p}`);
      return null;
    }
    return JSON.parse(fs.readFileSync(p, "utf8")); 
  } catch (err) { 
    console.error(`❌ JSON 读取失败 (${p}):`, err.message);
    return null; 
  } 
};

const writeJSON = (p, d) => {
  try {
    fs.writeFileSync(p, JSON.stringify(d, null, 2), "utf8");
  } catch (err) {
    console.error(`❌ JSON 写入失败 (${p}):`, err.message);
  }
};

// 【修复问题 14】用户输入验证函数
const validateInput = (input, type = 'text', maxLen = 100) => {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().slice(0, maxLen);
  
  // 防止 Discord markdown 注入
  const sanitized = trimmed.replace(/[`~*_|\\]/g, '');
  
  if (type === 'number') {
    const num = parseInt(sanitized);
    return isNaN(num) ? null : num;
  }
  
  return sanitized || null;
};

const sanitizeName = n => String(n).toLowerCase().replace(/[^a-z0-9-]/g, "-");
const parsePrice = n => Number(String(n).replace(/[^0-9.]/g, "")) || 0;
const generateOrderNumber = () => { const d = new Date().toISOString().slice(0, 10).replace(/-/g, ""); return `PO-${d}-${Math.floor(1000 + Math.random() * 9000)}`; };
const sep = () => "━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

// =============================================================
// TELEGRAM UTILITIES
// =============================================================
// 【修复问题 10】改进 Telegram 错误处理
async function sendTelegramReport(chatId, message, threadId = null) {
  const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
  try {
    const response = await axios.post(url, {
      chat_id: chatId, 
      text: message, 
      parse_mode: "HTML",
      ...(threadId && { message_thread_id: threadId })
    });
    console.log("✅ Telegram 报表已发送!");
    return { success: true };
  } catch (err) {
    const errorDesc = err.response?.data?.description || err.message;
    const errorCode = err.response?.status || 'UNKNOWN';
    
    // 区分不同的错误类型
    if (errorDesc?.includes("TOPIC_DELETED")) {
      console.warn("⚠️ Telegram 话题已被删除，跳过发送");
      return { success: false, reason: 'TOPIC_DELETED' };
    } else if (errorCode === 429) {
      console.warn("⚠️ Telegram 限流，请稍后重试");
      return { success: false, reason: 'RATE_LIMITED' };
    } else if (errorCode === 401) {
      console.error("❌ Telegram token 无效");
      return { success: false, reason: 'INVALID_TOKEN' };
    } else {
      console.error(`❌ Telegram 发送失败 (${errorCode}):`, errorDesc);
      return { success: false, reason: 'UNKNOWN', error: errorDesc };
    }
  }
}
const sendToMultipleTelegram = (msg, t1) => sendTelegramReport(config.telegramChatId, msg, t1 || config.telegramMessageThreadId).catch(() => {});

// =============================================================
// DATABASE HEALTH CHECK
// =============================================================
// 【修复问题 12】数据库初始化验证函数
const ensureDbInitialized = async () => {
  if (!db.initialized) {
    console.error("❌ 数据库尚未初始化");
    throw new Error('数据库未就绪，请稍后重试');
  }
  return true;
};

// =============================================================
// DB PANEL BUILD FUNCTION
// =============================================================
async function buildDbPanelEmbed() {
  try {
    await ensureDbInitialized();
    const stats = await db.getStats();
    const allOrders = await cacheManager.getOrders(); // 【修复问题 6】使用缓存

    const embed = new EmbedBuilder()
      .setColor(0xff99cc)
      .setTitle("📊 数据库管理中心")
      .setDescription("选择下方功能按钮进行相应操作～")
    .setFields(
      {
        name: "📈 数据库统计",
        value: `\`\`\`\n总订单数: ${stats.totalOrders || 0}\n总收入: RM ${(stats.totalRevenue || 0).toFixed(2)}\n记录总数: ${allOrders.length}\n最后更新: ${stats.lastUpdated || "未知"}\n\`\`\``,
        inline: false,
      }
    )
    .setFooter({ text: "💡 提示: 点击下方按钮选择功能" });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("db_info")
      .setLabel("📊 数据库信息")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📊"),

    new ButtonBuilder()
      .setCustomId("db_edit")
      .setLabel("✏️ 编辑数据")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("✏️"),

    new ButtonBuilder()
      .setCustomId("db_manager")
      .setLabel("⚙️ 数据管理")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("⚙️")
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("db_export_excel")
      .setLabel("📥 导出 Excel")
      .setStyle(ButtonStyle.Success)
      .setEmoji("📥"),

    new ButtonBuilder()
      .setCustomId("db_export_json")
      .setLabel("💾 导出 JSON")
      .setStyle(ButtonStyle.Success)
      .setEmoji("💾"),

    new ButtonBuilder()
      .setCustomId("db_refresh")
      .setLabel("🔄 刷新数据")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔄")
  );

  return { embeds: [embed], components: [row1, row2] };
  } catch (err) {
    console.error("❌ 构建数据库面板失败:", err.message);
    const fallbackEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ 数据库面板加载失败")
      .setDescription(`错误: ${err.message}`);
    return { embeds: [fallbackEmbed], components: [] };
  }
}

// 自动发送消息到频道（检查是否已存在）- 【改进】添加完整错误处理
const autoSendPanel = async (channel, embed, components, title) => {
  if (!channel) {
    console.warn(`⚠️  频道不存在，跳过『${title}』面板`);
    return false;
  }
  try {
    const msgs = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    if (msgs?.some(m => m.author.id === client.user.id && m.embeds?.[0]?.title === title)) {
      console.log(`ℹ️ 『${title}』面板已存在，跳过`);
      return false;
    }
    await channel.send({ embeds: [embed], components });
    console.log(`✅ 已发送『${title}』面板`);
    return true;
  } catch (err) {
    console.error(`❌ 发送『${title}』面板失败:`, err.message);
    return false;
  }
};

// =============================================================
// CLIENT INIT
// =============================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

initStorage();

client.once("ready", async () => {
  console.log(`✅ 已登入：${client.user.tag}`);
  client.user.setActivity("💞 陪玩系统已启动");

  // 【改进】初始化数据库 - 改为 Promise 链，确保初始化完成后再继续
  if (!db.initialized) {
    try {
      console.log("⏳ 正在初始化数据库...");
      await db.init();
      console.log("✅ SQLite 数据库已初始化");
    } catch (err) {
      console.error("❌ 数据库初始化失败:", err.message);
      console.error("⚠️  应用将继续运行但功能受限");
      // 不退出进程，允许 bot 继续运行但记录错误
      return;
    }
  }

  // 【修复问题 19】每小时清理一次支持日志（删除1天前的日志）
  setInterval(() => {
    try {
      const logs = readJSON(SUPPORT_PATH);
      if (Array.isArray(logs) && logs.length > 100) {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const filtered = logs.filter(log => {
          try {
            return log.timestamp > oneDayAgo;
          } catch {
            return true; // 保留无法解析的日志
          }
        });
        
        if (filtered.length < logs.length) {
          writeJSON(SUPPORT_PATH, filtered);
          console.log(`🧹 支持日志已清理: 删除 ${logs.length - filtered.length} 条过期日志`);
        }
      }
    } catch (err) {
      console.error("❌ 清理支持日志出错:", err.message);
    }
  }, 60 * 60 * 1000); // 每小时执行一次

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.warn("⚠️  未找到首个服务器，自动面板初始化被跳过");
    return;
  }

  // 1️⃣ 自动检测：单子报备面板
  try {
    const channel = guild.channels.cache.get(AUTO_REPORTBB_CHANNEL);
    const embed = new EmbedBuilder()
      .setColor(0xff77ff)
      .setTitle("📌 单子报备")
      .setDescription("麻烦陪陪们接单后报备一下哈，以方便我们后续核实单子谢谢🥰");
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open_report_modal").setLabel("🔗报备单子").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("open_renew_report_modal").setLabel("🔄 续单报备").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("open_gift_modal").setLabel("🎁 礼物报备").setStyle(ButtonStyle.Secondary)
    );
    await autoSendPanel(channel, embed, [row], "📌 单子报备");
  } catch (err) { console.error("报备面板错误:", err); }

  // ==================================================================
  // 2️⃣ 自动检测：陪玩下单系统（ticketsetup）
  // ==================================================================
  try {
    const ticketChannel = guild.channels.cache.get("1433718201690357802"); // 下单系统频道
    if (ticketChannel) {
      const msgs = await ticketChannel.messages.fetch({ limit: 20 }).catch(() => null);

      const exists = msgs?.some(
        (m) =>
          m.author.id === client.user.id &&
          m.embeds?.[0]?.title === "🎟️  陪玩下单系统"
      );

      if (!exists) {
        const embed = new EmbedBuilder()
          .setColor(0xff8cff)
          .setTitle("🎟️  陪玩下单系统")
          .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1440965791313952868/Generated_Image_November_20_2025_-_1_45PM.png?ex=69201378&is=691ec1f8&hm=2ba4de5f511070f09474d79525165cc9ce3a552b90766c65963546a58710f6a7&")
          .setDescription(`${sep()}\n点下面的按钮填写陪玩单吧～ 💖\n${sep()}`);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("open_ticket")
            .setLabel("🎮 申请陪玩订单")
            .setStyle(ButtonStyle.Primary)
        );

        await ticketChannel.send({ embeds: [embed], components: [row] });
        console.log("🎮 自动发送『陪玩下单系统面板』完成");
      }
    }
  } catch (err) {
    console.error("ticketsetup auto error:", err);
  }

  // ==================================================================
  // 3️⃣ 自动检测：客服系统（supportsetup）
  // ==================================================================
  try {
    const supportChannel = guild.channels.cache.get("1434458460824801282"); // 客服频道
    if (supportChannel) {
      const msgs = await supportChannel.messages.fetch({ limit: 20 }).catch(() => null);

      const exists = msgs?.some(
        (m) =>
          m.author.id === client.user.id &&
          m.embeds?.[0]?.title === "💬 客服中心"
      );

      if (!exists) {
        const embed = new EmbedBuilder()
          .setColor(0x00aaff)
          .setTitle("💬 客服中心")
          .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1440965790764503060/Generated_Image_November_20_2025_-_1_44PM.png?ex=69201378&is=691ec1f8&hm=b557cca8284e29b7c5610a868db7d6ae31610c0c4fd8d8e717bad59cbc0c839b&")
          .setDescription(`${sep()}\n需要帮助？点击下方按钮联系工作人员。\n${sep()}`);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("open_support")
            .setLabel("💬 联系客服")
            .setStyle(ButtonStyle.Secondary)
        );

        await supportChannel.send({ embeds: [embed], components: [row] });
        console.log("💬 自动发送『客服系统面板』完成");
      }
    }
  } catch (err) {
    console.error("supportsetup auto error:", err);
  }

  // 4️⃣ Bot 启动通知
  try {
    const notifyChannel = client.channels.cache.get("1433987480524165213"); // 统计频道ID
    if (notifyChannel) {
      await notifyChannel.send("🟢 Bot 已启动 / 重启完成");
      console.log("🟢 启动通知已发送");
    } else {
      console.warn("⚠️  启动通知频道未找到");
    }
  } catch (err) {
    console.error("❌ 发送启动通知出错:", err.message);
  }
});


// =============================================================
// SLASH COMMANDS
// =============================================================
const commands = [
  new SlashCommandBuilder()
    .setName("reportbb")
    .setDescription("建立单子报备面板")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ticketsetup")
    .setDescription("创建陪玩订单按钮")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("supportsetup")
    .setDescription("创建客服按钮")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // 新增：恢复统计按钮面板的指令（管理员权限）
  new SlashCommandBuilder()
    .setName("statssetup")
    .setDescription("创建订单统计按钮面板")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // 新增：查询报备和单子记录
  new SlashCommandBuilder()
    .setName("queryrecords")
    .setDescription("查询单子报备和单子记录")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  // 新增：手动更新/发送统计 embed（绑定 /record）
  new SlashCommandBuilder()
    .setName("record")
    .setDescription("更新/发送派单统计 embed 到统计频道（管理员）")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // 新增：数据库管理主命令
  new SlashCommandBuilder()
    .setName("db")
    .setDescription("📊 数据库管理中心 - 查看、编辑、导出订单数据")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // 新增：数据管理中心命令
  new SlashCommandBuilder()
    .setName("datacenter")
    .setDescription("📊 数据管理中心 - 统计、分析、导出、检查数据")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(config.clientId), {
      body: commands,
    });
    console.log("✅ Slash 指令注册成功");
  } catch (err) {
    console.error("❌ 注册 Slash 指令失败：", err);
  }
})();

// === 第 1 段结束 ===
// 接下来我将发送第 2 段（报备系统：open_report_modal、reportForm 提交、add_order_number modal 相关）
// 若准备好了请回复：发送第 2 段
// =============================================================
// INTERACTION HANDLER（报备系统部分）
// =============================================================
client.on("interactionCreate", async (interaction) => {
  try {
    // ---------------------------------------------------------
    // /reportbb（创建报备按钮面板）
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "reportbb"
    ) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("📌 单子报备")
        .setDescription(`\n✨ 麻烦陪陪们接单后报备一下哈，以方便我们后续核实单子，谢谢你～ 💗\n`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_report_modal")
          .setLabel("🔗 报备单子")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("open_renew_report_modal")
          .setLabel("🔄 续单报备")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("open_gift_modal")
          .setLabel("🎁 礼物报备")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ---------------------------------------------------------
    // 打开报备 Modal
    // ---------------------------------------------------------
    if (
      interaction.isButton() &&
      interaction.customId === "open_report_modal"
    ) {
      const modal = new ModalBuilder()
        .setCustomId("reportForm")
        .setTitle("📄 单子报备");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("boss")
            .setLabel("🧑‍💼 老板名字")
            .setPlaceholder("例如：老板编号#1234")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("player")
            .setLabel("🧚‍♀️ 陪陪名字")
            .setPlaceholder("例如：🧚‍♀️ 陪陪名字")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("type")
            .setLabel("🧩 单子类型")
            .setPlaceholder("例如：游戏名字（Valo娱乐/技术/续单）")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("⏰ 时长")
            .setPlaceholder("例如： （ 3小时/ 1白单 2夜单 / 11.00pm - 2.00am )")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("💰 金额")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // 打开礼物报备 Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "open_gift_modal") {
      const modal = new ModalBuilder()
        .setCustomId("giftReportForm")
        .setTitle("🎁 礼物报备");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("giver")
            .setLabel("🧑‍💼 老板")
            .setPlaceholder("🧑‍💼老板名字")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("receiver")
            .setLabel("🧚‍♀️ 收礼人")
            .setPlaceholder("🧚‍♀️陪陪名字")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("gift")
            .setLabel("🎁 礼物内容")
            .setPlaceholder("🎁礼物名字")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("value")
            .setLabel("💰 价值/金额 (选填)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );

      await interaction.showModal(modal);
      return;
    }

        // ---------------------------------------------------------
    // 提交报备 Modal（报备成功）
    // ---------------------------------------------------------
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "reportForm"
    ) {
      try {
        // 【修复问题 13】添加输入验证
        const boss = validateInput(interaction.fields.getTextInputValue("boss"), 'text', 50);
        const player = validateInput(interaction.fields.getTextInputValue("player"), 'text', 50);
        const type = validateInput(interaction.fields.getTextInputValue("type"), 'text', 50);
        const duration = validateInput(interaction.fields.getTextInputValue("duration"), 'text', 100);
        const amount = parsePrice(interaction.fields.getTextInputValue("amount"));

        // 验证必填字段
        if (!boss || !player || !type || !duration) {
          return await interaction.reply({
            content: "❌ 所有字段必填且不能为空，请重新提交",
            ephemeral: true
          });
        }

        if (amount <= 0) {
          return await interaction.reply({
            content: "❌ 金额必须大于 0",
            ephemeral: true
          });
        }

        // 【修复】先保存到数据库，获取 orderId，然后将其写入 Embed footer
        let orderId = null;
        try {
          const result = await db.addOrder({
            type: "report",
            boss,
            player,
            orderType: type,
            duration,
            amount,
            date: new Date().toLocaleString("zh-CN"),
            source: "reportForm",
          });
          // sql.js 返回的是插入数据，需要获取最新插入的 ID
          // 通过查询最后一条记录来获取 ID
          const allOrders = await db.getAllOrders();
          orderId = allOrders[0]?.id || null;
          cacheManager.invalidate(); // 【修复问题 6】清除缓存
        } catch (e) {
          console.error("❌ 保存报备到数据库失败：", e.message);
          return await interaction.reply({
            content: "❌ 保存报备失败，请稍后重试",
            ephemeral: true
          });
        }

      // 📌 报备成功 Embed（粉色治愈风）- 管理员看的完整版本
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("💗 单子报备完成啦～【管理员视图】")
        .setDescription(`${sep()}\n✨ 此消息包含完整老板信息，仅发送到管理员频道\n${sep()}\n\n📌 **报备信息**`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&"
        )
        .addFields(
          { name: "👤 老板信息", value: `\`\`\`${boss}\`\`\``, inline: false },
          { name: "🧚‍♀️ 陪玩", value: player, inline: true },
          { name: "📌 类型", value: type, inline: true },
          { name: "⏰ 时长", value: duration, inline: true },
          { name: "💰 金额", value: `**RM ${amount}**`, inline: true },
          { name: "⌚ 报备时间", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "🔢 单号状态", value: "⏳ 待添加", inline: true }
        )
        .setFooter({ text: `陪玩后宫 • 管理员报备视图 💗 | ID:${orderId}` })
        .setTimestamp();

      // 公共频道看的 embed（隐藏老板名字）
      const embedForOthers = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("💗 单子报备完成啦～")
        .setDescription(`${sep()}\n谢谢你的报备，我们会温柔地记录每一单～\n${sep()}\n\n📌 **报备信息**`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&"
        )
        .addFields(
          { name: "🔒 老板信息", value: "仅管理员可见", inline: true },
          { name: "🧚‍♀️ 陪玩", value: player, inline: true },
          { name: "📌 类型", value: type, inline: true },
          { name: "⏰ 时长", value: duration, inline: true },
          { name: "💰 金额", value: `**RM ${amount}**`, inline: true },
          { name: "⌚ 报备时间", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "🔢 单号状态", value: "⏳ 待添加", inline: true }
        )
        .setFooter({ text: `陪玩后宫 • 谢谢你的一份用心 💗 | ID:${orderId}` })
        .setTimestamp();

      // 📱 自动发送到 Telegram（仅第一个群，包含老板名字）
      const telegramReportMsg = `<b>📌 新的单子报备</b>
━━━━━━━━━━━━━━━━━━
<b>👤 老板:</b> ${boss}
<b>🧚 陪陪:</b> ${player}
<b>📝 类型:</b> ${type}
<b>⏰ 时长:</b> ${duration}
<b>💰 金额:</b> RM ${amount}
<b>📅 时间:</b> ${new Date().toLocaleString("zh-CN")}
━━━━━━━━━━━━━━━━━━`;
      await sendTelegramReport(config.telegramChatId, telegramReportMsg, config.telegramMessageThreadId).catch(() => {});

      // 添加单号按钮（管理员）
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("add_order_number")
          .setLabel("🔢 添加单号")
          .setStyle(ButtonStyle.Secondary)
      );

      // ✅ 公共频道：统一只发送“隐藏老板”的版本
      await interaction.reply({
        embeds: [embedForOthers],
        components: [row],
      });

      // ✅ 管理员频道：发送包含老板名字的完整版本
      try {
        const logChannel =
          interaction.guild.channels.cache.get(LOG_CHANNEL_ID) ||
          (await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        } else {
          console.warn("⚠️ 日志频道不存在或无法访问");
        }
      } catch (err) {
        console.error("❌ 发送管理员报备 embed 失败：", err.message);
      }

      return;
      } catch (err) {
        console.error("❌ 处理报备 Modal 出错:", err.message);
        try {
          await interaction.reply({
            content: "❌ 处理报备时发生错误，请稍后重试",
            ephemeral: true
          });
        } catch (e) {
          console.error("❌ 回复用户失败:", e.message);
        }
      }
    }

     // ---------------------------------------------------------
    // 提交礼物报备 Modal（报备成功）
    // ---------------------------------------------------------
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "giftReportForm"
    ) {
      const giver = interaction.fields.getTextInputValue("giver");
      const receiver = interaction.fields.getTextInputValue("receiver");
      const gift = interaction.fields.getTextInputValue("gift");
      const value = parsePrice(interaction.fields.getTextInputValue("value") || 0);

      // 管理员专用 embed（包含送礼人）
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("🎁 礼物报备完成啦～（管理员视图）")
        .setDescription(`${sep()}\n此消息仅发送到管理员频道，包含完整送礼人信息～\n${sep()}`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&")
        .addFields(
          { name: "🧑‍💼 送礼人", value: giver, inline: true },
          { name: "🧚‍♀️ 收礼人", value: receiver, inline: true },
          { name: "🎁 礼物", value: gift, inline: true },
          { name: "💰 价值", value: `RM ${value}`, inline: true },
          { name: "🔢 单号", value: "未填写", inline: false }
        )
        .setFooter({ text: "陪玩后宫 • 管理员专用礼物报备视图 💗" })
        .setTimestamp();

      // 给普通用户看的embed（隐藏送礼人名字）
      const embedForOthers = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("🎁 礼物报备完成啦～")
        .setDescription(`${sep()}\n谢谢你的报备，我们会温柔地记录每一份礼物～\n${sep()}`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&")
        .addFields(
          { name: "🧑‍💼 送礼人", value: "🔒 仅管理员可见", inline: true },
          { name: "🧚‍♀️ 收礼人", value: receiver, inline: true },
          { name: "🎁 礼物", value: gift, inline: true },
          { name: "💰 价值", value: `RM ${value}`, inline: true },
          { name: "🔢 单号", value: "未填写", inline: false }
        )
        .setFooter({ text: "陪玩后宫 • 谢谢你的一份用心 💗" })
        .setTimestamp();

      // 保存到数据库
      try {
        await db.addOrder({
          type: "gift",
          boss: giver,
          player: receiver,
          orderType: gift,
          duration: "",
          amount: value,
          date: new Date().toLocaleString("zh-CN"),
          source: "giftReportForm",
        });
      } catch (e) {
        console.error("保存礼物报备到数据库失败：", e);
      }

      // 📱 自动发送到 Telegram（包含送礼人）
      const telegramGiftMsg = `<b>🎁 新的礼物报备</b>
━━━━━━━━━━━━━━━━━━
<b>👤 送礼人:</b> ${giver}
<b>🧚 收礼人:</b> ${receiver}
<b>🎁 礼物:</b> ${gift}
<b>💰 价值:</b> RM ${value}
<b>📅 时间:</b> ${new Date().toLocaleString("zh-CN")}
━━━━━━━━━━━━━━━━━━`;
      await sendTelegramReport(config.telegramChatId, telegramGiftMsg, config.telegramMessageThreadId).catch(() => {});

      // 添加单号按钮（管理员）
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("add_order_number")
          .setLabel("🔢 添加单号")
          .setStyle(ButtonStyle.Secondary)
      );

      // ✅ 公共频道：只显示“送礼人：🔒 仅管理员可见”
      await interaction.reply({
        embeds: [embedForOthers],
        components: [row],
      });

      // ✅ 管理员频道：发送完整信息的 embed
      try {
        const logChannel =
          interaction.guild.channels.cache.get(LOG_CHANNEL_ID) ||
          (await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error("发送管理员礼物报备 embed 失败：", err);
      }

      return;
    }

    // ---------------------------------------------------------
    // 打开续单报备 Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "open_renew_report_modal") {
      const modal = new ModalBuilder()
        .setCustomId("renewReportForm")
        .setTitle("🔄 续单报备");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("boss")
            .setLabel("🧑‍💼 老板名字")
            .setPlaceholder("例如：老板编号#1234")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("player")
            .setLabel("🧚‍♀️ 陪陪名字")
            .setPlaceholder("例如：小雪 / 小布丁")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("order_no")
            .setLabel("📦 原单号")
            .setPlaceholder("例如：ORD20251215001")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("⏰ 时长")
            .setPlaceholder("例如：2小时 / 3局 / 11.00pm - 2.00am")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("💰 金额")
            .setPlaceholder("例如：40")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // 提交续单报备 Modal（续单报备成功）
    // ---------------------------------------------------------
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "renewReportForm"
    ) {
      const boss = interaction.fields.getTextInputValue("boss");
      const player = interaction.fields.getTextInputValue("player");
      const orderNo = interaction.fields.getTextInputValue("order_no");
      const duration = interaction.fields.getTextInputValue("duration");
      const amount = parsePrice(interaction.fields.getTextInputValue("amount"));

      // 📌 续单报备成功 Embed（粉色治愈风）- 管理员看的完整版本
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("🔄 续单报备完成啦～【管理员视图】")
        .setDescription(`${sep()}\n✨ 此消息包含完整老板信息，仅发送到管理员频道\n${sep()}\n\n📌 **续单信息**`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&")
        .addFields(
          { name: "👤 老板信息", value: `\`\`\`${boss}\`\`\``, inline: false },
          { name: "🧚‍♀️ 陪玩", value: player, inline: true },
          { name: "⏰ 时长", value: duration, inline: true },
          { name: "💰 金额", value: `**RM ${amount}**`, inline: true },
          { name: "📦 原单号", value: `\`${orderNo}\``, inline: true },
          { name: "⌚ 续单时间", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "🔢 新单号状态", value: "⏳ 待添加", inline: true }
        )
        .setFooter({ text: "陪玩后宫 • 续单报备视图 💗" })
        .setTimestamp();

      // 公共频道看的 embed（隐藏老板名字）
      const embedForOthers = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("🔄 续单报备完成啦～")
        .setDescription(`${sep()}\n谢谢你的报备，我们会温柔地记录每一单～\n${sep()}\n\n📌 **续单信息**`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&")
        .addFields(
          { name: "🔒 老板信息", value: "仅管理员可见", inline: true },
          { name: "🧚‍♀️ 陪玩", value: player, inline: true },
          { name: "⏰ 时长", value: duration, inline: true },
          { name: "💰 金额", value: `**RM ${amount}**`, inline: true },
          { name: "📦 原单号", value: `\`${orderNo}\``, inline: true },
          { name: "⌚ 续单时间", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "🔢 新单号状态", value: "⏳ 待添加", inline: true }
        )
        .setFooter({ text: "陪玩后宫 • 谢谢你的一份用心 💗" })
        .setTimestamp();

      // 保存到数据库
      try {
        await db.addOrder({
          type: "renew_report",
          boss,
          player,
          orderType: "续单",
          duration,
          amount,
          date: new Date().toLocaleString("zh-CN"),
          source: "renewReportForm",
        });
      } catch (e) {
        console.error("保存续单报备到数据库失败：", e);
      }

      // 📱 自动发送到 Telegram（仅第一个群，包含老板名字）
      const telegramRenewReportMsg = `<b>🔄 新的续单报备</b>
━━━━━━━━━━━━━━━━━━
<b>👤 老板:</b> ${boss}
<b>🧚 陪陪:</b> ${player}
<b>📦 原单号:</b> ${orderNo}
<b>⏰ 时长:</b> ${duration}
<b>💰 金额:</b> RM ${amount}
<b>📅 时间:</b> ${new Date().toLocaleString("zh-CN")}
━━━━━━━━━━━━━━━━━━`;
      await sendTelegramReport(config.telegramChatId, telegramRenewReportMsg, config.telegramMessageThreadId).catch(() => {});

      // 添加单号按钮（管理员）
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("add_order_number")
          .setLabel("🔢 添加新单号")
          .setStyle(ButtonStyle.Secondary)
      );

      // ✅ 公共频道：统一只发送"隐藏老板"的版本
      await interaction.reply({
        embeds: [embedForOthers],
        components: [row],
      });

      // ✅ 管理员频道：发送包含老板名字的完整版本
      try {
        const logChannel =
          interaction.guild.channels.cache.get(LOG_CHANNEL_ID) ||
          (await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error("发送管理员续单报备 embed 失败：", err);
      }

      return;
    }


    // ---------------------------------------------------------
    // 添加单号按钮（管理员限定）
    // ---------------------------------------------------------
    if (
      interaction.isButton() &&
      interaction.customId === "add_order_number"
    ) {
      const member = interaction.guild.members.cache.get(interaction.user.id);

      // 权限验证
      if (
        !member.permissions.has(PermissionFlagsBits.Administrator) &&
        !member.roles.cache.has(config.adminRoleId)
      ) {
        return interaction.reply({
          content: "❌ 抱歉，只有管理员可以添加单号。若你需要帮助请联系管理员～",
          ephemeral: true,
        });
      }

      // 记录消息 ID，用于提交 modal 后编辑 embed
      addOrderContext.set(interaction.user.id, {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        messageId: interaction.message.id,
      });
      
      // 【修复问题 8】添加自动清理机制（5分钟后清理）
      addOrderContextCleanup(interaction.user.id, 300000);

      // 打开 Modal
      const modal = new ModalBuilder()
        .setCustomId("addOrderNumberModal")
        .setTitle("🔢 添加单号");

      const input = new TextInputBuilder()
        .setCustomId("order_number")
        .setLabel("请输入单号")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // 单号 Modal 提交（更新原消息）
    // ---------------------------------------------------------
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "addOrderNumberModal"
    ) {
      const orderNumber = interaction.fields.getTextInputValue("order_number");

      const ctx = addOrderContext.get(interaction.user.id);
      if (!ctx) {
        return interaction.reply({
          content: "❌ 找不到对应的报备消息（可能已过期）。请重试或联系管理员～",
          ephemeral: true,
        });
      }

      const guild =
        client.guilds.cache.get(ctx.guildId) ||
        (await client.guilds.fetch(ctx.guildId).catch(() => null));
      if (!guild)
        return interaction.reply({
          content: "❌ 无法找到公会，请确认机器人权限。",
          ephemeral: true,
        });

      const channel =
        guild.channels.cache.get(ctx.channelId) ||
        (await guild.channels.fetch(ctx.channelId).catch(() => null));
      if (!channel)
        return interaction.reply({
          content: "❌ 无法找到原频道，消息可能已被删除。",
          ephemeral: true,
        });

      const msg = await channel.messages.fetch(ctx.messageId).catch(() => null);
      if (!msg)
        return interaction.reply({
          content: "❌ 原始消息已不存在。",
          ephemeral: true,
        });

      const oldEmbed = msg.embeds[0];
      if (!oldEmbed)
        return interaction.reply({
          content: "❌ 原始 embed 不存在。",
          ephemeral: true,
        });

      // 【修复】从 Embed footer 中解析 orderId，而不是盲目猜测
      const footerText = oldEmbed.footer?.text || "";
      const orderIdMatch = footerText.match(/orderId:(\d+)/);
      const orderId = orderIdMatch ? parseInt(orderIdMatch[1]) : null;

      if (!orderId) {
        return interaction.reply({
          content: "❌ 无法从报备记录中提取订单 ID，可能是旧版本记录。",
          ephemeral: true,
        });
      }

      // 创建新 embed（移除旧单号 & 加入新单号）
      const newEmbed = EmbedBuilder.from(oldEmbed);
      const filtered = (oldEmbed.fields || []).filter(
        (f) => f.name !== "🔢 单号"
      );
      newEmbed.setFields(filtered);
      newEmbed.addFields({
        name: "🔢 单号",
        value: orderNumber,
      });

      await msg.edit({
        embeds: [newEmbed],
        components: msg.components,
      });

      // 【修复】使用从footer解析的orderId直接更新数据库
      let updatedOrderInfo = null;
      try {
        // 【修复问题 18】检查单号是否已存在
        const existingOrder = await db.queryOrders({ orderNo: orderNumber });
        if (existingOrder.length > 0) {
          return await interaction.reply({
            content: `❌ 单号 "${orderNumber}" 已被使用，请使用不同的单号`,
            ephemeral: true
          });
        }
        
        await db.updateOrderNumber(orderId, orderNumber);
        updatedOrderInfo = await db.getOrderById(orderId);
        cacheManager.invalidate(); // 【修复问题 6】清除缓存
      } catch (e) {
        console.error("❌ 更新数据库单号失败：", e.message);
        return await interaction.reply({
          content: `❌ 数据库更新失败: ${e.message}`,
          ephemeral: true,
        });
      }

      // 📢 发送单号更新通知到报备群
      if (updatedOrderInfo) {
        try {
          const reportChannel = guild.channels.cache.get(REPORT_CHANNEL_ID);
          if (reportChannel) {
            let updateMsg = `✅ <@${interaction.user.id}> 已添加单号\n`;
            updateMsg += `📦 **单号:** ${orderNumber}\n`;
            
            // 使用统一的字段名称显示信息
            if (updatedOrderInfo.source === "reportForm") {
              updateMsg += `🧑‍💼 **老板:** ${updatedOrderInfo.boss || "未知"}\n`;
              updateMsg += `🧚 **陪陪:** ${updatedOrderInfo.player || "未知"}\n`;
              updateMsg += `📌 **类型:** ${updatedOrderInfo.orderType || "未知"}\n`;
              updateMsg += `⏰ **时长:** ${updatedOrderInfo.duration || "未知"}\n`;
              updateMsg += `💰 **金额:** RM ${updatedOrderInfo.amount || 0}`;
            } else if (updatedOrderInfo.source === "giftReportForm") {
              // 礼物报备使用相同的字段（从前端表单映射过来）
              updateMsg += `🧑‍💼 **赠礼者:** ${updatedOrderInfo.boss || "未知"}\n`;
              updateMsg += `🧚 **收礼者:** ${updatedOrderInfo.player || "未知"}\n`;
              updateMsg += `🎁 **礼物:** ${updatedOrderInfo.orderType || "未知"}\n`;
              updateMsg += `💰 **价值:** RM ${updatedOrderInfo.amount || 0}`;
            } else if (updatedOrderInfo.source === "renewReportForm") {
              updateMsg += `🧑‍💼 **老板:** ${updatedOrderInfo.boss || "未知"}\n`;
              updateMsg += `🧚 **陪陪:** ${updatedOrderInfo.player || "未知"}\n`;
              updateMsg += `⏰ **时长:** ${updatedOrderInfo.duration || "未知"}\n`;
              updateMsg += `💰 **金额:** RM ${updatedOrderInfo.amount || 0}`;
            }

            const updateEmbed = new EmbedBuilder()
              .setColor(THEME_COLOR)
              .setTitle("🔢 单号已添加")
              .setDescription(updateMsg)
              .setFooter({ text: "单子报备 • 已更新" })
              .setTimestamp();

            await reportChannel.send({ embeds: [updateEmbed] });
          }
        } catch (err) {
          console.error("发送单号更新到报备群失败：", err);
        }
      }

      addOrderContext.delete(interaction.user.id);

      await interaction.reply({
        content: `✅ 单号已更新为：${orderNumber}，谢谢～`,
        ephemeral: true,
      });

      return;
    }

    // ====================== 报备系统结束 ======================
    // ---------------------------------------------------------
    // /datacenter 命令 - 数据管理中心主入口
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "datacenter"
    ) {
      try {
        const allOrders = statistics.loadOrdersData();
        const summary = statistics.calculateSummary(allOrders);
        const qualityCheck = statistics.performDataQualityCheck(allOrders);

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle("📊 数据管理中心")
          .setDescription(`${sep()}\n统计 • 分析 • 导出 • 检查\n${sep()}`)
          .addFields(
            {
              name: "📈 数据概览",
              value: statistics.formatSummary(summary),
              inline: false,
            },
            {
              name: "⚠️ 数据质量",
              value: qualityCheck.issues.length > 0 
                ? qualityCheck.issues.join('\n') 
                : '✅ 数据完整无误',
              inline: false,
            }
          )
          .setFooter({ text: '最后更新: ' + new Date().toLocaleString('zh-CN') });

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("datacenter_export_excel")
            .setLabel("📥 导出 Excel")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("datacenter_ranking")
            .setLabel("📊 查看排行")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("datacenter_quality_check")
            .setLabel("🔍 数据检查")
            .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("datacenter_time_filter")
            .setLabel("📅 时间筛选")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("datacenter_export_telegram")
            .setLabel("✈️ 发送到飞机")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("datacenter_refresh")
            .setLabel("🔄 刷新")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          embeds: [embed],
          components: [row1, row2],
          ephemeral: true,
        });
      } catch (err) {
        console.error("数据管理中心错误:", err);
        await interaction.reply({
          content: "❌ 加载数据管理中心失败，请稍后重试",
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 数据管理中心 - 导出 CSV (从SQLite)
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "datacenter_export_excel") {
      try {
        await interaction.deferReply({ ephemeral: true });

        // 检查数据库中是否有数据
        const allOrders = db.getAllOrders();
        if (allOrders.length === 0) {
          return await interaction.editReply({
            content: "📊 SQLite数据库中暂无数据可导出～",
          });
        }

        // 使用SQLite CLI导出CSV
        const fileName = `订单数据_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
        const filePath = sqliteExporter.exportToCSV(fileName);
        
        if (!filePath) {
          return await interaction.editReply({
            content: "❌ CSV导出失败",
          });
        }

        const attachment = new AttachmentBuilder(filePath, { name: fileName });
        
        // 统计报备和派单记录数
        const reports = allOrders.filter(o => o.type === 'report');
        const dispatches = allOrders.filter(o => o.type !== 'report' && o.type);

        await interaction.editReply({
          content: `✅ 已导出 ${reports.length} 条报备记录 + ${dispatches.length} 条派单记录\n📊 总计: ${allOrders.length} 条\n💾 CSV文件已生成，请下载`,
          files: [attachment],
        });

        // 5秒后删除临时文件
        sqliteExporter.deleteFileAsync(filePath, 5000);
      } catch (err) {
        console.error("❌ CSV导出错误:", err);
        await interaction.editReply({
          content: `❌ 导出失败: ${err.message}`,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 数据管理中心 - 查看排行
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "datacenter_ranking") {
      try {
        const allOrders = statistics.loadOrdersData();

        const assigners = statistics.getAssignerRanking(allOrders);
        const players = statistics.getPlayerRanking(allOrders);
        const bosses = statistics.getBossRanking(allOrders);

        const assignersText = assigners
          .map((a, i) => `${i + 1}. ${a.name}: RM ${a.totalPrice} (${a.count}单)`)
          .join('\n') || '暂无数据';

        const playersText = players
          .map((p, i) => `${i + 1}. ${p.name}: RM ${p.total}`)
          .join('\n') || '暂无数据';

        const bossesText = bosses
          .map((b, i) => `${i + 1}. ${b.name}: RM ${b.totalAmount} (${b.count}单)`)
          .join('\n') || '暂无数据';

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle("📊 排行榜分析")
          .addFields(
            {
              name: "🏆 派单员排行 (Top 10)",
              value: `\`\`\`\n${assignersText}\n\`\`\``,
              inline: false,
            },
            {
              name: "⭐ 陪玩员排行 (Top 10)",
              value: `\`\`\`\n${playersText}\n\`\`\``,
              inline: false,
            },
            {
              name: "👑 老板排行 (Top 10)",
              value: `\`\`\`\n${bossesText}\n\`\`\``,
              inline: false,
            }
          )
          .setFooter({ text: '数据于 ' + new Date().toLocaleString('zh-CN') + ' 生成' });

        await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      } catch (err) {
        console.error("查看排行错误:", err);
        await interaction.reply({
          content: `❌ 加载排行失败: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 数据管理中心 - 数据检查
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "datacenter_quality_check") {
      try {
        const allOrders = statistics.loadOrdersData();
        const check = statistics.performDataQualityCheck(allOrders);

        let description = '';
        if (check.issues.length > 0) {
          description += '**⚠️ 问题项:**\n' + check.issues.join('\n') + '\n\n';
        }
        if (check.warnings.length > 0) {
          description += '**📌 提醒项:**\n' + check.warnings.join('\n');
        }
        if (check.issues.length === 0 && check.warnings.length === 0) {
          description = '✅ 恭喜！数据完整无误～';
        }

        const embed = new EmbedBuilder()
          .setColor(check.hasIssues ? 0xff6b6b : 0x51cf66)
          .setTitle("🔍 数据质量检查")
          .setDescription(description)
          .setFooter({ text: '总计: ' + check.totalIssuesAndWarnings + ' 项' });

        await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      } catch (err) {
        console.error("数据检查错误:", err);
        await interaction.reply({
          content: `❌ 检查失败: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 数据管理中心 - 导出到 Telegram
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "datacenter_export_telegram") {
      try {
        await interaction.deferReply({ ephemeral: true });

        // 【修改】从SQLite数据库读取数据
        const allOrders = db.getAllOrders();
        if (allOrders.length === 0) {
          return await interaction.editReply({
            content: "📊 SQLite数据库中暂无数据可导出～",
          });
        }

        // 导出CSV文件
        const fileName = `单子统计_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
        const filePath = sqliteExporter.exportToCSV(fileName);

        // 读取CSV内容作为消息体发送到Telegram
        const fs = require('fs');
        const csvContent = fs.readFileSync(filePath, 'utf8');
        const reportCount = allOrders.filter(o => o.type === 'report').length;
        const dispatchCount = allOrders.filter(o => o.type !== 'report').length;
        
        const telegramConfig = {
          token: config.telegramToken,
          chatId: config.telegramChatId,
          messageThreadId: config.telegramMessageThreadId,
        };

        // 发送CSV到Telegram（通过FormData发送文件）
        const FormData = require('form-data');
        const axios = require('axios');
        
        const form = new FormData();
        form.append('chat_id', telegramConfig.chatId);
        if (telegramConfig.messageThreadId) {
          form.append('message_thread_id', telegramConfig.messageThreadId);
        }
        form.append('document', fs.createReadStream(filePath), fileName);
        form.append('caption', `📊 <b>数据管理中心导出</b>\n⏰ ${new Date().toLocaleString("zh-CN")}\n\n✅ 已导出 ${reportCount} 条报备 + ${dispatchCount} 条派单\n💾 CSV格式`);
        form.append('parse_mode', 'HTML');

        await axios.post(`https://api.telegram.org/bot${telegramConfig.token}/sendDocument`, form, {
          headers: form.getHeaders()
        });

        await interaction.editReply({
          content: "✅ CSV文件已导出至 Telegram～",
        });
        
        sqliteExporter.deleteFileAsync(filePath, 5000);
      } catch (err) {
        console.error("导出Telegram错误:", err);
        await interaction.editReply({
          content: `❌ 导出失败: ${err.message}`,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 数据管理中心 - 刷新
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "datacenter_refresh") {
      try {
        const allOrders = statistics.loadOrdersData();
        const summary = statistics.calculateSummary(allOrders);
        const qualityCheck = statistics.performDataQualityCheck(allOrders);

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle("📊 数据管理中心")
          .setDescription(`${sep()}\n统计 • 分析 • 导出 • 检查\n${sep()}`)
          .addFields(
            {
              name: "📈 数据概览",
              value: statistics.formatSummary(summary),
              inline: false,
            },
            {
              name: "⚠️ 数据质量",
              value: qualityCheck.issues.length > 0 
                ? qualityCheck.issues.join('\n') 
                : '✅ 数据完整无误',
              inline: false,
            }
          )
          .setFooter({ text: '最后更新: ' + new Date().toLocaleString('zh-CN') });

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("datacenter_export_excel")
            .setLabel("📥 导出 Excel")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("datacenter_ranking")
            .setLabel("📊 查看排行")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("datacenter_quality_check")
            .setLabel("🔍 数据检查")
            .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("datacenter_time_filter")
            .setLabel("📅 时间筛选")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("datacenter_export_telegram")
            .setLabel("✈️ 发送到飞机")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("datacenter_refresh")
            .setLabel("🔄 刷新")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({
          embeds: [embed],
          components: [row1, row2],
        });
      } catch (err) {
        console.error("刷新错误:", err);
        await interaction.reply({
          content: `❌ 刷新失败: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 数据管理中心 - 时间筛选
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "datacenter_time_filter") {
      try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        // 格式化日期为 YYYY/M/D HH:MM:SS
        const formatDateTime = (date, time = '00:00:00') => {
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const day = date.getDate();
          return `${year}/${month}/${day} ${time}`;
        };

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("time_filter_select")
            .setPlaceholder("选择时间范围")
            .addOptions(
              {
                label: "今天",
                value: `${formatDateTime(today, '00:00:00')}_${formatDateTime(today, '23:59:59')}`,
                description: "仅显示今天的数据",
              },
              {
                label: "最近7天",
                value: `${formatDateTime(oneWeekAgo, '00:00:00')}_${formatDateTime(today, '23:59:59')}`,
                description: "最近7天内的数据",
              },
              {
                label: "最近30天",
                value: `${formatDateTime(oneMonthAgo, '00:00:00')}_${formatDateTime(today, '23:59:59')}`,
                description: "最近30天内的数据",
              },
              {
                label: "全部数据",
                value: "all",
                description: "显示所有数据",
              },
              {
                label: "自定义时段",
                value: "custom",
                description: "自定义开始和结束日期时间",
              }
            )
        );

        await interaction.reply({
          content: "📅 请选择要统计的时间范围:",
          components: [row],
          ephemeral: true,
        });
      } catch (err) {
        console.error("时间筛选错误:", err);
        await interaction.reply({
          content: `❌ 时间筛选失败: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 时间筛选 - 选择菜单处理
    // ---------------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === "time_filter_select") {
      try {
        const value = interaction.values[0];

        // 处理自定义时段
        if (value === "custom") {
          const modal = new ModalBuilder()
            .setCustomId("custom_time_filter_modal")
            .setTitle("自定义时间范围");

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("custom_start_date")
                .setLabel("开始日期 (YYYY/M/D)")
                .setPlaceholder("例如: 2026/1/1")
                .setRequired(true)
                .setMaxLength(20)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("custom_start_time")
                .setLabel("开始时间 (HH:MM:SS)")
                .setPlaceholder("例如: 00:00:00")
                .setValue("00:00:00")
                .setRequired(true)
                .setMaxLength(20)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("custom_end_date")
                .setLabel("结束日期 (YYYY/M/D)")
                .setPlaceholder("例如: 2026/1/3")
                .setRequired(true)
                .setMaxLength(20)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("custom_end_time")
                .setLabel("结束时间 (HH:MM:SS)")
                .setPlaceholder("例如: 23:59:59")
                .setValue("23:59:59")
                .setRequired(true)
                .setMaxLength(20)
            )
          );

          await interaction.showModal(modal);
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        let filteredOrders;

        const allOrders = statistics.loadOrdersData();

        if (value === "all") {
          filteredOrders = allOrders;
        } else {
          const [startStr, endStr] = value.split("_");
          filteredOrders = statistics.filterByDateRange(allOrders, startStr, endStr);
        }

        if (filteredOrders.length === 0) {
          return await interaction.editReply({
            content: "📊 选定时间范围内暂无数据～",
          });
        }

        // 根据筛选数据计算统计
        const summary = statistics.calculateSummary(filteredOrders);
        const assigners = statistics.getAssignerRanking(filteredOrders);
        const players = statistics.getPlayerRanking(filteredOrders);
        const bosses = statistics.getBossRanking(filteredOrders);

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle("📊 时间范围统计")
          .setDescription(statistics.formatSummary(summary))
          .addFields(
            {
              name: "🏆 派单员排行",
              value:
                assigners.length > 0
                  ? assigners
                      .map((a, i) => `${i + 1}. ${a.name}: RM ${a.totalPrice}`)
                      .join('\n')
                  : "暂无",
              inline: true,
            },
            {
              name: "⭐ 陪玩员排行",
              value:
                players.length > 0
                  ? players
                      .map((p, i) => `${i + 1}. ${p.name}: RM ${p.total}`)
                      .slice(0, 5)
                      .join('\n')
                  : "暂无",
              inline: true,
            }
          )
          .setFooter({ text: '统计结果，统计于 ' + new Date().toLocaleString('zh-CN') });

        // 导出按钮
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("time_filter_export_excel")
            .setLabel("📥 导出 Excel")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("datacenter_refresh")
            .setLabel("🔄 返回主面板")
            .setStyle(ButtonStyle.Secondary)
        );

        // 将筛选结果缓存到全局，供后续导出使用
        global.filteredOrdersCache = filteredOrders;
        global.filteredOrdersCacheTime = Date.now();

        await interaction.editReply({
          embeds: [embed],
          components: [row],
        });
      } catch (err) {
        console.error("时间筛选处理错误:", err);
        await interaction.editReply({
          content: `❌ 处理失败: ${err.message}`,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 自定义时间范围 - Modal 提交处理
    // ---------------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId === "custom_time_filter_modal") {
      try {
        console.log("[自定义时间筛选] 用户提交数据");
        
        const startDate = interaction.fields.getTextInputValue("custom_start_date");
        const startTime = interaction.fields.getTextInputValue("custom_start_time");
        const endDate = interaction.fields.getTextInputValue("custom_end_date");
        const endTime = interaction.fields.getTextInputValue("custom_end_time");

        console.log(`[自定义时间筛选] 收到数据: ${startDate} ${startTime} ~ ${endDate} ${endTime}`);

        const startDateTime = `${startDate} ${startTime}`;
        const endDateTime = `${endDate} ${endTime}`;

        // 验证日期格式
        const validateDateTime = (dateTime) => {
          const dateRegex = /^\d{4}\/\d{1,2}\/\d{1,2}$/;
          const timeRegex = /^\d{1,2}:\d{2}:\d{2}$/;
          const [date, time] = dateTime.split(' ');
          
          if (!dateRegex.test(date) || !timeRegex.test(time)) {
            throw new Error(`日期格式错误: ${dateTime}. 应为 YYYY/M/D HH:MM:SS`);
          }
          
          // 验证日期和时间的有效性
          const dateParts = date.split('/');
          const timeParts = time.split(':');
          const year = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]);
          const day = parseInt(dateParts[2]);
          const hour = parseInt(timeParts[0]);
          const minute = parseInt(timeParts[1]);
          const second = parseInt(timeParts[2]);
          
          if (month < 1 || month > 12 || day < 1 || day > 31 || 
              hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
            throw new Error(`日期或时间数值无效: ${dateTime}`);
          }
        };

        validateDateTime(startDateTime);
        validateDateTime(endDateTime);

        console.log("[自定义时间筛选] 日期格式验证通过");

        const allOrders = statistics.loadOrdersData();
        console.log(`[自定义时间筛选] 加载了 ${allOrders.length} 条订单`);

        const filteredOrders = statistics.filterByDateRange(allOrders, startDateTime, endDateTime);
        console.log(`[自定义时间筛选] 筛选后得到 ${filteredOrders.length} 条订单`);

        await interaction.deferReply({ ephemeral: true });

        if (filteredOrders.length === 0) {
          return await interaction.editReply({
            content: `📊 时间范围 ${startDateTime} 至 ${endDateTime} 内暂无数据～`,
          });
        }

        // 根据筛选数据计算统计
        const summary = statistics.calculateSummary(filteredOrders);
        const assigners = statistics.getAssignerRanking(filteredOrders);
        const players = statistics.getPlayerRanking(filteredOrders);

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle("📊 自定义时间范围统计")
          .setDescription(`📅 ${startDateTime} 至 ${endDateTime}\n\n${statistics.formatSummary(summary)}`)
          .addFields(
            {
              name: "🏆 派单员排行",
              value:
                assigners.length > 0
                  ? assigners
                      .map((a, i) => `${i + 1}. ${a.name}: RM ${a.totalPrice}`)
                      .join('\n')
                  : "暂无",
              inline: true,
            },
            {
              name: "⭐ 陪玩员排行",
              value:
                players.length > 0
                  ? players
                      .map((p, i) => `${i + 1}. ${p.name}: RM ${p.total}`)
                      .slice(0, 5)
                      .join('\n')
                  : "暂无",
              inline: true,
            }
          )
          .setFooter({ text: '统计结果，统计于 ' + new Date().toLocaleString('zh-CN') });

        // 导出按钮
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("time_filter_export_excel")
            .setLabel("📥 导出 Excel")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("datacenter_refresh")
            .setLabel("🔄 返回主面板")
            .setStyle(ButtonStyle.Secondary)
        );

        // 将筛选结果缓存到全局，供后续导出使用
        global.filteredOrdersCache = filteredOrders;
        global.filteredOrdersCacheTime = Date.now();

        console.log("[自定义时间筛选] 准备发送回复");

        await interaction.editReply({
          embeds: [embed],
          components: [row],
        });

        console.log("[自定义时间筛选] 处理完成");
      } catch (err) {
        console.error("自定义时间范围处理错误:", err);
        console.error("错误堆栈:", err.stack);
        
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
              content: `❌ 处理失败: ${err.message}`,
            });
          } else {
            await interaction.reply({
              content: `❌ 处理失败: ${err.message}`,
              ephemeral: true,
            });
          }
        } catch (replyErr) {
          console.error("回复错误失败:", replyErr);
        }
      }
      return;
    }

    // ---------------------------------------------------------
    // /queryrecords（查询报备和单子记录）
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "queryrecords"
    ) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("📊 单子查询中心")
        .setDescription(`${sep()}\n点击下方按钮查看报备和单子记录～\n${sep()}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("view_reports")
          .setLabel("📋 查看报备")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("view_orders")
          .setLabel("📦 查看单子记录")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("export_excel")
          .setLabel("📊 导出 Excel")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("export_telegram")
          .setLabel("✈️ 导出到飞机")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ---------------------------------------------------------
    // 导出 CSV 按钮 (使用SQLite数据源)
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "export_excel") {
      try {
        await interaction.deferReply({ ephemeral: true });

        // 【修改】直接从SQLite数据库读取数据
        const allOrders = db.getAllOrders();
        console.log(`[export_excel] 从SQLite读取 ${allOrders.length} 条记录`);

        if (allOrders.length === 0) {
          return interaction.editReply({
            content: "📊 SQLite数据库中暂无数据可导出～",
          });
        }

        // 使用SQLite CLI导出CSV（不再使用exporter的Excel逻辑）
        const fileName = `单子统计_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
        
        try {
          const filePath = sqliteExporter.exportToCSV(fileName);
          const attachment = new AttachmentBuilder(filePath, { name: fileName });
          
          const reportCount = allOrders.filter(o => o.type === 'report').length;
          const dispatchCount = allOrders.filter(o => o.type !== 'report').length;
          
          await interaction.editReply({
            content: `✅ 已导出 ${reportCount} 条报备记录 + ${dispatchCount} 条派单记录\n💾 CSV文件已生成，请下载`,
            files: [attachment],
          });
          
          sqliteExporter.deleteFileAsync(filePath, 5000);
        } catch (err) {
          console.error("❌ 导出 CSV 错误:", err.message);
          await interaction.editReply({
            content: "❌ 导出 CSV 时出错，请稍后重试～",
          });
        }

      } catch (err) {
        console.error("导出 CSV 错误:", err);
        interaction.editReply({
          content: "❌ 导出 CSV 时出错，请稍后重试～",
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 导出到 Telegram（飞机）按钮
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "export_telegram") {
      try {
        await interaction.deferReply({ ephemeral: true });

        // 【修改】从SQLite数据库读取数据
        const allOrders = db.getAllOrders();
        if (allOrders.length === 0) {
          return interaction.editReply({
            content: "📊 SQLite数据库中暂无数据可导出～",
          });
        }

        // 导出CSV文件
        const fileName = `单子统计_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
        const filePath = sqliteExporter.exportToCSV(fileName);

        // 发送CSV到Telegram
        try {
          const fs = require('fs');
          const FormData = require('form-data');
          const axios = require('axios');
          
          const telegramConfig = {
            token: config.telegramToken,
            chatId: config.telegramChatId,
            messageThreadId: config.telegramMessageThreadId,
          };
          
          const form = new FormData();
          form.append('chat_id', telegramConfig.chatId);
          if (telegramConfig.messageThreadId) {
            form.append('message_thread_id', telegramConfig.messageThreadId);
          }
          form.append('document', fs.createReadStream(filePath), fileName);
          
          const reportCount = allOrders.filter(o => o.type === 'report').length;
          const dispatchCount = allOrders.filter(o => o.type !== 'report').length;
          
          form.append('caption', `📊 <b>单子统计数据</b>\n⏰ ${new Date().toLocaleString("zh-CN")}\n✅ 已导出 ${reportCount} 条报备 + ${dispatchCount} 条派单\n💾 CSV格式`);
          form.append('parse_mode', 'HTML');

          await axios.post(`https://api.telegram.org/bot${telegramConfig.token}/sendDocument`, form, {
            headers: form.getHeaders()
          });
          
          await interaction.editReply({
            content: "✅ CSV 文件（报备+派单）已导出至 Telegram～",
          });
          
          sqliteExporter.deleteFileAsync(filePath, 5000);
        } catch (err) {
          console.error("❌ 导出到 Telegram 错误:", err.message);
          await interaction.editReply({
            content: "❌ 导出到 Telegram 时出错，请稍后重试～",
          });
        }

      } catch (err) {
        console.error("导出到 Telegram 错误:", err);
        interaction.editReply({
          content: "❌ 导出到 Telegram 时出错，请稍后重试～",
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 查看报备记录按钮
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "view_reports") {
      try {
        const orders = await db.getAllOrders();
        const reports = orders.filter(o => o.source === "reportForm" || o.source === "giftReportForm" || o.source === "renewReportForm");

        if (reports.length === 0) {
          return interaction.reply({
            content: "📋 暂无报备记录～",
            ephemeral: true,
          });
        }

        // 分页显示（每页最多 10 条）
        const pageSize = 10;
        const pages = [];
        for (let i = 0; i < reports.length; i += pageSize) {
          pages.push(reports.slice(i, i + pageSize));
        }

        let currentPage = 0;

        const generateReportEmbed = (page) => {
          const items = pages[page];
          const embed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setTitle(`📋 单子报备记录 (第 ${page + 1}/${pages.length} 页)`)
            .setDescription(`${sep()}\n共 ${reports.length} 条报备记录\n${sep()}`);

          items.forEach((report, idx) => {
            const index = page * pageSize + idx + 1;
            if (report.source === "reportForm") {
              let value = `👤 **老板:** ${report.boss}\n🧚 **陪陪:** ${report.player}\n🧩 **类型:** ${report.orderType}\n⏰ **时长:** ${report.duration}\n💰 **金额:** RM ${report.amount}`;
              if (report.orderNo) {
                value += `\n🔢 **单号:** ${report.orderNo}`;
              }
              embed.addFields({
                name: `#${index} - ${report.date}`,
                value: value,
                inline: false,
              });
            } else if (report.source === "giftReportForm") {
              let value = `👤 **送礼人:** ${report.giver}\n🧚 **收礼人:** ${report.receiver}\n🎁 **礼物:** ${report.gift}\n💰 **价值:** RM ${report.amount}`;
              if (report.orderNo) {
                value += `\n🔢 **单号:** ${report.orderNo}`;
              }
              embed.addFields({
                name: `#${index} - 礼物报备 - ${report.date}`,
                value: value,
                inline: false,
              });
            } else if (report.source === "renewReportForm") {
              let value = `👤 **老板:** ${report.boss}\n🧚 **陪陪:** ${report.player}\n📦 **原单号:** ${report.originalOrder}\n⏰ **时长:** ${report.duration}\n💰 **金额:** RM ${report.amount}`;
              if (report.orderNo) {
                value += `\n🔢 **新单号:** ${report.orderNo}`;
              }
              embed.addFields({
                name: `#${index} - 🔄 续单报备 - ${report.date}`,
                value: value,
                inline: false,
              });
            }
          });

          embed.setFooter({ text: "陪玩后宫 • 报备管理系统" });
          embed.setTimestamp();
          return embed;
        };

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev_report_page")
            .setLabel("⬅️ 上一页")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId("next_report_page")
            .setLabel("下一页 ➡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === pages.length - 1)
        );

        const reply = await interaction.reply({
          embeds: [generateReportEmbed(currentPage)],
          components: pages.length > 1 ? [buttons] : [],
          ephemeral: true,
        });

        if (pages.length > 1) {
          const filter = (i) => i.user.id === interaction.user.id && (i.customId === "prev_report_page" || i.customId === "next_report_page");
          const collector = reply.createMessageComponentCollector({ filter, time: 60000 });

          collector.on("collect", async (i) => {
            if (i.customId === "prev_report_page" && currentPage > 0) {
              currentPage--;
            } else if (i.customId === "next_report_page" && currentPage < pages.length - 1) {
              currentPage++;
            }

            const newButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("prev_report_page")
                .setLabel("⬅️ 上一页")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
              new ButtonBuilder()
                .setCustomId("next_report_page")
                .setLabel("下一页 ➡️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === pages.length - 1)
            );

            await i.update({
              embeds: [generateReportEmbed(currentPage)],
              components: [newButtons],
            });
          });
        }
      } catch (err) {
        console.error("查看报备记录错误:", err);
        interaction.reply({
          content: "❌ 查询报备记录时出错，请稍后重试～",
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // 查看单子记录按钮
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "view_orders") {
      try {
        const orders = await db.getAllOrders();
        const assignedOrders = orders.filter(o => o.orderNo);

        if (assignedOrders.length === 0) {
          return interaction.reply({
            content: "📦 暂无派单记录～",
            ephemeral: true,
          });
        }

        // 分页显示（每页最多 10 条）
        const pageSize = 10;
        const pages = [];
        for (let i = 0; i < assignedOrders.length; i += pageSize) {
          pages.push(assignedOrders.slice(i, i + pageSize));
        }

        let currentPage = 0;

        const generateOrderEmbed = (page) => {
          const items = pages[page];
          const embed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setTitle(`📦 单子派单记录 (第 ${page + 1}/${pages.length} 页)`)
            .setDescription(`${sep()}\n共 ${assignedOrders.length} 条派单记录\n${sep()}`);

          items.forEach((order, idx) => {
            const index = page * pageSize + idx + 1;
            embed.addFields({
              name: `#${index} - ${order.orderNo} - ${order.date}`,
              value: `🙋 **派单员:** ${order.assigner}\n🧚 **陪玩员:** ${order.player}\n🎮 **游戏:** ${order.game}\n⏰ **时长:** ${order.duration}\n💰 **价格:** RM ${order.price}`,
              inline: false,
            });
          });

          embed.setFooter({ text: "陪玩后宫 • 派单管理系统" });
          embed.setTimestamp();
          return embed;
        };

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev_order_page")
            .setLabel("⬅️ 上一页")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId("next_order_page")
            .setLabel("下一页 ➡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === pages.length - 1)
        );

        const reply = await interaction.reply({
          embeds: [generateOrderEmbed(currentPage)],
          components: pages.length > 1 ? [buttons] : [],
          ephemeral: true,
        });

        if (pages.length > 1) {
          const filter = (i) => i.user.id === interaction.user.id && (i.customId === "prev_order_page" || i.customId === "next_order_page");
          const collector = reply.createMessageComponentCollector({ filter, time: 60000 });

          collector.on("collect", async (i) => {
            if (i.customId === "prev_order_page" && currentPage > 0) {
              currentPage--;
            } else if (i.customId === "next_order_page" && currentPage < pages.length - 1) {
              currentPage++;
            }

            const newButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("prev_order_page")
                .setLabel("⬅️ 上一页")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
              new ButtonBuilder()
                .setCustomId("next_order_page")
                .setLabel("下一页 ➡️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === pages.length - 1)
            );

            await i.update({
              embeds: [generateOrderEmbed(currentPage)],
              components: [newButtons],
            });
          });
        }
      } catch (err) {
        console.error("查看派单记录错误:", err);
        interaction.reply({
          content: "❌ 查询派单记录时出错，请稍后重试～",
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // /ticketsetup（创建陪玩订单按钮）
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "ticketsetup"
    ) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("🎟️  陪玩下单系统")
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1440965791313952868/Generated_Image_November_20_2025_-_1_45PM.png?ex=69201378&is=691ec1f8&hm=2ba4de5f511070f09474d79525165cc9ce3a552b90766c65963546a58710f6a7&")
        .setDescription(`${sep()}\n点下面的按钮填写陪玩单吧～ 💖\n${sep()}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("🎮 下单陪玩订单")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ---------------------------------------------------------
    // 打开陪玩订单 Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "open_ticket") {
      const modal = new ModalBuilder()
        .setCustomId("ticketForm")
        .setTitle("🎮 陪玩订单表");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("game")
            .setLabel("🎮 游戏名称")
            .setPlaceholder("例如：Valorant / CS2 / Apex")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("time")
            .setLabel("⏰ 预定时间")
            .setPlaceholder("例如：几小时（一局/两小时)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("mode")
            .setLabel("🎯 游戏模式")
            .setPlaceholder("例如：娱乐 / 排位 / 陪玩")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("extra")
            .setLabel("✨ 特别需求")
            .setPlaceholder("例如：指定陪玩 / 不开麦 / 聊天（选填）")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // 提交陪玩订单 Modal（创建 ticket 频道）
    // ---------------------------------------------------------
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "ticketForm"
    ) {
      const guild = interaction.guild;
      const user = interaction.user;

      const game = interaction.fields.getTextInputValue("game");
      const time = interaction.fields.getTextInputValue("time");
      const mode = interaction.fields.getTextInputValue("mode");
      const extra = interaction.fields.getTextInputValue("extra") || "无";

      // 检查用户现有的ticket数量（通过topic中的user.id）
      const userTickets = guild.channels.cache.filter(
        (c) => c.topic && c.topic.startsWith(`ticket_user:${user.id}`)
      );

      if (userTickets.size >= 5) {
        await interaction.reply({
          content: "❗ 你已经有5个进行中的陪玩工单，无法继续创建。请先完成其他工单后再提交新的～",
          ephemeral: true,
        });
        return;
      }

      const channelName = `ticket-${sanitizeName(user.username)}-${userTickets.size + 1}`;

      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        topic: `ticket_user:${user.id}`,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          },
          {
            id: config.adminRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          },
          {
            id: SUPPORT_SECOND_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("🎮 陪玩订单详情")
        .setDescription(`${sep()}\n你的订单已记录，我们会温柔地安排陪玩～\n${sep()}\n\n📋 **订单信息**`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1440965791313952868/Generated_Image_November_20_2025_-_1_45PM.png?ex=69201378&is=691ec1f8&hm=2ba4de5f511070f09474d79525165cc9ce3a552b90766c65963546a58710f6a7&")
        .addFields(
          { name: "👤 用户", value: `**${user}**`, inline: true },
          { name: "🎮 游戏", value: game, inline: true },
          { name: "⏰ 预约时间", value: time, inline: true },
          { name: "🎯 模式", value: mode, inline: true },
          { name: "✨ 特别需求", value: extra || "无", inline: false },
          { name: "⌚ 创建时间", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "📊 订单状态", value: "🔔 待派单", inline: true }
        )
        .setFooter({ text: "陪玩后宫 • 感谢你的信任 💗" })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("assign_order")
          .setLabel("📋 派单")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("renew_order")
          .setLabel("🔄 续单")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("🔒 关闭工单")
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({
        content: `<@&${config.adminRoleId}> <@&${SUPPORT_SECOND_ROLE_ID}> 📢 新陪玩工单来自 ${user}`,
        embeds: [embed],
        components: [row],
      });

      // 🕐 设置自动关闭：24小时后自动关闭ticket
      const ticketKey = ticketChannel.id;
      const timeoutId = setTimeout(async () => {
        try {
          const channel = await client.channels.fetch(ticketKey).catch(() => null);
          if (channel) {
            await channel.send({
              content: "⏰ 工单已运行24小时，现已自动关闭。如有新需求请重新提交～",
            });
            setTimeout(() => {
              // 【修复问题 20】检查 Channel 是否仍然存在
              try {
                channel.delete().catch((err) => {
                  if (err.code !== 10003) { // 10003: Unknown channel
                    console.warn("⚠️  删除 Ticket Channel 失败:", err.message);
                  }
                });
              } catch (err) {
                console.error("❌ Ticket 频道删除异常:", err.message);
              }
            }, 2000);
            ticketTimers.delete(ticketKey);
          }
        } catch (err) {
          console.error("❌ 自动关闭ticket错误:", err.message);
          // 确保清理 timer，即使出错
          ticketTimerCleanup(ticketKey);
        }
      }, TICKET_TIMEOUT);

      // 保存timer ID方便取消（如果手动关闭）
      ticketTimers.set(ticketKey, timeoutId);

      await interaction.reply({
        content: `✨ 你的陪玩工单已创建：${ticketChannel}，我们会尽快安排～`,
        ephemeral: true,
      });

      return;
    }

    // ---------------------------------------------------------
    // 点击「📋 派单」按钮 → 打开派单 Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "assign_order") {
      // 只允许管理员或拥有指定管理员角色的成员派单
      const member =
        interaction.guild.members.cache.get(interaction.user.id) ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

      if (!member) {
        await interaction.reply({ content: "❌ 无法验证你的权限。", ephemeral: true });
        return;
      }

      const isAdmin =
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.has(config.adminRoleId);

      if (!isAdmin) {
        await interaction.reply({ content: "❌ 抱歉，只有管理员可以进行派单操作。", ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("assignForm")
        .setTitle("📋 派单详情");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("player")
            .setLabel("🆔陪玩用户名")
            .setPlaceholder("例如：小雪 / 小布丁")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("game")
            .setLabel("🎮游戏名称")
            .setPlaceholder("例如：Valorant / CS2 / Apex")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("⏰时长")
            .setPlaceholder("例如：2 小时 / 3 局")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("price")
            .setLabel("💲价格 (RM)")
            .setPlaceholder("例如：20 / 40 / 60")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // 派单 Modal 提交（新派单记录）
    // ---------------------------------------------------------
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "assignForm"
    ) {
      const guild = interaction.guild;
      const assigner = interaction.user.tag;
      const channel = interaction.channel;
      const topic = channel.topic || "";
      const customer = topic.startsWith("ticket_user:")
        ? topic.split("ticket_user:")[1]
        : "未知";

      const player = interaction.fields.getTextInputValue("player");
      const game = interaction.fields.getTextInputValue("game");
      const duration = interaction.fields.getTextInputValue("duration");
      const price = parsePrice(interaction.fields.getTextInputValue("price"));

      // ⭐ 随机生成单号
      const orderNo = generateOrderNumber();

      // 保存到数据库
      try {
        await db.addOrder({
          type: "dispatch",
          boss: assigner,
          player,
          orderType: game,
          duration,
          amount: price,
          date: new Date().toLocaleString("zh-CN"),
          source: "dispatchForm",
          orderNo,
        });
      } catch (err) {
        console.error("保存派单到数据库失败：", err);
      }

      // 更新统计
      try {
        const stats = await db.getStats();
        await db.updateStats(stats.totalOrders + 1, stats.totalRevenue + Number(price));
      } catch (err) {
        console.error("更新统计失败：", err);
      }

      // 📱 自动发送派单到 Telegram（仅第一个群）
      const telegramOrderMsg = `<b>📋 新的派单记录</b>
━━━━━━━━━━━━━━━━━━
<b>🙋 派单员:</b> ${assigner}
<b>🧚 陪玩员:</b> ${player}
<b>🎮 游戏:</b> ${game}
<b>⏰ 时长:</b> ${duration}
<b>💰 价格:</b> RM ${price}
<b>📦 单号:</b> ${orderNo}
<b>📅 时间:</b> ${new Date().toLocaleString("zh-CN")}
━━━━━━━━━━━━━━━━━━`;
      await sendTelegramReport(config.telegramChatId, telegramOrderMsg, config.telegramMessageThreadId).catch(() => {});

      // 新派单记录 embed（粉色可爱风）
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("📋 新派单记录～【派单确认】")
        .setDescription(`${sep()}\n✨ 新派单已登记，我们会温柔地跟进～\n${sep()}\n\n👥 **派单详情**`)
        .addFields(
          { name: "🙋‍♂️ 派单员", value: `**${assigner}**`, inline: true },
          { name: "🧚‍♀️ 陪玩员", value: `**${player}**`, inline: true },
          { name: "🎮 游戏", value: game, inline: true },
          { name: "⏰ 时长", value: duration, inline: true },
          { name: "💰 价格", value: `**RM ${price}**`, inline: true },
          { name: "🆔 客户ID", value: customer, inline: true },
          { name: "📦 单号", value: `\`\`\`${orderNo}\`\`\``, inline: false },
          { name: "⌚ 派单时间", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "✅ 单据状态", value: "✔️ 已确认", inline: true }
        )
        .setFooter({
          text: "已写入 orders.json 并更新统计 • 谢谢你的配合 💗",
        })
        .setTimestamp();

      const logChannel =
        guild.channels.cache.get(LOG_CHANNEL_ID) ||
        (await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }

      // 检查channel是否存在（可能已被删除）
      if (interaction.channel) {
        await interaction.reply({
          content: "✅ 派单已成功记录，感谢你～",
          ephemeral: true,
        }).catch(() => {
          // 如果interaction失效，忽略错误
          console.log("派单modal reply失败，但数据已保存");
        });
      }

      return;
    }

    // ---------------------------------------------------------
    // 点击「🔄 续单」按钮 → 打开续单 Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "renew_order") {
      const modal = new ModalBuilder()
        .setCustomId("renewForm")
        .setTitle("🔄 续单详情");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("player")
            .setLabel("🆔陪玩用户名")
            .setPlaceholder("例如：小雪 / 小布丁")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("game")
            .setLabel("🎮游戏名称")
            .setPlaceholder("例如：Valorant / CS2 / Apex")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("⏰时长")
            .setPlaceholder("例如：2 小时 / 3 局")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("price")
            .setLabel("💲价格 (RM)")
            .setPlaceholder("例如：20 / 40 / 60")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("original_order")
            .setLabel("📦原单号（续单用）")
            .setPlaceholder("输入原单号，如没有可留空")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // 续单 Modal 提交（新续单记录）
    // ---------------------------------------------------------
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "renewForm"
    ) {
      const guild = interaction.guild;
      const assigner = interaction.user.tag;
      const channel = interaction.channel;
      const topic = channel.topic || "";
      const customer = topic.startsWith("ticket_user:")
        ? topic.split("ticket_user:")[1]
        : "未知";

      const player = interaction.fields.getTextInputValue("player");
      const game = interaction.fields.getTextInputValue("game");
      const duration = interaction.fields.getTextInputValue("duration");
      const price = parsePrice(interaction.fields.getTextInputValue("price"));
      const originalOrder = interaction.fields.getTextInputValue("original_order");

      // ⭐ 随机生成新单号
      const orderNo = generateOrderNumber();

      // 写入 orders.json
      try {
        await db.addOrder({
          type: "renew_dispatch",
          boss: assigner,
          player,
          orderType: game,
          duration,
          amount: price,
          date: new Date().toLocaleString("zh-CN"),
          source: "renewDispatchForm",
          orderNo,
        });
      } catch (err) {
        console.error("保存续单到数据库失败：", err);
      }

      // 更新统计
      try {
        const stats = await db.getStats();
        await db.updateStats(stats.totalOrders + 1, stats.totalRevenue + Number(price));
      } catch (err) {
        console.error("更新统计失败：", err);
      }

      // 📱 自动发送续单到 Telegram
      const telegramRenewMsg = `<b>🔄 新的续单记录</b>
━━━━━━━━━━━━━━━━━━
<b>🙋 派单员:</b> ${assigner}
<b>🧚 陪玩员:</b> ${player}
<b>🎮 游戏:</b> ${game}
<b>⏰ 时长:</b> ${duration}
<b>💰 价格:</b> RM ${price}
<b>📦 新单号:</b> ${orderNo}
<b>📦 原单号:</b> ${originalOrder || "未记录"}
<b>👤 客户ID:</b> ${customer}
<b>📅 时间:</b> ${new Date().toLocaleString("zh-CN")}
━━━━━━━━━━━━━━━━━━`;
      await sendTelegramReport(config.telegramChatId, telegramRenewMsg, config.telegramMessageThreadId).catch(() => {});

      // 📊 发送续单记录到日志频道
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("🔄 新续单记录")
        .setDescription(`${sep()}\n续单已登记，我们会温柔地跟进～\n${sep()}`)
        .addFields(
          { name: "🙋‍♂️ 派单员", value: assigner, inline: true },
          { name: "🧚‍♀️ 陪玩员", value: player, inline: true },
          { name: "🎮 游戏", value: game, inline: true },
          { name: "⏰ 时长", value: duration, inline: true },
          { name: "💰 价格", value: `RM ${price}`, inline: true },
          { name: "🆔 客户ID", value: customer, inline: true },
          { name: "📦 新单号", value: `📦 ${orderNo}`, inline: true },
          { name: "📦 原单号", value: `📦 ${originalOrder || "未记录"}`, inline: true }
        )
        .setFooter({
          text: "已写入 orders.json 并更新统计 • 谢谢你的配合 💗",
        })
        .setTimestamp();

      const logChannel =
        guild.channels.cache.get(LOG_CHANNEL_ID) ||
        (await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }

      // 检查channel是否存在（可能已被删除）
      if (interaction.channel) {
        await interaction.reply({
          content: "✅ 续单已成功记录，感谢你～",
          ephemeral: true,
        }).catch(() => {
          // 如果interaction失效，忽略错误
          console.log("续单modal reply失败，但数据已保存");
        });
      }

      return;
    }

    // ---------------------------------------------------------
    // 关闭陪玩工单
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "close_ticket") {
      const channel = interaction.channel;
      const ticketKey = channel.id;

      // 清除自动关闭timer
      if (ticketTimers.has(ticketKey)) {
        clearTimeout(ticketTimers.get(ticketKey));
        ticketTimers.delete(ticketKey);
      }

      await interaction.reply({
        content: "🔒 工单将在 5 秒后关闭。感谢你的配合～",
        ephemeral: true,
      });

      setTimeout(() => {
        channel.delete().catch(() => {});
      }, 5000);

      return;
    }

    // ---------------------------------------------------------
    // /record（手动更新/发送统计 embed）
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "record"
    ) {
      const member =
        interaction.guild.members.cache.get(interaction.user.id) ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

      if (!member) {
        await interaction.reply({ content: "❌ 无法验证你的权限。", ephemeral: true });
        return;
      }

      const isAdmin =
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.has(config.adminRoleId);

      if (!isAdmin) {
        await interaction.reply({ content: "❌ 仅管理员可执行此命令。", ephemeral: true });
        return;
      }

      try {
        await updateStatsSummaryEmbed(interaction.guild).catch(() => {});
        await interaction.reply({ content: "✅ 已更新/发送派单统计 embed。", ephemeral: true });
      } catch (err) {
        console.error("/record 更新统计失败:", err);
        await interaction.reply({ content: "❌ 更新统计时出错。", ephemeral: true });
      }

      return;
    }

    // ---------------------------------------------------------
    // /db（数据库管理中心 - 综合控制面板）
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "db"
    ) {
      const member =
        interaction.guild.members.cache.get(interaction.user.id) ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

      if (!member) {
        await interaction.reply({ content: "❌ 无法验证你的权限。", ephemeral: true });
        return;
      }

      const isAdmin =
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.has(config.adminRoleId);

      if (!isAdmin) {
        await interaction.reply({ content: "❌ 仅管理员可执行此命令。", ephemeral: true });
        return;
      }

      try {
        const dbPanel = await buildDbPanelEmbed();
        await interaction.reply(dbPanel);
      } catch (err) {
        console.error("/db 命令错误:", err);
        await interaction.reply({
          content: "❌ 获取数据库信息失败。",
          ephemeral: true,
        });
      }

      return;
    }

    // ---------------------------------------------------------
    // /db 按钮处理器 - db_info
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_info") {
      try {
        console.log("[db_info] 开始处理...");
        await interaction.deferReply({ ephemeral: true });

        const stats = await db.getStats();
        const allOrders = await db.getAllOrders();
        const fs = require("fs");
        const stat = fs.statSync("./data.db");
        console.log("[db_info] 数据获取成功");

        const embed = new EmbedBuilder()
          .setColor(0xff99cc)
          .setTitle("📊 数据库详细信息")
          .setFields(
            {
              name: "📈 统计数据",
              value: `\`\`\`\n总订单数: ${stats.totalOrders || 0}\n总收入: RM ${(stats.totalRevenue || 0).toFixed(2)}\n平均单价: RM ${stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : "0.00"}\n\`\`\``,
              inline: false,
            },
            {
              name: "💾 数据库状态",
              value: `\`\`\`\n记录总数: ${allOrders.length}\n数据库大小: ${(stat.size / 1024).toFixed(2)} KB\n最后更新: ${stats.lastUpdated || "未知"}\n文件位置: ./data.db\n\`\`\``,
              inline: false,
            }
          )
          .setFooter({ text: "刷新数据: 点击主菜单的 🔄 按钮" });

        await interaction.editReply({ embeds: [embed] });
        console.log("[db_info] 完成");
      } catch (err) {
        console.error("db_info 错误:", err);
        try {
          await interaction.editReply({
            content: `❌ 获取信息失败: ${err.message}`,
          });
        } catch (e) {
          console.error("db_info 回复失败:", e);
        }
      }
      return;
    }

    // ---------------------------------------------------------
    // /db 按钮处理器 - db_edit
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_edit") {
      try {
        console.log("[db_edit] 开始处理...");
        await interaction.deferReply({ ephemeral: true });

        const allOrders = await db.getAllOrders();
        console.log("[db_edit] 获取订单数:", allOrders.length);

        if (allOrders.length === 0) {
          await interaction.editReply({
            content: "📋 目前没有订单可编辑。",
          });
          return;
        }

        // 显示最近的 5 条订单
        const recent = allOrders.slice(0, 5);
        let orderList = "```\n【可编辑的最近订单】\n\n";

        recent.forEach((order, idx) => {
          orderList += `[${idx + 1}] ID:${order.id}\n    玩家: ${order.player || "未填"}\n    金额: RM ${order.amount || 0}\n\n`;
        });

        orderList += "```";

        const embed = new EmbedBuilder()
          .setColor(0xff99cc)
          .setTitle("✏️ 编辑数据")
          .setDescription(orderList)
          .addFields(
            {
              name: "📝 如何编辑",
              value: "• 使用 `node db-edit.js` 进行详细编辑\n• 或在 Discord 中要求管理员协助编辑\n• 支持修改: 玩家名、金额、订单类型等",
            }
          )
          .setFooter({ text: "需要修改? 请告知相关人员" });

        await interaction.editReply({ embeds: [embed] });
        console.log("[db_edit] 完成");
      } catch (err) {
        console.error("db_edit 错误:", err);
        try {
          await interaction.editReply({
            content: `❌ 获取编辑信息失败: ${err.message}`,
          });
        } catch (e) {
          console.error("db_edit 回复失败:", e);
        }
      }
    }

    // ---------------------------------------------------------
    // /db 按钮处理器 - db_manager
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_manager") {
      try {
        console.log("[db_manager] 开始处理...");
        await interaction.deferReply({ ephemeral: true });

        const allOrders = await db.getAllOrders();
        const stats = await db.getStats();
        console.log("[db_manager] 数据获取成功");

        const embed = new EmbedBuilder()
          .setColor(0xff99cc)
          .setTitle("⚙️ 数据库管理")
          .setDescription("选择管理选项:")
          .addFields(
            {
              name: "📊 现有订单",
              value: `\`\`\`\n${allOrders.length} 条订单记录\n${stats.totalOrders || 0} 个有效订单\n\`\`\``,
            },
            {
              name: "🔧 可用操作",
              value: "• 使用 `node db-manager.js` 进行完整管理\n• 支持: 查看、搜索、删除、导出\n• 建议: 定期备份数据库",
            }
          )
          .setFooter({ text: "更多操作请使用命令行工具" });

        await interaction.editReply({ embeds: [embed] });
        console.log("[db_manager] 完成");
      } catch (err) {
        console.error("db_manager 错误:", err);
        try {
          await interaction.editReply({
            content: `❌ 获取管理信息失败: ${err.message}`,
          });
        } catch (e) {
          console.error("db_manager 回复失败:", e);
        }
      }
    }

    // ---------------------------------------------------------
    // /db 按钮处理器 - db_export_excel (现在导出CSV从SQLite)
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_export_excel") {
      try {
        console.log("[db_export_excel] 开始处理...");
        await interaction.deferReply({ ephemeral: true });

        // 【修改】直接从SQLite数据库读取数据
        const allOrders = db.getAllOrders();
        console.log(`[db_export_excel] 从SQLite读取 ${allOrders.length} 条记录`);

        if (allOrders.length === 0) {
          await interaction.editReply({
            content: "📊 SQLite数据库中暂无数据可导出～",
          });
          return;
        }

        // 使用SQLite CLI导出CSV（不再使用exporter的Excel逻辑）
        const fileName = `订单数据_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
        const filePath = sqliteExporter.exportToCSV(fileName);
        
        const reportCount = allOrders.filter(o => o.type === 'report').length;
        const dispatchCount = allOrders.filter(o => o.type !== 'report').length;
        const attachment = new AttachmentBuilder(filePath, { name: fileName });
        
        await interaction.editReply({
          content: `✅ 已导出 ${reportCount} 条报备记录 + ${dispatchCount} 条派单记录\n📊 总计: ${allOrders.length} 条\n💾 CSV文件已生成，请下载`,
          files: [attachment],
        });
        console.log("[db_export_excel] 完成");

        // 自动删除临时文件
        sqliteExporter.deleteFileAsync(filePath, 5000);
      } catch (err) {
        console.error("db_export_excel 错误:", err);
        try {
          await interaction.editReply({
            content: `❌ 导出 CSV 失败: ${err.message}`,
          });
        } catch (e) {
          console.error("db_export_excel 回复失败:", e);
        }
      }
    }

    // ---------------------------------------------------------
    // /db 按钮处理器 - db_export_json
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_export_json") {
      try {
        console.log("[db_export_json] 开始处理...");
        await interaction.deferReply({ ephemeral: true });

        const allOrders = await db.getAllOrders();
        console.log("[db_export_json] 获取订单数:", allOrders.length);

        if (allOrders.length === 0) {
          await interaction.editReply({
            content: "📊 暂无数据可导出～",
          });
          return;
        }

        // 【改进】使用 exporter 模块处理导出
        const filePath = exporter.exportToJSON(allOrders);
        const attachment = new AttachmentBuilder(filePath);
        await interaction.editReply({
          content: `✅ 已导出 ${allOrders.length} 条订单记录`,
          files: [attachment],
        });
        console.log("[db_export_json] 完成");

        // 自动删除临时文件
        exporter.deleteFileAsync(filePath, 2000);
      } catch (err) {
        console.error("db_export_json 错误:", err);
        try {
          await interaction.editReply({
            content: `❌ 导出 JSON 失败: ${err.message}`,
          });
        } catch (e) {
          console.error("db_export_json 回复失败:", e);
        }
      }
    }

    // ---------------------------------------------------------
    // /db 按钮处理器 - db_refresh
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_refresh") {
      try {
        console.log("[db_refresh] 开始处理...");
        
        // 重新获取数据库统计信息
        const stats = await db.getStats();
        const allOrders = await db.getAllOrders();
        console.log("[db_refresh] 数据获取成功");

        const newEmbed = new EmbedBuilder()
          .setColor(0xff99cc)
          .setTitle("📊 数据库管理中心")
          .setDescription("选择下方功能按钮进行相应操作～")
          .setFields(
            {
              name: "📈 数据库统计",
              value: `\`\`\`\n总订单数: ${stats.totalOrders || 0}\n总收入: RM ${(stats.totalRevenue || 0).toFixed(2)}\n记录总数: ${allOrders.length}\n最后更新: ${stats.lastUpdated || "未知"}\n\`\`\``,
              inline: false,
            }
          )
          .setFooter({ text: "✅ 已刷新数据 | 💡 提示: 点击下方按钮选择功能" });

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("db_info")
            .setLabel("📊 数据库信息")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("📊"),

          new ButtonBuilder()
            .setCustomId("db_edit")
            .setLabel("✏️ 编辑数据")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("✏️"),

          new ButtonBuilder()
            .setCustomId("db_manager")
            .setLabel("⚙️ 数据管理")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("⚙️")
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("db_export_excel")
            .setLabel("📥 导出 Excel")
            .setStyle(ButtonStyle.Success)
            .setEmoji("📥"),

          new ButtonBuilder()
            .setCustomId("db_export_json")
            .setLabel("💾 导出 JSON")
            .setStyle(ButtonStyle.Success)
            .setEmoji("💾"),

          new ButtonBuilder()
            .setCustomId("db_refresh")
            .setLabel("🔄 刷新数据")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🔄")
        );

        await interaction.update({
          embeds: [newEmbed],
          components: [row1, row2],
        });
        console.log("[db_refresh] 完成");
      } catch (err) {
        console.error("db_refresh 错误:", err);
        try {
          await interaction.reply({
            content: `❌ 刷新失败: ${err.message}`,
            ephemeral: true,
          });
        } catch (e) {
          console.error("db_refresh 回复失败:", e);
        }
      }
    }

    // ---------------------------------------------------------
    // /statssetup（发送统计按钮面板）
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "statssetup"
    ) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("📊 派單統計中心")
        .setDescription(`${sep()}\n点击下方按钮可查看或重置派单统计～\n${sep()}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("view_stats")
          .setLabel("📈 查看统计")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("reset_stats")
          .setLabel("🔁 重置统计")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });

      return;
    }

    // =============================================================
    // 统计系统（查看 / 重置 / 自动更新）
    // =============================================================
    async function readStats() {
      return await db.getStats();
    }

    async function resetStatsCounts() {
      const data = {
        totalOrders: 0,
        totalRevenue: 0,
      };
      await db.updateStats(0, 0);
    }

    async function updateStatsSummaryEmbed(guild) {
      const stats = await readStats();
      const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
      if (!channel) return;

      //查找是否已有自动统计 embed
      const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
      const existing = messages?.find(
        (m) =>
          m.author.id === client.user.id &&
          m.embeds?.[0]?.title === "📊 新派单统计（自动更新）"
      );

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("📊 新派单统计（自动更新）")
        .setDescription(`${sep()}\n以下为温柔统计总览～\n${sep()}`)
        .addFields(
          { name: "派单总数", value: `${stats.totalOrders}`, inline: true },
          {
            name: "订单总金额",
            value: `RM ${Number(stats.totalRevenue || 0).toFixed(2)}`,
            inline: true,
          },
          {
            name: "最后更新时间",
            value: `${
              stats.lastUpdated
                ? new Date(stats.lastUpdated).toLocaleString()
                : "无"
            }`,
            inline: false,
          }
        )
        .setTimestamp();

      if (existing) {
        await existing.edit({ embeds: [embed] }).catch(() => {});
      } else {
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // 查看统计（按钮）
    if (interaction.isButton() && interaction.customId === "view_stats") {
      const stats = await readStats();
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("📈 新派单统计（即时）")
        .setDescription(`${sep()}\n这是当前的统计数据，感谢你一直的支持～\n${sep()}`)
        .addFields(
          { name: "派单总数", value: `${stats.totalOrders}`, inline: true },
          {
            name: "订单总金额",
            value: `RM ${Number(stats.totalRevenue || 0).toFixed(2)}`,
            inline: true,
          },
          {
            name: "最后更新时间",
            value: `${
              stats.lastUpdated
                ? new Date(stats.lastUpdated).toLocaleString()
                : "无"
            }`,
            inline: false,
          }
        )
        .setTimestamp();

      // 📱 自动发送报表到 Telegram（仅第一个群）
      const telegramStatsMsg = `<b>📊 派单统计报表</b>
━━━━━━━━━━━━━━━━━━
<b>📈 派单总数:</b> ${stats.totalOrders}
<b>💰 订单总金额:</b> RM ${Number(stats.totalRevenue || 0).toFixed(2)}
<b>⏰ 最后更新时间:</b> ${
        stats.lastUpdated
          ? new Date(stats.lastUpdated).toLocaleString("zh-CN")
          : "无"
      }
━━━━━━━━━━━━━━━━━━
🔔 报表已在 Discord 查看`;
      // 异步发送Telegram，不阻塞Discord响应
      sendTelegramReport(config.telegramChatId, telegramStatsMsg, config.telegramMessageThreadId).catch(() => {});

      await updateStatsSummaryEmbed(interaction.guild).catch(() => {});
      await interaction.reply({ embeds: [embed], flags: 64 }).catch(() => {
        console.log("view_stats reply失败，但数据已处理");
      });
      return;
    }

    // 重置统计（管理员）
    if (interaction.isButton() && interaction.customId === "reset_stats") {
      const member =
        interaction.guild.members.cache.get(interaction.user.id) ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

      if (!member) {
        await interaction.reply({ content: "❌ 无法验证你的权限。请稍后重试或联系管理员～", ephemeral: true });
        return;
      }

      const isAdmin =
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.has(config.adminRoleId);

      if (!isAdmin) {
        await interaction.reply({ content: "❌ 仅管理员可以重置统计。若你认为这是误判请联系管理员～", ephemeral: true });
        return;
      }

      resetStatsCounts();
      await updateStatsSummaryEmbed(interaction.guild).catch(() => {});

      await interaction.reply({
        content: "🔁 统计已重置！totalOrders 与 totalRevenue 已设为 0，温柔地开始新的统计～",
        ephemeral: true,
      });

      return;
    }

    // ====================== 陪玩/派单/统计 系统结束 ======================
    // ---------------------------------------------------------
    // /supportsetup（建立客服按钮）
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "supportsetup"
    ) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("💬 客服中心")
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1440965790764503060/Generated_Image_November_20_2025_-_1_44PM.png?ex=69201378&is=691ec1f8&hm=b557cca8284e29b7c5610a868db7d6ae31610c0c4fd8d8e717bad59cbc0c839b&")
        .setDescription(`${sep()}\n需要帮助？点击下方按钮联系工作人员。\n${sep()}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_support")
          .setLabel("💬 联系客服")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ---------------------------------------------------------
    // 打开客服表单 Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "open_support") {
      const modal = new ModalBuilder()
        .setCustomId("supportForm")
        .setTitle("💬 客服表单");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("type")
            .setLabel("🧩 问题类型")
            .setPlaceholder("例如：订单问题 / 技术问题 / 投诉")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("description")
            .setLabel("📝 问题描述")
            .setPlaceholder("请尽量详细描述你的问题")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // 提交客服表单 → 创建客服频道
    // ---------------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId === "supportForm") {
      const guild = interaction.guild;
      const user = interaction.user;

      const type = interaction.fields.getTextInputValue("type");
      const desc = interaction.fields.getTextInputValue("description");

      const channelName = `support-${sanitizeName(user.username)}`;

      // 避免重复开客服
      const existing = guild.channels.cache.find((c) => c.name === channelName);
      if (existing) {
        await interaction.reply({
          content: "❗ 你已有一个客服频道。请在原频道继续沟通～",
          ephemeral: true,
        });
        return;
      }

      // 写入 support_logs.json
      try {
        const logs = readJSON(SUPPORT_PATH) || [];
        logs.push({
          id: logs.length + 1,
          user: user.tag,
          type,
          desc,
          date: new Date().toLocaleString("zh-CN"),
        });
        writeJSON(SUPPORT_PATH, logs);
      } catch (err) {
        console.error("写入支持记录失败:", err);
      }

      // 创建客服频道
      const supportChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: SUPPORT_CATEGORY_ID,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          },
          {
            id: config.adminRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          },
          {
            id: SUPPORT_SECOND_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("💬 客服问题详情")
        .setDescription(`${sep()}\n我们已收到你的问题，工作人员会很快联系你～\n${sep()}`)
        .addFields(
          { name: "🧩 类型", value: type, inline: true },
          { name: "📝 描述", value: desc, inline: false }
        )
        .setFooter({ text: `来自用户：${user.tag}` })
        .setTimestamp();

      const closeBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_support")
          .setLabel("📞 关闭客服")
          .setStyle(ButtonStyle.Danger)
      );

      await supportChannel.send({
        content: `💬 ${user} 的客服频道已建立，工作人员会尽快处理～`,
        embeds: [embed],
        components: [closeBtn],
      });

      await interaction.reply({
        content: `✅ 客服频道已创建：${supportChannel}`,
        ephemeral: true,
      });

      return;
    }

    // ---------------------------------------------------------
    // 关闭客服频道
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "close_support") {
      const channel = interaction.channel;

      await interaction.reply({
        content: "📞 此客服频道将在 5 秒后关闭。感谢你的配合～",
        ephemeral: true,
      });

      setTimeout(() => {
        channel.delete().catch(() => {});
      }, 5000);

      return;
    }
  } catch (err) {
    console.error("interactionCreate handler error:", err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ 处理请求时发生错误，请联系管理员。",
          ephemeral: true,
        });
      }
    } catch {}
  }
});

// =============================================================
// 欢迎系统（粉色可爱风）
// ---------------- Welcome & keyword replies ----------------
client.on("guildMemberAdd", async (member) => {
  try {
    const channel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (!channel) return;

    // Banner 图片（上传到 Discord 后复制图片链接）
    const bannerUrl = "https://cdn.discordapp.com/attachments/1433987480524165213/1436675976376483840/2567ced4-39ff-4b37-b055-31839c369199_1.png?ex=69107844&is=690f26c4&hm=8b29dfdfb09bf715c2bdbf3b895a070b7fdf356a6476b52cbe40b157251aa90b&"; // ← 替换为你的Banner图

    // 1️⃣ 发送像素风「欢迎贵客光临」Banner
    const bannerEmbed = new EmbedBuilder()
      .setColor(0xffc800)
      .setTitle("👑 欢迎贵客光临 👑")
      .setImage(bannerUrl)
      .setFooter({ text: "后宫佳丽 · 陪玩俱乐部" });

    // 2️⃣ 原本的欢迎信息
    const infoEmbed = new EmbedBuilder()
      .setColor(0xff8cff)
      .setTitle(`🌸 欢迎加入，${member.user.username}！💫`)
      .setDescription(
        `嗨嗨 ${member} 💕
欢迎来到 **${member.guild.name}** ～！

✨ 在这里你可以：
📜 信息区：<#1433927932765540473>
🎮 点单区：<#1433718201690357802>
💬 客服传送门：<#1434458460824801282>
✨ 放轻松，这里不只是群～
💞 这里是一个能让你笑出来的小世界 💫

> 👑 欢迎来到 · **你的后宫佳丽**
> 愿你在这里收获陪伴与快乐 ❤️`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "陪玩后宫 ✨ 让游戏更有趣" })
      .setTimestamp();

    // 连续发送两条 Embed
    await channel.send({ embeds: [bannerEmbed] });
    await channel.send({ content: `🎉 ${member} 欢迎来到 **${member.guild.name}**！💞`, embeds: [infoEmbed] });

  } catch (err) {
    console.error("welcome message error:", err);
  }
});

// =============================================================
// ❌ 本版本 v4.2c-Pink 已移除关键词自动回复（messageCreate）
// =============================================================

// =============================================================
// MESSAGE LISTENER - 监听特定频道的消息并转发到 Telegram
// =============================================================
client.on("messageCreate", async (message) => {
  // 忽略机器人消息
  if (message.author.bot) return;
  
  // 只监听报备频道的消息
  if (message.channel.id !== REPORT_CHANNEL_ID) return;

  try {
    const orderNumber = `PO-${Date.now()}`; // 生成订单号
    
    // 从消息内容中提取陪陪名字和金额（假设格式中包含这些信息）
    // 可以根据你的实际消息格式进行调整
    const contentLines = message.content.split('\n');
    let playerName = "未填写";
    let amount = "未填写";
    
    // 简单的提取逻辑 - 可以根据实际需求修改
    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i];
      if (line.includes("陪陪") || line.includes("陪玩")) {
        playerName = line.replace(/陪陪|陪玩|：|:/g, "").trim();
      }
      if (line.includes("金额") || line.includes("价格") || line.includes("RM")) {
        amount = line.replace(/金额|价格|：|:|RM/g, "").trim();
      }
    }

    const professionalTemplate = `📝 <b>报备单已收到</b>

📌 <b>单号:</b> #${orderNumber}
👤 <b>客户:</b> ${message.author.username}
🧚‍♀️ <b>陪陪:</b> ${playerName}
💰 <b>金额:</b> ${amount}
💬 <b>内容:</b>
${message.content}

⏰ <b>时间:</b> ${new Date().toLocaleString("zh-CN")}`;

    // 发送到 Telegram
    await axios.post(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
      chat_id: config.telegramChatId,
      text: professionalTemplate,
      parse_mode: "HTML"
    });

    console.log("✅ 报备已发送到 Telegram");
  } catch (err) {
    console.error("❌ Telegram 发送错误:", err.response?.data || err.message);
  }
});

client.login(config.token);

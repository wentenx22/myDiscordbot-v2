// 【!最优先!】为低版本Node.js添加ReadableStream polyfill - 必须在所有require前执行
if (typeof ReadableStream === 'undefined') {
  global.ReadableStream = require('stream').Readable;
}
// =============================================================
// index.js - v4.2c-Pink (v4.2b-Pink åŸºç¡€ä¸Šæ–°å¢žï¼šå¼€æœºè‡ªåŠ¨æ£€æµ‹å¹¶å‘é€æ´¾å•ç»Ÿè®¡ä¸­å¿ƒé¢æ¿)
// å˜æ›´è¯´æ˜Žï¼š
// - åœ¨ client.once("ready") ä¸­å¢žåŠ è‡ªåŠ¨æ£€æµ‹ LOG_CHANNEL_ID æ˜¯å¦å­˜åœ¨ "ðŸ“Š æ´¾å•ç»Ÿè®¡ä¸­å¿ƒ" embed
// - è‹¥ä¸å­˜åœ¨åˆ™è‡ªåŠ¨å‘é€ç»Ÿè®¡ embed + æŒ‰é’®ï¼ˆç²‰è‰²å¯çˆ±é£Žï¼‰
// å…¶å®ƒï¼šç»§æ‰¿ v4.2b-Pink çš„ UI ä¸Ž åŠŸèƒ½ï¼ˆç§»é™¤å…³é”®è¯è‡ªåŠ¨å›žå¤ï¼‰
// =============================================================

// åŠ è½½çŽ¯å¢ƒå˜é‡

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
const exporter = require("./exporter"); // ã€æ—§ç‰ˆã€‘å¯¼å…¥å¯¼å‡ºæ¨¡å—
const sqliteExporter = require("./sqlite-exporter"); // ã€æ–°ç‰ˆã€‘SQLite CLIå¯¼å‡ºæ¨¡å—
const statistics = require("./statistics"); // ã€æ–°å¢žã€‘å¯¼å…¥ç»Ÿè®¡æ¨¡å—
const GoogleSheetsExporter = require("./google-sheets-exporter"); // ã€æ–°å¢žã€‘Google Sheetså¯¼å‡ºæ¨¡å—

console.log("ðŸ“Œ [å¯åŠ¨] index.js æ­£åœ¨åŠ è½½...");

// ---------------- CONFIG ----------------
let config = {};
let googleSheetsExporter = null; // Google Sheets å¯¼å‡ºå™¨å®žä¾‹
try {
  config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
  console.log("âœ… [å¯åŠ¨] config.json è¯»å–æˆåŠŸ");
  
  // ã€æ–°å¢žã€‘éªŒè¯å¿…å¡«å­—æ®µ
  const requiredFields = ['token', 'clientId', 'telegramToken', 'telegramChatId', 'adminRoleId'];
  const missingFields = requiredFields.filter(f => !config[f]);
  if (missingFields.length > 0) {
    throw new Error(`config.json ç¼ºå°‘å¿…å¡«å­—æ®µ: ${missingFields.join(', ')}`);
  }
  console.log("âœ… [å¯åŠ¨] config å­—æ®µéªŒè¯æˆåŠŸ");

  // ã€æ–°å¢žã€‘åˆå§‹åŒ– Google Sheets å¯¼å‡ºå™¨
  if (config.googleSheetsId && config.googleApiKey) {
    googleSheetsExporter = new GoogleSheetsExporter(config.googleSheetsId, config.googleApiKey);
    console.log("âœ… [å¯åŠ¨] Google Sheets å¯¼å‡ºå™¨åˆå§‹åŒ–æˆåŠŸ");
  } else {
    console.warn("âš ï¸ [å¯åŠ¨] æœªé…ç½® Google Sheets å‡­è¯ (googleSheetsId æˆ– googleApiKey)");
  }
} catch (err) {
  console.error("âŒ é…ç½®é”™è¯¯:", err.message);
  process.exit(1);
}

// ---------------- CONSTANTS ----------------
const TICKET_CATEGORY_ID = "1434345592997548033";
const SUPPORT_CATEGORY_ID = "1433718201690357808";
const SUPPORT_SECOND_ROLE_ID = "1434475964963749909";
const LOG_CHANNEL_ID = "1433987480524165213"; // ç»Ÿè®¡é¢‘é“
const AUTO_REPORTBB_CHANNEL = "1436684853297938452";
const REPORT_DISPATCH_CHANNEL_ID = "1436268020866617494"; // æŠ¥å¤‡æ´¾å•é¢‘é“
const DB_PANEL_CHANNEL_ID = "1456648851384438978"; // /db é¢æ¿é¢‘é“
const CSV_ARCHIVE_CHANNEL_ID = "1457035667157680431"; // CSV å­˜æ¡£é¢‘é“
const SUPPORT_PATH = "./support_logs.json";

// ä¸»é¢˜é¢œè‰²ï¼ˆæ¨±èŠ±ç²‰ï¼‰
const THEME_COLOR = 0xff99cc;

// ã€æž¶æž„æ”¹é€ ã€‘ç§»é™¤cacheManager - æ‰€æœ‰æ•°æ®éƒ½å®žæ—¶ä»ŽSQLiteæŸ¥è¯¢

// ã€ä¿®å¤é—®é¢˜ 8ã€‘Map æ¸…ç†æœºåˆ¶
const addOrderContext = new Map();
const addOrderContextCleanup = (key, timeout = 300000) => {
  setTimeout(() => {
    if (addOrderContext.has(key)) {
      addOrderContext.delete(key);
      console.log(`ðŸ—‘ï¸ ä¸Šä¸‹æ–‡å·²æ¸…ç†: ${key}`);
    }
  }, timeout);
};

// ã€ä¿®å¤é—®é¢˜ 8ã€‘Ticket Timer æ¸…ç†æœºåˆ¶
const ticketTimers = new Map();
const ticketTimerCleanup = (key) => {
  if (ticketTimers.has(key)) {
    clearTimeout(ticketTimers.get(key));
    ticketTimers.delete(key);
  }
};

// æŠ¥å¤‡é¢‘é“ IDï¼ˆç”¨äºŽæ¶ˆæ¯ç›‘å¬ï¼‰
const REPORT_CHANNEL_ID = config.reportChannelId || AUTO_REPORTBB_CHANNEL;

// ticketè¶…æ—¶æ—¶é—´ï¼ˆ24å°æ—¶ï¼‰
const TICKET_TIMEOUT = 24 * 60 * 60 * 1000;

// =============================================================
// JSON STORAGE UTILITIES (ä»…ç”¨äºŽ support_logs.json)
// =============================================================
const initFile = (p, d) => !fs.existsSync(p) && (fs.writeFileSync(p, JSON.stringify(d, null, 2), "utf8"), console.log(`âœ… å·²åˆ›å»º ${p}`));
const initStorage = () => initFile(SUPPORT_PATH, []);

// ã€ä¿®å¤é—®é¢˜ 11ã€‘æ”¹è¿› JSON è¯»å–ï¼Œæ·»åŠ è¯¦ç»†é”™è¯¯æ—¥å¿—
const readJSON = p => { 
  try { 
    if (!fs.existsSync(p)) {
      console.warn(`âš ï¸ æ–‡ä»¶ä¸å­˜åœ¨: ${p}`);
      return null;
    }
    return JSON.parse(fs.readFileSync(p, "utf8")); 
  } catch (err) { 
    console.error(`âŒ JSON è¯»å–å¤±è´¥ (${p}):`, err.message);
    return null; 
  } 
};

const writeJSON = (p, d) => {
  try {
    fs.writeFileSync(p, JSON.stringify(d, null, 2), "utf8");
  } catch (err) {
    console.error(`âŒ JSON å†™å…¥å¤±è´¥ (${p}):`, err.message);
  }
};

// ã€ä¿®å¤é—®é¢˜ 14ã€‘ç”¨æˆ·è¾“å…¥éªŒè¯å‡½æ•°
const validateInput = (input, type = 'text', maxLen = 100) => {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().slice(0, maxLen);
  
  // é˜²æ­¢ Discord markdown æ³¨å…¥
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
const sep = () => "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”";

// =============================================================
// TELEGRAM UTILITIES
// =============================================================
// ã€ä¿®å¤é—®é¢˜ 10ã€‘æ”¹è¿› Telegram é”™è¯¯å¤„ç†
async function sendTelegramReport(chatId, message, threadId = null) {
  const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
  try {
    const response = await axios.post(url, {
      chat_id: chatId, 
      text: message, 
      parse_mode: "HTML",
      ...(threadId && { message_thread_id: threadId })
    });
    console.log("âœ… Telegram æŠ¥è¡¨å·²å‘é€!");
    return { success: true };
  } catch (err) {
    const errorDesc = err.response?.data?.description || err.message;
    const errorCode = err.response?.status || 'UNKNOWN';
    
    // åŒºåˆ†ä¸åŒçš„é”™è¯¯ç±»åž‹
    if (errorDesc?.includes("TOPIC_DELETED")) {
      console.warn("âš ï¸ Telegram è¯é¢˜å·²è¢«åˆ é™¤ï¼Œè·³è¿‡å‘é€");
      return { success: false, reason: 'TOPIC_DELETED' };
    } else if (errorCode === 429) {
      console.warn("âš ï¸ Telegram é™æµï¼Œè¯·ç¨åŽé‡è¯•");
      return { success: false, reason: 'RATE_LIMITED' };
    } else if (errorCode === 401) {
      console.error("âŒ Telegram token æ— æ•ˆ");
      return { success: false, reason: 'INVALID_TOKEN' };
    } else {
      console.error(`âŒ Telegram å‘é€å¤±è´¥ (${errorCode}):`, errorDesc);
      return { success: false, reason: 'UNKNOWN', error: errorDesc };
    }
  }
}
const sendToMultipleTelegram = (msg, t1) => sendTelegramReport(config.telegramChatId, msg, t1 || config.telegramMessageThreadId).catch(() => {});

// =============================================================
// DATABASE HEALTH CHECK
// =============================================================
// ã€ä¿®å¤é—®é¢˜ 12ã€‘æ•°æ®åº“åˆå§‹åŒ–éªŒè¯å‡½æ•°
const ensureDbInitialized = async () => {
  if (!db.initialized) {
    console.error("âŒ æ•°æ®åº“å°šæœªåˆå§‹åŒ–");
    throw new Error('æ•°æ®åº“æœªå°±ç»ªï¼Œè¯·ç¨åŽé‡è¯•');
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
    // ã€æž¶æž„æ”¹é€ ã€‘ä½¿ç”¨db.getAllOrders()æ›¿ä»£cacheManager.getOrders()
    const allOrders = db.getAllOrders();

    const embed = new EmbedBuilder()
      .setColor(0xff99cc)
      .setTitle("ðŸ“Š æ•°æ®åº“ç®¡ç†ä¸­å¿ƒ")
      .setDescription("é€‰æ‹©ä¸‹æ–¹åŠŸèƒ½æŒ‰é’®è¿›è¡Œç›¸åº”æ“ä½œï½ž")
    .setFields(
      {
        name: "ðŸ“ˆ æ•°æ®åº“ç»Ÿè®¡",
        value: `\`\`\`\næ€»è®¢å•æ•°: ${stats.totalOrders || 0}\næ€»æ”¶å…¥: RM ${(stats.totalRevenue || 0).toFixed(2)}\nè®°å½•æ€»æ•°: ${allOrders.length}\næœ€åŽæ›´æ–°: ${stats.lastUpdated || "æœªçŸ¥"}\n\`\`\``,
        inline: false,
      }
    )
    .setFooter({ text: "ðŸ’¡ æç¤º: ç‚¹å‡»ä¸‹æ–¹æŒ‰é’®é€‰æ‹©åŠŸèƒ½" });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("db_info")
      .setLabel("ðŸ“Š æ•°æ®åº“ä¿¡æ¯")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("ðŸ“Š"),

    new ButtonBuilder()
      .setCustomId("db_edit")
      .setLabel("âœï¸ ç¼–è¾‘æ•°æ®")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("âœï¸"),

    new ButtonBuilder()
      .setCustomId("db_manager")
      .setLabel("âš™ï¸ æ•°æ®ç®¡ç†")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("âš™ï¸")
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("export_excel")
      .setLabel("ðŸ“¥ å¯¼å‡º Excel")
      .setStyle(ButtonStyle.Success)
      .setEmoji("ðŸ“¥"),

    new ButtonBuilder()
      .setCustomId("db_export_json")
      .setLabel("ðŸ’¾ å¯¼å‡º JSON")
      .setStyle(ButtonStyle.Success)
      .setEmoji("ðŸ’¾"),

    new ButtonBuilder()
      .setCustomId("db_refresh")
      .setLabel("ðŸ”„ åˆ·æ–°æ•°æ®")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("ðŸ”„")
  );

  return { embeds: [embed], components: [row1, row2] };
  } catch (err) {
    console.error("âŒ æž„å»ºæ•°æ®åº“é¢æ¿å¤±è´¥:", err.message);
    const fallbackEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("âŒ æ•°æ®åº“é¢æ¿åŠ è½½å¤±è´¥")
      .setDescription(`é”™è¯¯: ${err.message}`);
    return { embeds: [fallbackEmbed], components: [] };
  }
}

// è‡ªåŠ¨å‘é€æ¶ˆæ¯åˆ°é¢‘é“ï¼ˆæ£€æŸ¥æ˜¯å¦å·²å­˜åœ¨ï¼‰- ã€æ”¹è¿›ã€‘æ·»åŠ å®Œæ•´é”™è¯¯å¤„ç†
const autoSendPanel = async (channel, embed, components, title) => {
  if (!channel) {
    console.warn(`âš ï¸  é¢‘é“ä¸å­˜åœ¨ï¼Œè·³è¿‡ã€Ž${title}ã€é¢æ¿`);
    return false;
  }
  try {
    const msgs = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    if (msgs?.some(m => m.author.id === client.user.id && m.embeds?.[0]?.title === title)) {
      console.log(`â„¹ï¸ ã€Ž${title}ã€é¢æ¿å·²å­˜åœ¨ï¼Œè·³è¿‡`);
      return false;
    }
    await channel.send({ embeds: [embed], components });
    console.log(`âœ… å·²å‘é€ã€Ž${title}ã€é¢æ¿`);
    return true;
  } catch (err) {
    console.error(`âŒ å‘é€ã€Ž${title}ã€é¢æ¿å¤±è´¥:`, err.message);
    return false;
  }
};

// =============================================================
// CSV ARCHIVE UTILITY - å‘é€CSVåˆ°å­˜æ¡£é¢‘é“
// =============================================================
async function sendCsvToArchive(filePath, fileName, orderCount, type = '') {
  try {
    if (!client.isReady()) {
      console.warn("âš ï¸ Discord å®¢æˆ·ç«¯æœªå‡†å¤‡å¥½ï¼Œæ— æ³•å‘é€å­˜æ¡£");
      return false;
    }

    const channel = await client.channels.fetch(CSV_ARCHIVE_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.warn("âš ï¸ å­˜æ¡£é¢‘é“ä¸å­˜åœ¨æˆ–éžæ–‡æœ¬é¢‘é“");
      return false;
    }

    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      console.warn(`âš ï¸ CSV æ–‡ä»¶ä¸å­˜åœ¨: ${filePath}`);
      return false;
    }

    const timestamp = new Date().toLocaleString('zh-CN');
    const message = `ðŸ“Š **CSV æ•°æ®å­˜æ¡£**\n` +
      `ðŸ“ æ–‡ä»¶: ${fileName}\n` +
      `ðŸ“ˆ è®°å½•æ•°: ${orderCount} æ¡\n` +
      `ðŸ·ï¸ ç±»åž‹: ${type || 'å¯¼å‡º'}\n` +
      `â° æ—¶é—´: ${timestamp}`;

    const attachment = new AttachmentBuilder(filePath, { name: fileName });
    await channel.send({
      content: message,
      files: [attachment]
    });

    console.log(`âœ… CSV å·²å­˜æ¡£è‡³é¢‘é“: ${fileName}`);
    return true;
  } catch (err) {
    console.error(`âŒ å‘é€ CSV å­˜æ¡£å¤±è´¥:`, err.message);
    return false;
  }
}

// =============================================================
// GOOGLE SHEETS UTILITY - å¯¼å‡ºåˆ° Google Sheets
// =============================================================
async function exportToGoogleSheets(orders, exportType = 'æ•°æ®å¯¼å‡º') {
  try {
    if (!googleSheetsExporter) {
      console.warn("âš ï¸ Google Sheets å¯¼å‡ºå™¨æœªåˆå§‹åŒ–");
      return { success: false, reason: 'NOT_INITIALIZED' };
    }

    if (!orders || orders.length === 0) {
      console.warn("âš ï¸ æ²¡æœ‰æ•°æ®å¯å¯¼å‡º");
      return { success: false, reason: 'NO_DATA' };
    }

    // ä½¿ç”¨æ‰¹é‡æ›´æ–°ï¼ˆæ¸…ç©ºåŽé‡æ–°å†™å…¥æ‰€æœ‰æ•°æ®ï¼‰
    const result = await googleSheetsExporter.exportOrdersToSheet(orders, 'Sheet1');
    
    if (result.success) {
      console.log(`âœ… æˆåŠŸå¯¼å‡º ${result.recordCount} æ¡è®¢å•åˆ° Google Sheets (${exportType})`);
      return {
        success: true,
        recordCount: result.recordCount,
        sheetsUrl: result.sheetsUrl,
        timestamp: new Date().toLocaleString('zh-CN')
      };
    } else {
      console.error("âŒ Google Sheets å¯¼å‡ºå¤±è´¥:", result.error);
      return result;
    }
  } catch (err) {
    console.error("âŒ Google Sheets å¯¼å‡ºå¼‚å¸¸:", err.message);
    return { success: false, error: err.message };
  }
}

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
  console.log(`âœ… å·²ç™»å…¥ï¼š${client.user.tag}`);
  client.user.setActivity("ðŸ’ž é™ªçŽ©ç³»ç»Ÿå·²å¯åŠ¨");

  // ã€æ”¹è¿›ã€‘åˆå§‹åŒ–æ•°æ®åº“ - æ”¹ä¸º Promise é“¾ï¼Œç¡®ä¿åˆå§‹åŒ–å®ŒæˆåŽå†ç»§ç»­
  if (!db.initialized) {
    try {
      console.log("â³ æ­£åœ¨åˆå§‹åŒ–æ•°æ®åº“...");
      await db.init();
      console.log("âœ… SQLite æ•°æ®åº“å·²åˆå§‹åŒ–");
      
      // ã€ä¿®å¤ã€‘ä¸ºæ—§è®°å½•è¡¥ä¸Šæ¥æºæ ‡è®°
      db.fixMissingSource();
    } catch (err) {
      console.error("âŒ æ•°æ®åº“åˆå§‹åŒ–å¤±è´¥:", err.message);
      console.error("âš ï¸  åº”ç”¨å°†ç»§ç»­è¿è¡Œä½†åŠŸèƒ½å—é™");
      // ä¸é€€å‡ºè¿›ç¨‹ï¼Œå…è®¸ bot ç»§ç»­è¿è¡Œä½†è®°å½•é”™è¯¯
      return;
    }
  }

  // ã€ä¿®å¤é—®é¢˜ 19ã€‘æ¯å°æ—¶æ¸…ç†ä¸€æ¬¡æ”¯æŒæ—¥å¿—ï¼ˆåˆ é™¤1å¤©å‰çš„æ—¥å¿—ï¼‰
  setInterval(() => {
    try {
      const logs = readJSON(SUPPORT_PATH);
      if (Array.isArray(logs) && logs.length > 100) {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const filtered = logs.filter(log => {
          try {
            return log.timestamp > oneDayAgo;
          } catch {
            return true; // ä¿ç•™æ— æ³•è§£æžçš„æ—¥å¿—
          }
        });
        
        if (filtered.length < logs.length) {
          writeJSON(SUPPORT_PATH, filtered);
          console.log(`ðŸ§¹ æ”¯æŒæ—¥å¿—å·²æ¸…ç†: åˆ é™¤ ${logs.length - filtered.length} æ¡è¿‡æœŸæ—¥å¿—`);
        }
      }
    } catch (err) {
      console.error("âŒ æ¸…ç†æ”¯æŒæ—¥å¿—å‡ºé”™:", err.message);
    }
  }, 60 * 60 * 1000); // æ¯å°æ—¶æ‰§è¡Œä¸€æ¬¡

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.warn("âš ï¸  æœªæ‰¾åˆ°é¦–ä¸ªæœåŠ¡å™¨ï¼Œè‡ªåŠ¨é¢æ¿åˆå§‹åŒ–è¢«è·³è¿‡");
    return;
  }

  // 1ï¸âƒ£ è‡ªåŠ¨æ£€æµ‹ï¼šå•å­æŠ¥å¤‡é¢æ¿
  try {
    const channel = guild.channels.cache.get(AUTO_REPORTBB_CHANNEL);
    const embed = new EmbedBuilder()
      .setColor(0xff77ff)
      .setTitle("ðŸ“Œ å•å­æŠ¥å¤‡")
      .setDescription("éº»çƒ¦é™ªé™ªä»¬æŽ¥å•åŽæŠ¥å¤‡ä¸€ä¸‹å“ˆï¼Œä»¥æ–¹ä¾¿æˆ‘ä»¬åŽç»­æ ¸å®žå•å­è°¢è°¢ðŸ¥°");
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open_report_modal").setLabel("ðŸ”—æŠ¥å¤‡å•å­").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("open_renew_report_modal").setLabel("ðŸ”„ ç»­å•æŠ¥å¤‡").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("open_gift_modal").setLabel("ðŸŽ ç¤¼ç‰©æŠ¥å¤‡").setStyle(ButtonStyle.Secondary)
    );
    await autoSendPanel(channel, embed, [row], "ðŸ“Œ å•å­æŠ¥å¤‡");
  } catch (err) { console.error("æŠ¥å¤‡é¢æ¿é”™è¯¯:", err); }

  // ==================================================================
  // 2ï¸âƒ£ è‡ªåŠ¨æ£€æµ‹ï¼šé™ªçŽ©ä¸‹å•ç³»ç»Ÿï¼ˆticketsetupï¼‰
  // ==================================================================
  try {
    const ticketChannel = guild.channels.cache.get("1433718201690357802"); // ä¸‹å•ç³»ç»Ÿé¢‘é“
    if (ticketChannel) {
      const msgs = await ticketChannel.messages.fetch({ limit: 20 }).catch(() => null);

      const exists = msgs?.some(
        (m) =>
          m.author.id === client.user.id &&
          m.embeds?.[0]?.title === "ðŸŽŸï¸  é™ªçŽ©ä¸‹å•ç³»ç»Ÿ"
      );

      if (!exists) {
        const embed = new EmbedBuilder()
          .setColor(0xff8cff)
          .setTitle("ðŸŽŸï¸  é™ªçŽ©ä¸‹å•ç³»ç»Ÿ")
          .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1440965791313952868/Generated_Image_November_20_2025_-_1_45PM.png?ex=69201378&is=691ec1f8&hm=2ba4de5f511070f09474d79525165cc9ce3a552b90766c65963546a58710f6a7&")
          .setDescription(`${sep()}\nç‚¹ä¸‹é¢çš„æŒ‰é’®å¡«å†™é™ªçŽ©å•å§ï½ž ðŸ’–\n${sep()}`);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("open_ticket")
            .setLabel("ðŸŽ® ç”³è¯·é™ªçŽ©è®¢å•")
            .setStyle(ButtonStyle.Primary)
        );

        await ticketChannel.send({ embeds: [embed], components: [row] });
        console.log("ðŸŽ® è‡ªåŠ¨å‘é€ã€Žé™ªçŽ©ä¸‹å•ç³»ç»Ÿé¢æ¿ã€å®Œæˆ");
      }
    }
  } catch (err) {
    console.error("ticketsetup auto error:", err);
  }

  // ==================================================================
  // 3ï¸âƒ£ è‡ªåŠ¨æ£€æµ‹ï¼šå®¢æœç³»ç»Ÿï¼ˆsupportsetupï¼‰
  // ==================================================================
  try {
    const supportChannel = guild.channels.cache.get("1434458460824801282"); // å®¢æœé¢‘é“
    if (supportChannel) {
      const msgs = await supportChannel.messages.fetch({ limit: 20 }).catch(() => null);

      const exists = msgs?.some(
        (m) =>
          m.author.id === client.user.id &&
          m.embeds?.[0]?.title === "ðŸ’¬ å®¢æœä¸­å¿ƒ"
      );

      if (!exists) {
        const embed = new EmbedBuilder()
          .setColor(0x00aaff)
          .setTitle("ðŸ’¬ å®¢æœä¸­å¿ƒ")
          .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1440965790764503060/Generated_Image_November_20_2025_-_1_44PM.png?ex=69201378&is=691ec1f8&hm=b557cca8284e29b7c5610a868db7d6ae31610c0c4fd8d8e717bad59cbc0c839b&")
          .setDescription(`${sep()}\néœ€è¦å¸®åŠ©ï¼Ÿç‚¹å‡»ä¸‹æ–¹æŒ‰é’®è”ç³»å·¥ä½œäººå‘˜ã€‚\n${sep()}`);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("open_support")
            .setLabel("ðŸ’¬ è”ç³»å®¢æœ")
            .setStyle(ButtonStyle.Secondary)
        );

        await supportChannel.send({ embeds: [embed], components: [row] });
        console.log("ðŸ’¬ è‡ªåŠ¨å‘é€ã€Žå®¢æœç³»ç»Ÿé¢æ¿ã€å®Œæˆ");
      }
    }
  } catch (err) {
    console.error("supportsetup auto error:", err);
  }

  // 4ï¸âƒ£ Bot å¯åŠ¨é€šçŸ¥
  try {
    const notifyChannel = client.channels.cache.get("1433987480524165213"); // ç»Ÿè®¡é¢‘é“ID
    if (notifyChannel) {
      await notifyChannel.send("ðŸŸ¢ Bot å·²å¯åŠ¨ / é‡å¯å®Œæˆ");
      console.log("ðŸŸ¢ å¯åŠ¨é€šçŸ¥å·²å‘é€");
    } else {
      console.warn("âš ï¸  å¯åŠ¨é€šçŸ¥é¢‘é“æœªæ‰¾åˆ°");
    }
  } catch (err) {
    console.error("âŒ å‘é€å¯åŠ¨é€šçŸ¥å‡ºé”™:", err.message);
  }
});


// =============================================================
// SLASH COMMANDS
// =============================================================
const commands = [
  new SlashCommandBuilder()
    .setName("reportbb")
    .setDescription("å»ºç«‹å•å­æŠ¥å¤‡é¢æ¿")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ticketsetup")
    .setDescription("åˆ›å»ºé™ªçŽ©è®¢å•æŒ‰é’®")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("supportsetup")
    .setDescription("åˆ›å»ºå®¢æœæŒ‰é’®")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // æ–°å¢žï¼šæ¢å¤ç»Ÿè®¡æŒ‰é’®é¢æ¿çš„æŒ‡ä»¤ï¼ˆç®¡ç†å‘˜æƒé™ï¼‰
  new SlashCommandBuilder()
    .setName("statssetup")
    .setDescription("åˆ›å»ºè®¢å•ç»Ÿè®¡æŒ‰é’®é¢æ¿")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // æ–°å¢žï¼šæŸ¥è¯¢æŠ¥å¤‡å’Œå•å­è®°å½•
  new SlashCommandBuilder()
    .setName("queryrecords")
    .setDescription("æŸ¥è¯¢å•å­æŠ¥å¤‡å’Œå•å­è®°å½•")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  // æ–°å¢žï¼šæ‰‹åŠ¨æ›´æ–°/å‘é€ç»Ÿè®¡ embedï¼ˆç»‘å®š /recordï¼‰
  new SlashCommandBuilder()
    .setName("record")
    .setDescription("æ›´æ–°/å‘é€æ´¾å•ç»Ÿè®¡ embed åˆ°ç»Ÿè®¡é¢‘é“ï¼ˆç®¡ç†å‘˜ï¼‰")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // æ–°å¢žï¼šæ•°æ®åº“ç®¡ç†ä¸»å‘½ä»¤
  new SlashCommandBuilder()
    .setName("db")
    .setDescription("ðŸ“Š æ•°æ®åº“ç®¡ç†ä¸­å¿ƒ - æŸ¥çœ‹ã€ç¼–è¾‘ã€å¯¼å‡ºè®¢å•æ•°æ®")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // æ–°å¢žï¼šæ•°æ®ç®¡ç†ä¸­å¿ƒå‘½ä»¤
  new SlashCommandBuilder()
    .setName("datacenter")
    .setDescription("ðŸ“Š æ•°æ®ç®¡ç†ä¸­å¿ƒ - ç»Ÿè®¡ã€åˆ†æžã€å¯¼å‡ºã€æ£€æŸ¥æ•°æ®")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(config.clientId), {
      body: commands,
    });
    console.log("âœ… Slash æŒ‡ä»¤æ³¨å†ŒæˆåŠŸ");
  } catch (err) {
    console.error("âŒ æ³¨å†Œ Slash æŒ‡ä»¤å¤±è´¥ï¼š", err);
  }
})();

// === ç¬¬ 1 æ®µç»“æŸ ===
// æŽ¥ä¸‹æ¥æˆ‘å°†å‘é€ç¬¬ 2 æ®µï¼ˆæŠ¥å¤‡ç³»ç»Ÿï¼šopen_report_modalã€reportForm æäº¤ã€add_order_number modal ç›¸å…³ï¼‰
// è‹¥å‡†å¤‡å¥½äº†è¯·å›žå¤ï¼šå‘é€ç¬¬ 2 æ®µ
// =============================================================
// INTERACTION HANDLERï¼ˆæŠ¥å¤‡ç³»ç»Ÿéƒ¨åˆ†ï¼‰
// =============================================================
client.on("interactionCreate", async (interaction) => {
  try {
    // ---------------------------------------------------------
    // /reportbbï¼ˆåˆ›å»ºæŠ¥å¤‡æŒ‰é’®é¢æ¿ï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "reportbb"
    ) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ“Œ å•å­æŠ¥å¤‡")
        .setDescription(`\nâœ¨ éº»çƒ¦é™ªé™ªä»¬æŽ¥å•åŽæŠ¥å¤‡ä¸€ä¸‹å“ˆï¼Œä»¥æ–¹ä¾¿æˆ‘ä»¬åŽç»­æ ¸å®žå•å­ï¼Œè°¢è°¢ä½ ï½ž ðŸ’—\n`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_report_modal")
          .setLabel("ðŸ”— æŠ¥å¤‡å•å­")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("open_renew_report_modal")
          .setLabel("ðŸ”„ ç»­å•æŠ¥å¤‡")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("open_gift_modal")
          .setLabel("ðŸŽ ç¤¼ç‰©æŠ¥å¤‡")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ---------------------------------------------------------
    // æ‰“å¼€æŠ¥å¤‡ Modal
    // ---------------------------------------------------------
    if (
      interaction.isButton() &&
      interaction.customId === "open_report_modal"
    ) {
      const modal = new ModalBuilder()
        .setCustomId("reportForm")
        .setTitle("ðŸ“„ å•å­æŠ¥å¤‡");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("boss")
            .setLabel("ðŸ§‘â€ðŸ’¼ è€æ¿åå­—")
            .setPlaceholder("ä¾‹å¦‚ï¼šè€æ¿ç¼–å·#1234")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("player")
            .setLabel("ðŸ§šâ€â™€ï¸ é™ªé™ªåå­—")
            .setPlaceholder("ä¾‹å¦‚ï¼šðŸ§šâ€â™€ï¸ é™ªé™ªåå­—")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("type")
            .setLabel("ðŸ§© å•å­ç±»åž‹")
            .setPlaceholder("ä¾‹å¦‚ï¼šæ¸¸æˆåå­—ï¼ˆValoå¨±ä¹/æŠ€æœ¯/ç»­å•ï¼‰")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("â° æ—¶é•¿")
            .setPlaceholder("ä¾‹å¦‚ï¼š ï¼ˆ 3å°æ—¶/ 1ç™½å• 2å¤œå• / 11.00pm - 2.00am )")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("ðŸ’° é‡‘é¢")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // æ‰“å¼€ç¤¼ç‰©æŠ¥å¤‡ Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "open_gift_modal") {
      const modal = new ModalBuilder()
        .setCustomId("giftReportForm")
        .setTitle("ðŸŽ ç¤¼ç‰©æŠ¥å¤‡");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("giver")
            .setLabel("ðŸ§‘â€ðŸ’¼ è€æ¿")
            .setPlaceholder("ðŸ§‘â€ðŸ’¼è€æ¿åå­—")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("receiver")
            .setLabel("ðŸ§šâ€â™€ï¸ æ”¶ç¤¼äºº")
            .setPlaceholder("ðŸ§šâ€â™€ï¸é™ªé™ªåå­—")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("gift")
            .setLabel("ðŸŽ ç¤¼ç‰©å†…å®¹")
            .setPlaceholder("ðŸŽç¤¼ç‰©åå­—")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("value")
            .setLabel("ðŸ’° ä»·å€¼/é‡‘é¢ (é€‰å¡«)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );

      await interaction.showModal(modal);
      return;
    }

        // ---------------------------------------------------------
    // æäº¤æŠ¥å¤‡ Modalï¼ˆæŠ¥å¤‡æˆåŠŸï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "reportForm"
    ) {
      try {
        // ã€ä¿®å¤é—®é¢˜ 13ã€‘æ·»åŠ è¾“å…¥éªŒè¯
        const boss = validateInput(interaction.fields.getTextInputValue("boss"), 'text', 50);
        const player = validateInput(interaction.fields.getTextInputValue("player"), 'text', 50);
        const type = validateInput(interaction.fields.getTextInputValue("type"), 'text', 50);
        const duration = validateInput(interaction.fields.getTextInputValue("duration"), 'text', 100);
        const amount = parsePrice(interaction.fields.getTextInputValue("amount"));

        // éªŒè¯å¿…å¡«å­—æ®µ
        if (!boss || !player || !type || !duration) {
          return await interaction.reply({
            content: "âŒ æ‰€æœ‰å­—æ®µå¿…å¡«ä¸”ä¸èƒ½ä¸ºç©ºï¼Œè¯·é‡æ–°æäº¤",
            ephemeral: true
          });
        }

        if (amount <= 0) {
          return await interaction.reply({
            content: "âŒ é‡‘é¢å¿…é¡»å¤§äºŽ 0",
            ephemeral: true
          });
        }

        // ã€ä¿®å¤ã€‘å…ˆä¿å­˜åˆ°æ•°æ®åº“ï¼Œç›´æŽ¥ä»Žè¿”å›žå€¼èŽ·å– orderId
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
          
          // ã€ä¿®å¤ã€‘ç›´æŽ¥ä»Žè¿”å›žçš„resultä¸­èŽ·å–orderId
          orderId = result.id || result.orderId || null;
          
          if (!orderId) {
            console.error("âŒ æ•°æ®åº“è¿”å›žçš„orderIdä¸ºç©ºï¼Œè¿”å›žå€¼:", result);
            return await interaction.reply({
              content: "âŒ ä¿å­˜æŠ¥å¤‡å¤±è´¥ï¼ˆæ— æ•ˆçš„è®¢å•IDï¼‰ï¼Œè¯·ç¨åŽé‡è¯•",
              ephemeral: true
            });
          }
          
          console.log(`âœ… æŠ¥å¤‡æˆåŠŸä¿å­˜ï¼ŒorderId: ${orderId}`);
        } catch (e) {
          console.error("âŒ ä¿å­˜æŠ¥å¤‡åˆ°æ•°æ®åº“å¤±è´¥ï¼š", e.message);
          return await interaction.reply({
            content: "âŒ ä¿å­˜æŠ¥å¤‡å¤±è´¥ï¼Œè¯·ç¨åŽé‡è¯•",
            ephemeral: true
          });
        }

      // ðŸ“Œ æŠ¥å¤‡æˆåŠŸ Embedï¼ˆç²‰è‰²æ²»æ„ˆé£Žï¼‰- ç®¡ç†å‘˜çœ‹çš„å®Œæ•´ç‰ˆæœ¬
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ’— å•å­æŠ¥å¤‡å®Œæˆå•¦ï½žã€ç®¡ç†å‘˜è§†å›¾ã€‘")
        .setDescription(`${sep()}\nâœ¨ æ­¤æ¶ˆæ¯åŒ…å«å®Œæ•´è€æ¿ä¿¡æ¯ï¼Œä»…å‘é€åˆ°ç®¡ç†å‘˜é¢‘é“\n${sep()}\n\nðŸ“Œ **æŠ¥å¤‡ä¿¡æ¯**`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&"
        )
        .addFields(
          { name: "ðŸ‘¤ è€æ¿ä¿¡æ¯", value: `\`\`\`${boss}\`\`\``, inline: false },
          { name: "ðŸ§šâ€â™€ï¸ é™ªçŽ©", value: player, inline: true },
          { name: "ðŸ“Œ ç±»åž‹", value: type, inline: true },
          { name: "â° æ—¶é•¿", value: duration, inline: true },
          { name: "ðŸ’° é‡‘é¢", value: `**RM ${amount}**`, inline: true },
          { name: "âŒš æŠ¥å¤‡æ—¶é—´", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "ðŸ”¢ å•å·çŠ¶æ€", value: "â³ å¾…æ·»åŠ ", inline: true }
        )
        .setFooter({ text: `é™ªçŽ©åŽå®« â€¢ ç®¡ç†å‘˜æŠ¥å¤‡è§†å›¾ ðŸ’— | orderId:${orderId}` })
        .setTimestamp();

      // å…¬å…±é¢‘é“çœ‹çš„ embedï¼ˆéšè—è€æ¿åå­—ï¼‰
      const embedForOthers = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ’— å•å­æŠ¥å¤‡å®Œæˆå•¦ï½ž")
        .setDescription(`${sep()}\nè°¢è°¢ä½ çš„æŠ¥å¤‡ï¼Œæˆ‘ä»¬ä¼šæ¸©æŸ”åœ°è®°å½•æ¯ä¸€å•ï½ž\n${sep()}\n\nðŸ“Œ **æŠ¥å¤‡ä¿¡æ¯**`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&"
        )
        .addFields(
          { name: "ðŸ”’ è€æ¿ä¿¡æ¯", value: "ä»…ç®¡ç†å‘˜å¯è§", inline: true },
          { name: "ðŸ§šâ€â™€ï¸ é™ªçŽ©", value: player, inline: true },
          { name: "ðŸ“Œ ç±»åž‹", value: type, inline: true },
          { name: "â° æ—¶é•¿", value: duration, inline: true },
          { name: "ðŸ’° é‡‘é¢", value: `**RM ${amount}**`, inline: true },
          { name: "âŒš æŠ¥å¤‡æ—¶é—´", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "ðŸ”¢ å•å·çŠ¶æ€", value: "â³ å¾…æ·»åŠ ", inline: true }
        )
        .setFooter({ text: `é™ªçŽ©åŽå®« â€¢ è°¢è°¢ä½ çš„ä¸€ä»½ç”¨å¿ƒ ðŸ’— | orderId:${orderId}` })
        .setTimestamp();

      // ðŸ“± è‡ªåŠ¨å‘é€åˆ° Telegramï¼ˆä»…ç¬¬ä¸€ä¸ªç¾¤ï¼ŒåŒ…å«è€æ¿åå­—ï¼‰
      const telegramReportMsg = `<b>ðŸ“Œ æ–°çš„å•å­æŠ¥å¤‡</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
<b>ðŸ‘¤ è€æ¿:</b> ${boss}
<b>ðŸ§š é™ªé™ª:</b> ${player}
<b>ðŸ“ ç±»åž‹:</b> ${type}
<b>â° æ—¶é•¿:</b> ${duration}
<b>ðŸ’° é‡‘é¢:</b> RM ${amount}
<b>ðŸ“… æ—¶é—´:</b> ${new Date().toLocaleString("zh-CN")}
<b>ðŸ“¦ è®¢å•ID:</b> ${orderId}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`;
      await sendTelegramReport(config.telegramChatId, telegramReportMsg, config.telegramMessageThreadId).catch(() => {});

      // æ·»åŠ å•å·æŒ‰é’®ï¼ˆç®¡ç†å‘˜ï¼‰
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("add_order_number")
          .setLabel("ðŸ”¢ æ·»åŠ å•å·")
          .setStyle(ButtonStyle.Secondary)
      );

      // âœ… å…¬å…±é¢‘é“ï¼šç»Ÿä¸€åªå‘é€â€œéšè—è€æ¿â€çš„ç‰ˆæœ¬
      await interaction.reply({
        embeds: [embedForOthers],
        components: [row],
      });

      // ã€æ–°å¢žã€‘è‡ªåŠ¨å‘é€åˆ°æŠ¥å¤‡æ´¾å•é¢‘é“
      try {
        const reportDispatchChannel = interaction.guild.channels.cache.get(REPORT_DISPATCH_CHANNEL_ID) ||
          (await interaction.guild.channels.fetch(REPORT_DISPATCH_CHANNEL_ID).catch(() => null));
        if (reportDispatchChannel && reportDispatchChannel.isTextBased()) {
          await reportDispatchChannel.send({ embeds: [embedForOthers], components: [row] });
          console.log(`âœ… æŠ¥å¤‡å·²å‘é€åˆ°é¢‘é“: ${REPORT_DISPATCH_CHANNEL_ID}`);
        } else {
          console.warn(`âš ï¸ æŠ¥å¤‡æ´¾å•é¢‘é“ä¸å­˜åœ¨æˆ–éžæ–‡æœ¬é¢‘é“: ${REPORT_DISPATCH_CHANNEL_ID}`);
        }
      } catch (err) {
        console.error("âŒ å‘é€æŠ¥å¤‡åˆ°é¢‘é“å¤±è´¥ï¼š", err.message);
      }

      // âœ… ã€ç¦ç”¨ã€‘ç®¡ç†å‘˜é¢‘é“ï¼šå‘é€åŒ…å«è€æ¿åå­—çš„å®Œæ•´ç‰ˆæœ¬ - å•å­æŠ¥å¤‡ä¸éœ€è¦å‘åŽ»è¯¥é¢‘é“
      // try {
      //   const logChannel =
      //     interaction.guild.channels.cache.get(LOG_CHANNEL_ID) ||
      //     (await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
      //   if (logChannel) {
      //     await logChannel.send({ embeds: [embed] });
      //   } else {
      //     console.warn("âš ï¸ æ—¥å¿—é¢‘é“ä¸å­˜åœ¨æˆ–æ— æ³•è®¿é—®");
      //   }
      // } catch (err) {
      //   console.error("âŒ å‘é€ç®¡ç†å‘˜æŠ¥å¤‡ embed å¤±è´¥ï¼š", err.message);
      // }

      return;
      } catch (err) {
        console.error("âŒ å¤„ç†æŠ¥å¤‡ Modal å‡ºé”™:", err.message);
        try {
          await interaction.reply({
            content: "âŒ å¤„ç†æŠ¥å¤‡æ—¶å‘ç”Ÿé”™è¯¯ï¼Œè¯·ç¨åŽé‡è¯•",
            ephemeral: true
          });
        } catch (e) {
          console.error("âŒ å›žå¤ç”¨æˆ·å¤±è´¥:", e.message);
        }
      }
    }

     // ---------------------------------------------------------
    // æäº¤ç¤¼ç‰©æŠ¥å¤‡ Modalï¼ˆæŠ¥å¤‡æˆåŠŸï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "giftReportForm"
    ) {
      const giver = interaction.fields.getTextInputValue("giver");
      const receiver = interaction.fields.getTextInputValue("receiver");
      const gift = interaction.fields.getTextInputValue("gift");
      const value = parsePrice(interaction.fields.getTextInputValue("value") || 0);

      // ä¿å­˜åˆ°æ•°æ®åº“ï¼ŒèŽ·å– orderId
      let orderId = null;
      try {
        const result = await db.addOrder({
          type: "gift",
          boss: giver,
          player: receiver,
          orderType: gift,
          duration: "",
          amount: value,
          date: new Date().toLocaleString("zh-CN"),
          source: "giftReportForm",
        });
        
        orderId = result.id || result.orderId || null;
        
        if (!orderId) {
          console.error("âŒ æ•°æ®åº“è¿”å›žçš„orderIdä¸ºç©ºï¼Œè¿”å›žå€¼:", result);
          return await interaction.reply({
            content: "âŒ ä¿å­˜ç¤¼ç‰©æŠ¥å¤‡å¤±è´¥ï¼ˆæ— æ•ˆçš„è®¢å•IDï¼‰ï¼Œè¯·ç¨åŽé‡è¯•",
            ephemeral: true
          });
        }
        
        console.log(`âœ… ç¤¼ç‰©æŠ¥å¤‡æˆåŠŸä¿å­˜ï¼ŒorderId: ${orderId}`);
      } catch (e) {
        console.error("âŒ ä¿å­˜ç¤¼ç‰©æŠ¥å¤‡åˆ°æ•°æ®åº“å¤±è´¥ï¼š", e.message);
        return await interaction.reply({
          content: "âŒ ä¿å­˜ç¤¼ç‰©æŠ¥å¤‡å¤±è´¥ï¼Œè¯·ç¨åŽé‡è¯•",
          ephemeral: true
        });
      }

      // ç®¡ç†å‘˜ä¸“ç”¨ embedï¼ˆåŒ…å«é€ç¤¼äººï¼‰
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸŽ ç¤¼ç‰©æŠ¥å¤‡å®Œæˆå•¦ï½žï¼ˆç®¡ç†å‘˜è§†å›¾ï¼‰")
        .setDescription(`${sep()}\næ­¤æ¶ˆæ¯ä»…å‘é€åˆ°ç®¡ç†å‘˜é¢‘é“ï¼ŒåŒ…å«å®Œæ•´é€ç¤¼äººä¿¡æ¯ï½ž\n${sep()}`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&")
        .addFields(
          { name: "ðŸ§‘â€ðŸ’¼ é€ç¤¼äºº", value: giver, inline: true },
          { name: "ðŸ§šâ€â™€ï¸ æ”¶ç¤¼äºº", value: receiver, inline: true },
          { name: "ðŸŽ ç¤¼ç‰©", value: gift, inline: true },
          { name: "ðŸ’° ä»·å€¼", value: `RM ${value}`, inline: true },
          { name: "ðŸ”¢ å•å·", value: "æœªå¡«å†™", inline: false }
        )
        .setFooter({ text: `é™ªçŽ©åŽå®« â€¢ ç®¡ç†å‘˜ä¸“ç”¨ç¤¼ç‰©æŠ¥å¤‡è§†å›¾ ðŸ’— | orderId:${orderId}` })
        .setTimestamp();

      // ç»™æ™®é€šç”¨æˆ·çœ‹çš„embedï¼ˆéšè—é€ç¤¼äººåå­—ï¼‰
      const embedForOthers = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸŽ ç¤¼ç‰©æŠ¥å¤‡å®Œæˆå•¦ï½ž")
        .setDescription(`${sep()}\nè°¢è°¢ä½ çš„æŠ¥å¤‡ï¼Œæˆ‘ä»¬ä¼šæ¸©æŸ”åœ°è®°å½•æ¯ä¸€ä»½ç¤¼ç‰©ï½ž\n${sep()}`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&")
        .addFields(
          { name: "ðŸ§‘â€ðŸ’¼ é€ç¤¼äºº", value: "ðŸ”’ ä»…ç®¡ç†å‘˜å¯è§", inline: true },
          { name: "ðŸ§šâ€â™€ï¸ æ”¶ç¤¼äºº", value: receiver, inline: true },
          { name: "ðŸŽ ç¤¼ç‰©", value: gift, inline: true },
          { name: "ðŸ’° ä»·å€¼", value: `RM ${value}`, inline: true },
          { name: "ðŸ”¢ å•å·", value: "æœªå¡«å†™", inline: false }
        )
        .setFooter({ text: `é™ªçŽ©åŽå®« â€¢ è°¢è°¢ä½ çš„ä¸€ä»½ç”¨å¿ƒ ðŸ’— | orderId:${orderId}` })
        .setTimestamp();

      // ðŸ“± è‡ªåŠ¨å‘é€åˆ° Telegramï¼ˆåŒ…å«é€ç¤¼äººï¼‰
      const telegramGiftMsg = `<b>ðŸŽ æ–°çš„ç¤¼ç‰©æŠ¥å¤‡</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
<b>ðŸ‘¤ é€ç¤¼äºº:</b> ${giver}
<b>ðŸ§š æ”¶ç¤¼äºº:</b> ${receiver}
<b>ðŸŽ ç¤¼ç‰©:</b> ${gift}
<b>ðŸ’° ä»·å€¼:</b> RM ${value}
<b>ðŸ“… æ—¶é—´:</b> ${new Date().toLocaleString("zh-CN")}
<b>ðŸ“¦ è®¢å•ID:</b> ${orderId}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`;
      await sendTelegramReport(config.telegramChatId, telegramGiftMsg, config.telegramMessageThreadId).catch(() => {});

      // æ·»åŠ å•å·æŒ‰é’®ï¼ˆç®¡ç†å‘˜ï¼‰
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("add_order_number")
          .setLabel("ðŸ”¢ æ·»åŠ å•å·")
          .setStyle(ButtonStyle.Secondary)
      );

      // âœ… å…¬å…±é¢‘é“ï¼šåªæ˜¾ç¤ºâ€œé€ç¤¼äººï¼šðŸ”’ ä»…ç®¡ç†å‘˜å¯è§â€
      await interaction.reply({
        embeds: [embedForOthers],
        components: [row],
      });

      // âœ… ã€ç¦ç”¨ã€‘ç®¡ç†å‘˜é¢‘é“ï¼šå‘é€å®Œæ•´ä¿¡æ¯çš„ embed - å•å­æŠ¥å¤‡ä¸éœ€è¦å‘åŽ»è¯¥é¢‘é“
      // try {
      //   const logChannel =
      //     interaction.guild.channels.cache.get(LOG_CHANNEL_ID) ||
      //     (await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
      //   if (logChannel) {
      //     await logChannel.send({ embeds: [embed] });
      //   }
      // } catch (err) {
      //   console.error("å‘é€ç®¡ç†å‘˜ç¤¼ç‰©æŠ¥å¤‡ embed å¤±è´¥ï¼š", err);
      // }

      return;
    }

    // ---------------------------------------------------------
    // æ‰“å¼€ç»­å•æŠ¥å¤‡ Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "open_renew_report_modal") {
      const modal = new ModalBuilder()
        .setCustomId("renewReportForm")
        .setTitle("ðŸ”„ ç»­å•æŠ¥å¤‡");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("boss")
            .setLabel("ðŸ§‘â€ðŸ’¼ è€æ¿åå­—")
            .setPlaceholder("ä¾‹å¦‚ï¼šè€æ¿ç¼–å·#1234")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("player")
            .setLabel("ðŸ§šâ€â™€ï¸ é™ªé™ªåå­—")
            .setPlaceholder("ä¾‹å¦‚ï¼šå°é›ª / å°å¸ƒä¸")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("order_no")
            .setLabel("ðŸ“¦ åŽŸå•å·")
            .setPlaceholder("ä¾‹å¦‚ï¼šORD20251215001")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("â° æ—¶é•¿")
            .setPlaceholder("ä¾‹å¦‚ï¼š2å°æ—¶ / 3å±€ / 11.00pm - 2.00am")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("ðŸ’° é‡‘é¢")
            .setPlaceholder("ä¾‹å¦‚ï¼š40")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // æäº¤ç»­å•æŠ¥å¤‡ Modalï¼ˆç»­å•æŠ¥å¤‡æˆåŠŸï¼‰
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

      // ä¿å­˜åˆ°æ•°æ®åº“ï¼ŒèŽ·å– orderId
      let orderId = null;
      try {
        const result = await db.addOrder({
          type: "renew_report",
          boss,
          player,
          orderType: "ç»­å•",
          duration,
          amount,
          date: new Date().toLocaleString("zh-CN"),
          source: "renewReportForm",
        });
        
        orderId = result.id || result.orderId || null;
        
        if (!orderId) {
          console.error("âŒ æ•°æ®åº“è¿”å›žçš„orderIdä¸ºç©ºï¼Œè¿”å›žå€¼:", result);
          return await interaction.reply({
            content: "âŒ ä¿å­˜ç»­å•æŠ¥å¤‡å¤±è´¥ï¼ˆæ— æ•ˆçš„è®¢å•IDï¼‰ï¼Œè¯·ç¨åŽé‡è¯•",
            ephemeral: true
          });
        }
        
        console.log(`âœ… ç»­å•æŠ¥å¤‡æˆåŠŸä¿å­˜ï¼ŒorderId: ${orderId}`);
      } catch (e) {
        console.error("âŒ ä¿å­˜ç»­å•æŠ¥å¤‡åˆ°æ•°æ®åº“å¤±è´¥ï¼š", e.message);
        return await interaction.reply({
          content: "âŒ ä¿å­˜ç»­å•æŠ¥å¤‡å¤±è´¥ï¼Œè¯·ç¨åŽé‡è¯•",
          ephemeral: true
        });
      }

      // ðŸ“Œ ç»­å•æŠ¥å¤‡æˆåŠŸ Embedï¼ˆç²‰è‰²æ²»æ„ˆé£Žï¼‰- ç®¡ç†å‘˜çœ‹çš„å®Œæ•´ç‰ˆæœ¬
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ”„ ç»­å•æŠ¥å¤‡å®Œæˆå•¦ï½žã€ç®¡ç†å‘˜è§†å›¾ã€‘")
        .setDescription(`${sep()}\nâœ¨ æ­¤æ¶ˆæ¯åŒ…å«å®Œæ•´è€æ¿ä¿¡æ¯ï¼Œä»…å‘é€åˆ°ç®¡ç†å‘˜é¢‘é“\n${sep()}\n\nðŸ“Œ **ç»­å•ä¿¡æ¯**`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&")
        .addFields(
          { name: "ðŸ‘¤ è€æ¿ä¿¡æ¯", value: `\`\`\`${boss}\`\`\``, inline: false },
          { name: "ðŸ§šâ€â™€ï¸ é™ªçŽ©", value: player, inline: true },
          { name: "â° æ—¶é•¿", value: duration, inline: true },
          { name: "ðŸ’° é‡‘é¢", value: `**RM ${amount}**`, inline: true },
          { name: "ðŸ“¦ åŽŸå•å·", value: `\`${orderNo}\``, inline: true },
          { name: "âŒš ç»­å•æ—¶é—´", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "ðŸ”¢ æ–°å•å·çŠ¶æ€", value: "â³ å¾…æ·»åŠ ", inline: true }
        )
        .setFooter({ text: `é™ªçŽ©åŽå®« â€¢ ç»­å•æŠ¥å¤‡è§†å›¾ ðŸ’— | orderId:${orderId}` })
        .setTimestamp();

      // å…¬å…±é¢‘é“çœ‹çš„ embedï¼ˆéšè—è€æ¿åå­—ï¼‰
      const embedForOthers = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ”„ ç»­å•æŠ¥å¤‡å®Œæˆå•¦ï½ž")
        .setDescription(`${sep()}\nè°¢è°¢ä½ çš„æŠ¥å¤‡ï¼Œæˆ‘ä»¬ä¼šæ¸©æŸ”åœ°è®°å½•æ¯ä¸€å•ï½ž\n${sep()}\n\nðŸ“Œ **ç»­å•ä¿¡æ¯**`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1438478692883103804/ChatGPT_Image_20251113_18_40_31.png?ex=691f98ee&is=691e476e&hm=5566b01b0ccd264da9550d82ad30e760a2a80209eaa4884ec0a4ef57e0909189&")
        .addFields(
          { name: "ðŸ”’ è€æ¿ä¿¡æ¯", value: "ä»…ç®¡ç†å‘˜å¯è§", inline: true },
          { name: "ðŸ§šâ€â™€ï¸ é™ªçŽ©", value: player, inline: true },
          { name: "â° æ—¶é•¿", value: duration, inline: true },
          { name: "ðŸ’° é‡‘é¢", value: `**RM ${amount}**`, inline: true },
          { name: "ðŸ“¦ åŽŸå•å·", value: `\`${orderNo}\``, inline: true },
          { name: "âŒš ç»­å•æ—¶é—´", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "ðŸ”¢ æ–°å•å·çŠ¶æ€", value: "â³ å¾…æ·»åŠ ", inline: true }
        )
        .setFooter({ text: `é™ªçŽ©åŽå®« â€¢ è°¢è°¢ä½ çš„ä¸€ä»½ç”¨å¿ƒ ðŸ’— | orderId:${orderId}` })
        .setTimestamp();

      // ðŸ“± è‡ªåŠ¨å‘é€åˆ° Telegramï¼ˆä»…ç¬¬ä¸€ä¸ªç¾¤ï¼ŒåŒ…å«è€æ¿åå­—ï¼‰
      const telegramRenewReportMsg = `<b>ðŸ”„ æ–°çš„ç»­å•æŠ¥å¤‡</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
<b>ðŸ‘¤ è€æ¿:</b> ${boss}
<b>ðŸ§š é™ªé™ª:</b> ${player}
<b>ðŸ“¦ åŽŸå•å·:</b> ${orderNo}
<b>â° æ—¶é•¿:</b> ${duration}
<b>ðŸ’° é‡‘é¢:</b> RM ${amount}
<b>ðŸ“… æ—¶é—´:</b> ${new Date().toLocaleString("zh-CN")}
<b>ðŸ“¦ è®¢å•ID:</b> ${orderId}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`;
      await sendTelegramReport(config.telegramChatId, telegramRenewReportMsg, config.telegramMessageThreadId).catch(() => {});

      // æ·»åŠ å•å·æŒ‰é’®ï¼ˆç®¡ç†å‘˜ï¼‰
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("add_order_number")
          .setLabel("ðŸ”¢ æ·»åŠ æ–°å•å·")
          .setStyle(ButtonStyle.Secondary)
      );

      // âœ… å…¬å…±é¢‘é“ï¼šç»Ÿä¸€åªå‘é€"éšè—è€æ¿"çš„ç‰ˆæœ¬
      await interaction.reply({
        embeds: [embedForOthers],
        components: [row],
      });

      // âœ… ã€ç¦ç”¨ã€‘ç®¡ç†å‘˜é¢‘é“ï¼šå‘é€åŒ…å«è€æ¿åå­—çš„å®Œæ•´ç‰ˆæœ¬ - å•å­æŠ¥å¤‡ä¸éœ€è¦å‘åŽ»è¯¥é¢‘é“
      // try {
      //   const logChannel =
      //     interaction.guild.channels.cache.get(LOG_CHANNEL_ID) ||
      //     (await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
      //   if (logChannel) {
      //     await logChannel.send({ embeds: [embed] });
      //   }
      // } catch (err) {
      //   console.error("å‘é€ç®¡ç†å‘˜ç»­å•æŠ¥å¤‡ embed å¤±è´¥ï¼š", err);
      // }

      return;
    }


    // ---------------------------------------------------------
    // æ·»åŠ å•å·æŒ‰é’®ï¼ˆç®¡ç†å‘˜é™å®šï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isButton() &&
      interaction.customId === "add_order_number"
    ) {
      const member = interaction.guild.members.cache.get(interaction.user.id);

      // æƒé™éªŒè¯
      if (
        !member.permissions.has(PermissionFlagsBits.Administrator) &&
        !member.roles.cache.has(config.adminRoleId)
      ) {
        return interaction.reply({
          content: "âŒ æŠ±æ­‰ï¼Œåªæœ‰ç®¡ç†å‘˜å¯ä»¥æ·»åŠ å•å·ã€‚è‹¥ä½ éœ€è¦å¸®åŠ©è¯·è”ç³»ç®¡ç†å‘˜ï½ž",
          ephemeral: true,
        });
      }

      // è®°å½•æ¶ˆæ¯ IDï¼Œç”¨äºŽæäº¤ modal åŽç¼–è¾‘ embed
      addOrderContext.set(interaction.user.id, {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        messageId: interaction.message.id,
      });
      
      // ã€ä¿®å¤é—®é¢˜ 8ã€‘æ·»åŠ è‡ªåŠ¨æ¸…ç†æœºåˆ¶ï¼ˆ5åˆ†é’ŸåŽæ¸…ç†ï¼‰
      addOrderContextCleanup(interaction.user.id, 300000);

      // æ‰“å¼€ Modal
      const modal = new ModalBuilder()
        .setCustomId("addOrderNumberModal")
        .setTitle("ðŸ”¢ æ·»åŠ å•å·");

      const input = new TextInputBuilder()
        .setCustomId("order_number")
        .setLabel("è¯·è¾“å…¥å•å·")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // å•å· Modal æäº¤ï¼ˆæ›´æ–°åŽŸæ¶ˆæ¯ï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "addOrderNumberModal"
    ) {
      const orderNumber = interaction.fields.getTextInputValue("order_number");

      const ctx = addOrderContext.get(interaction.user.id);
      if (!ctx) {
        return interaction.reply({
          content: "âŒ æ‰¾ä¸åˆ°å¯¹åº”çš„æŠ¥å¤‡æ¶ˆæ¯ï¼ˆå¯èƒ½å·²è¿‡æœŸï¼‰ã€‚è¯·é‡è¯•æˆ–è”ç³»ç®¡ç†å‘˜ï½ž",
          ephemeral: true,
        });
      }

      const guild =
        client.guilds.cache.get(ctx.guildId) ||
        (await client.guilds.fetch(ctx.guildId).catch(() => null));
      if (!guild)
        return interaction.reply({
          content: "âŒ æ— æ³•æ‰¾åˆ°å…¬ä¼šï¼Œè¯·ç¡®è®¤æœºå™¨äººæƒé™ã€‚",
          ephemeral: true,
        });

      const channel =
        guild.channels.cache.get(ctx.channelId) ||
        (await guild.channels.fetch(ctx.channelId).catch(() => null));
      if (!channel)
        return interaction.reply({
          content: "âŒ æ— æ³•æ‰¾åˆ°åŽŸé¢‘é“ï¼Œæ¶ˆæ¯å¯èƒ½å·²è¢«åˆ é™¤ã€‚",
          ephemeral: true,
        });

      const msg = await channel.messages.fetch(ctx.messageId).catch(() => null);
      if (!msg)
        return interaction.reply({
          content: "âŒ åŽŸå§‹æ¶ˆæ¯å·²ä¸å­˜åœ¨ã€‚",
          ephemeral: true,
        });

      const oldEmbed = msg.embeds[0];
      if (!oldEmbed) {
        console.error("âŒ [addOrderNumberModal] åŽŸå§‹ embed ä¸å­˜åœ¨");
        return interaction.reply({
          content: "âŒ åŽŸå§‹ embed ä¸å­˜åœ¨ã€‚",
          ephemeral: true,
        });
      }

      // ã€ä¿®å¤ã€‘ä»Ž Embed footer ä¸­è§£æž orderIdï¼Œè€Œä¸æ˜¯ç›²ç›®çŒœæµ‹
      const footerText = oldEmbed.footer?.text || "";
      console.log(`ðŸ“ [addOrderNumberModal] Footer æ–‡æœ¬: "${footerText}"`);
      
      // æ”¯æŒä¸¤ç§æ ¼å¼ï¼šorderId: å’Œ ID:ï¼ˆå…¼å®¹æ—§ç‰ˆæœ¬ï¼‰
      let orderIdMatch = footerText.match(/orderId:(\d+)/);
      let orderId = orderIdMatch ? parseInt(orderIdMatch[1]) : null;
      
      // å¦‚æžœæ‰¾ä¸åˆ°æ–°æ ¼å¼ï¼Œå°è¯•æ—§æ ¼å¼ ID: å¹¶ä¸ºå…¶è¡¥å…… orderId
      if (!orderId) {
        const oldIdMatch = footerText.match(/ID:(\d+)/);
        orderId = oldIdMatch ? parseInt(oldIdMatch[1]) : null;
        if (orderId) {
          console.warn(`âš ï¸ [addOrderNumberModal] æ£€æµ‹åˆ°æ—§ç‰ˆæœ¬ footer æ ¼å¼ï¼ŒorderId: ${orderId}`);
        }
      }

      if (!orderId) {
        console.error(`âŒ [addOrderNumberModal] æ— æ³•ä»Ž footer ä¸­æå– orderIdï¼Œfooter: "${footerText}"`);
        console.error(`âŒ [addOrderNumberModal] æ¶ˆæ¯ID: ${ctx.messageId}, é¢‘é“ID: ${ctx.channelId}`);
        return interaction.reply({
          content: "âŒ æ— æ³•ä»ŽæŠ¥å¤‡è®°å½•ä¸­æå–è®¢å• IDï¼Œå¯èƒ½æ˜¯æ—§ç‰ˆæœ¬è®°å½•ã€‚è¯·è”ç³»ç®¡ç†å‘˜é‡æ–°æŠ¥å¤‡ã€‚",
          ephemeral: true,
        });
      }
      
      console.log(`âœ… [addOrderNumberModal] æˆåŠŸæå– orderId: ${orderId}`);

      // åˆ›å»ºæ–° embedï¼ˆç§»é™¤æ—§å•å·ã€å•å·çŠ¶æ€ & åŠ å…¥æ–°å•å·å’Œå·²æ·»åŠ çŠ¶æ€ï¼‰
      const newEmbed = EmbedBuilder.from(oldEmbed);
      const filtered = (oldEmbed.fields || []).filter(
        (f) => f.name !== "ðŸ”¢ å•å·" && f.name !== "ðŸ”¢ å•å·çŠ¶æ€" && f.name !== "ðŸ”¢ æ–°å•å·çŠ¶æ€"
      );
      newEmbed.setFields(filtered);
      newEmbed.addFields({
        name: "ðŸ”¢ å•å·",
        value: orderNumber,
      });
      newEmbed.addFields({
        name: "ðŸ”¢ å•å·çŠ¶æ€",
        value: "âœ… å·²æ·»åŠ ",
        inline: true,
      });

      await msg.edit({
        embeds: [newEmbed],
        components: msg.components,
      });

      // ã€ä¿®å¤ã€‘ä½¿ç”¨ä»Žfooterè§£æžçš„orderIdç›´æŽ¥æ›´æ–°æ•°æ®åº“
      let updatedOrderInfo = null;
      try {
        // ã€ä¿®å¤ã€‘å…è®¸é‡ç”¨å·²å­˜åœ¨çš„å•å· - ç”¨æˆ·å¯ä½¿ç”¨ä»»ä½•å•å·ï¼Œä¸é™åˆ¶å”¯ä¸€æ€§
        console.log(`ðŸ“Š [addOrderNumberModal] æ­£åœ¨æ›´æ–° orderId:${orderId} çš„è®¢å•å·ä¸º ${orderNumber}`);
        db.updateOrderNumber(orderId, orderNumber);
        updatedOrderInfo = db.getOrderById(orderId);
        console.log(`âœ… [addOrderNumberModal] è®¢å•å·æ›´æ–°æˆåŠŸï¼Œupdated info:`, updatedOrderInfo);
      } catch (e) {
        console.error("âŒ [addOrderNumberModal] æ›´æ–°æ•°æ®åº“å•å·å¤±è´¥ï¼š", e.message);
        console.error("âŒ [addOrderNumberModal] é”™è¯¯å †æ ˆï¼š", e.stack);
        return await interaction.reply({
          content: `âŒ æ•°æ®åº“æ›´æ–°å¤±è´¥: ${e.message}`,
          ephemeral: true,
        });
      }

      // ðŸ“¢ å‘é€å•å·æ›´æ–°é€šçŸ¥åˆ°æŠ¥å¤‡ç¾¤
      if (updatedOrderInfo) {
        try {
          const reportChannel = guild.channels.cache.get(REPORT_CHANNEL_ID);
          if (reportChannel) {
            let updateMsg = `âœ… <@${interaction.user.id}> å·²æ·»åŠ å•å·\n`;
            updateMsg += `ðŸ“¦ **å•å·:** ${orderNumber}\n`;
            
            // ä½¿ç”¨ç»Ÿä¸€çš„å­—æ®µåç§°æ˜¾ç¤ºä¿¡æ¯
            if (updatedOrderInfo.source === "reportForm") {
              updateMsg += `ðŸ§‘â€ðŸ’¼ **è€æ¿:** ${updatedOrderInfo.boss || "æœªçŸ¥"}\n`;
              updateMsg += `ðŸ§š **é™ªé™ª:** ${updatedOrderInfo.player || "æœªçŸ¥"}\n`;
              updateMsg += `ðŸ“Œ **ç±»åž‹:** ${updatedOrderInfo.orderType || "æœªçŸ¥"}\n`;
              updateMsg += `â° **æ—¶é•¿:** ${updatedOrderInfo.duration || "æœªçŸ¥"}\n`;
              updateMsg += `ðŸ’° **é‡‘é¢:** RM ${updatedOrderInfo.amount || 0}`;
            } else if (updatedOrderInfo.source === "giftReportForm") {
              // ç¤¼ç‰©æŠ¥å¤‡ä½¿ç”¨ç›¸åŒçš„å­—æ®µï¼ˆä»Žå‰ç«¯è¡¨å•æ˜ å°„è¿‡æ¥ï¼‰
              updateMsg += `ðŸ§‘â€ðŸ’¼ **èµ ç¤¼è€…:** ${updatedOrderInfo.boss || "æœªçŸ¥"}\n`;
              updateMsg += `ðŸ§š **æ”¶ç¤¼è€…:** ${updatedOrderInfo.player || "æœªçŸ¥"}\n`;
              updateMsg += `ðŸŽ **ç¤¼ç‰©:** ${updatedOrderInfo.orderType || "æœªçŸ¥"}\n`;
              updateMsg += `ðŸ’° **ä»·å€¼:** RM ${updatedOrderInfo.amount || 0}`;
            } else if (updatedOrderInfo.source === "renewReportForm") {
              updateMsg += `ðŸ§‘â€ðŸ’¼ **è€æ¿:** ${updatedOrderInfo.boss || "æœªçŸ¥"}\n`;
              updateMsg += `ðŸ§š **é™ªé™ª:** ${updatedOrderInfo.player || "æœªçŸ¥"}\n`;
              updateMsg += `â° **æ—¶é•¿:** ${updatedOrderInfo.duration || "æœªçŸ¥"}\n`;
              updateMsg += `ðŸ’° **é‡‘é¢:** RM ${updatedOrderInfo.amount || 0}`;
            }

            const updateEmbed = new EmbedBuilder()
              .setColor(THEME_COLOR)
              .setTitle("ðŸ”¢ å•å·å·²æ·»åŠ ")
              .setDescription(updateMsg)
              .setFooter({ text: "å•å­æŠ¥å¤‡ â€¢ å·²æ›´æ–°" })
              .setTimestamp();

            await reportChannel.send({ embeds: [updateEmbed] });
          }
        } catch (err) {
          console.error("å‘é€å•å·æ›´æ–°åˆ°æŠ¥å¤‡ç¾¤å¤±è´¥ï¼š", err);
        }
      }

      addOrderContext.delete(interaction.user.id);

      await interaction.reply({
        content: `âœ… å•å·å·²æ›´æ–°ä¸ºï¼š${orderNumber}ï¼Œè°¢è°¢ï½ž`,
        ephemeral: true,
      });

      return;
    }

    // ====================== æŠ¥å¤‡ç³»ç»Ÿç»“æŸ ======================
    // ---------------------------------------------------------
    // /datacenter å‘½ä»¤ - æ•°æ®ç®¡ç†ä¸­å¿ƒä¸»å…¥å£
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "datacenter"
    ) {
      try {
        // ã€æž¶æž„æ”¹é€ ã€‘ä½¿ç”¨SQLiteç›´æŽ¥æŸ¥è¯¢è€Œéžstatistics.loadOrdersData()
        const summary = db.getStatsSummary();
        const qualityCheck = db.performDataQualityCheck();

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle("ðŸ“Š æ•°æ®ç®¡ç†ä¸­å¿ƒ")
          .setDescription(`${sep()}\nç»Ÿè®¡ â€¢ åˆ†æž â€¢ å¯¼å‡º â€¢ æ£€æŸ¥\n${sep()}`)
          .addFields(
            {
              name: "ðŸ“ˆ æ•°æ®æ¦‚è§ˆ",
              value: statistics.formatSummary(summary),
              inline: false,
            },
            {
              name: "âš ï¸ æ•°æ®è´¨é‡",
              value: qualityCheck.issues.length > 0 
                ? qualityCheck.issues.join('\n') 
                : 'âœ… æ•°æ®å®Œæ•´æ— è¯¯',
              inline: false,
            }
          )
          .setFooter({ text: 'æœ€åŽæ›´æ–°: ' + new Date().toLocaleString('zh-CN') });

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("export_excel")
            .setLabel("ðŸ“¥ å¯¼å‡º Excel")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("datacenter_ranking")
            .setLabel("ðŸ“Š æŸ¥çœ‹æŽ’è¡Œ")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("datacenter_quality_check")
            .setLabel("ðŸ” æ•°æ®æ£€æŸ¥")
            .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("datacenter_time_filter")
            .setLabel("ðŸ“… æ—¶é—´ç­›é€‰")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("export_excel")
            .setLabel("âœˆï¸ å‘é€åˆ°é£žæœº")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("datacenter_refresh")
            .setLabel("ðŸ”„ åˆ·æ–°")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          embeds: [embed],
          components: [row1, row2],
          ephemeral: true,
        });
      } catch (err) {
        console.error("æ•°æ®ç®¡ç†ä¸­å¿ƒé”™è¯¯:", err);
        await interaction.reply({
          content: "âŒ åŠ è½½æ•°æ®ç®¡ç†ä¸­å¿ƒå¤±è´¥ï¼Œè¯·ç¨åŽé‡è¯•",
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // æ•°æ®ç®¡ç†ä¸­å¿ƒ - å¯¼å‡º CSV - å·²æ”¹ä¸º export_excel
    // ---------------------------------------------------------
    // ã€å·²å¼ƒç”¨ã€‘æ­¤å¤„ç†å™¨å·²ç§»é™¤ï¼Œå¯¼å‡ºæ”¹ä¸ºä½¿ç”¨ export_excel

    // ---------------------------------------------------------
    // æ•°æ®ç®¡ç†ä¸­å¿ƒ - æŸ¥çœ‹æŽ’è¡Œ
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "datacenter_ranking") {
      try {
        // ã€æž¶æž„æ”¹é€ ã€‘ä½¿ç”¨SQLite GROUP BYæŸ¥è¯¢è€Œéžstatisticsè®¡ç®—
        const assigners = db.getAssignerRankingFromDB();
        const players = db.getPlayerRankingFromDB();
        const bosses = db.getBossRankingFromDB();

        const assignersText = assigners
          .map((a, i) => `${i + 1}. ${a.name}: RM ${a.totalPrice} (${a.count}å•)`)
          .join('\n') || 'æš‚æ— æ•°æ®';

        const playersText = players
          .map((p, i) => `${i + 1}. ${p.name}: RM ${p.total}`)
          .join('\n') || 'æš‚æ— æ•°æ®';

        const bossesText = bosses
          .map((b, i) => `${i + 1}. ${b.name}: RM ${b.totalAmount} (${b.count}å•)`)
          .join('\n') || 'æš‚æ— æ•°æ®';

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle("ðŸ“Š æŽ’è¡Œæ¦œåˆ†æž")
          .addFields(
            {
              name: "ðŸ† æ´¾å•å‘˜æŽ’è¡Œ (Top 10)",
              value: `\`\`\`\n${assignersText}\n\`\`\``,
              inline: false,
            },
            {
              name: "â­ é™ªçŽ©å‘˜æŽ’è¡Œ (Top 10)",
              value: `\`\`\`\n${playersText}\n\`\`\``,
              inline: false,
            },
            {
              name: "ðŸ‘‘ è€æ¿æŽ’è¡Œ (Top 10)",
              value: `\`\`\`\n${bossesText}\n\`\`\``,
              inline: false,
            }
          )
          .setFooter({ text: 'æ•°æ®äºŽ ' + new Date().toLocaleString('zh-CN') + ' ç”Ÿæˆ' });

        await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      } catch (err) {
        console.error("æŸ¥çœ‹æŽ’è¡Œé”™è¯¯:", err);
        await interaction.reply({
          content: `âŒ åŠ è½½æŽ’è¡Œå¤±è´¥: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // æ•°æ®ç®¡ç†ä¸­å¿ƒ - æ•°æ®æ£€æŸ¥
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "datacenter_quality_check") {
      try {
        // ã€æž¶æž„æ”¹é€ ã€‘ä½¿ç”¨SQLiteè´¨é‡æ£€æŸ¥è€Œéžstatisticsè®¡ç®—
        const check = db.performDataQualityCheck();

        let description = '';
        if (check.issues.length > 0) {
          description += '**âš ï¸ é—®é¢˜é¡¹:**\n' + check.issues.join('\n') + '\n\n';
        }
        if (check.warnings.length > 0) {
          description += '**ðŸ“Œ æé†’é¡¹:**\n' + check.warnings.join('\n');
        }
        if (check.issues.length === 0 && check.warnings.length === 0) {
          description = 'âœ… æ­å–œï¼æ•°æ®å®Œæ•´æ— è¯¯ï½ž';
        }

        const embed = new EmbedBuilder()
          .setColor(check.hasIssues ? 0xff6b6b : 0x51cf66)
          .setTitle("ðŸ” æ•°æ®è´¨é‡æ£€æŸ¥")
          .setDescription(description)
          .setFooter({ text: 'æ€»è®¡: ' + check.totalIssuesAndWarnings + ' é¡¹' });

        await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      } catch (err) {
        console.error("æ•°æ®æ£€æŸ¥é”™è¯¯:", err);
        await interaction.reply({
          content: `âŒ æ£€æŸ¥å¤±è´¥: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // æ•°æ®ç®¡ç†ä¸­å¿ƒ - å¯¼å‡ºåˆ° Telegram
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // æ•°æ®ç®¡ç†ä¸­å¿ƒ - å¯¼å‡ºåˆ° Telegram - å·²æ”¹ä¸º export_excel
    // ---------------------------------------------------------
    // ã€å·²å¼ƒç”¨ã€‘æ­¤å¤„ç†å™¨å·²ç§»é™¤ï¼Œå¯¼å‡ºæ”¹ä¸ºä½¿ç”¨ export_excel

    // ---------------------------------------------------------
    // æ•°æ®ç®¡ç†ä¸­å¿ƒ - åˆ·æ–°
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "datacenter_refresh") {
      try {
        // ã€æž¶æž„æ”¹é€ ã€‘ä½¿ç”¨SQLiteç›´æŽ¥æŸ¥è¯¢è€Œéžstatistics.loadOrdersData()
        const summary = db.getStatsSummary();
        const qualityCheck = db.performDataQualityCheck();

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle("ðŸ“Š æ•°æ®ç®¡ç†ä¸­å¿ƒ")
          .setDescription(`${sep()}\nç»Ÿè®¡ â€¢ åˆ†æž â€¢ å¯¼å‡º â€¢ æ£€æŸ¥\n${sep()}`)
          .addFields(
            {
              name: "ðŸ“ˆ æ•°æ®æ¦‚è§ˆ",
              value: statistics.formatSummary(summary),
              inline: false,
            },
            {
              name: "âš ï¸ æ•°æ®è´¨é‡",
              value: qualityCheck.issues.length > 0 
                ? qualityCheck.issues.join('\n') 
                : 'âœ… æ•°æ®å®Œæ•´æ— è¯¯',
              inline: false,
            }
          )
          .setFooter({ text: 'æœ€åŽæ›´æ–°: ' + new Date().toLocaleString('zh-CN') });

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("export_excel")
            .setLabel("ðŸ“¥ å¯¼å‡º Excel")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("datacenter_ranking")
            .setLabel("ðŸ“Š æŸ¥çœ‹æŽ’è¡Œ")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("datacenter_quality_check")
            .setLabel("ðŸ” æ•°æ®æ£€æŸ¥")
            .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("datacenter_time_filter")
            .setLabel("ðŸ“… æ—¶é—´ç­›é€‰")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("export_excel")
            .setLabel("âœˆï¸ å‘é€åˆ°é£žæœº")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("datacenter_refresh")
            .setLabel("ðŸ”„ åˆ·æ–°")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({
          embeds: [embed],
          components: [row1, row2],
        });
      } catch (err) {
        console.error("åˆ·æ–°é”™è¯¯:", err);
        await interaction.reply({
          content: `âŒ åˆ·æ–°å¤±è´¥: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // æ•°æ®ç®¡ç†ä¸­å¿ƒ - æ—¶é—´ç­›é€‰
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "datacenter_time_filter") {
      try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        // æ ¼å¼åŒ–æ—¥æœŸä¸º YYYY/M/D HH:MM:SS
        const formatDateTime = (date, time = '00:00:00') => {
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const day = date.getDate();
          return `${year}/${month}/${day} ${time}`;
        };

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("time_filter_select")
            .setPlaceholder("é€‰æ‹©æ—¶é—´èŒƒå›´")
            .addOptions(
              {
                label: "ä»Šå¤©",
                value: `${formatDateTime(today, '00:00:00')}_${formatDateTime(today, '23:59:59')}`,
                description: "ä»…æ˜¾ç¤ºä»Šå¤©çš„æ•°æ®",
              },
              {
                label: "æœ€è¿‘7å¤©",
                value: `${formatDateTime(oneWeekAgo, '00:00:00')}_${formatDateTime(today, '23:59:59')}`,
                description: "æœ€è¿‘7å¤©å†…çš„æ•°æ®",
              },
              {
                label: "æœ€è¿‘30å¤©",
                value: `${formatDateTime(oneMonthAgo, '00:00:00')}_${formatDateTime(today, '23:59:59')}`,
                description: "æœ€è¿‘30å¤©å†…çš„æ•°æ®",
              },
              {
                label: "å…¨éƒ¨æ•°æ®",
                value: "all",
                description: "æ˜¾ç¤ºæ‰€æœ‰æ•°æ®",
              },
              {
                label: "è‡ªå®šä¹‰æ—¶æ®µ",
                value: "custom",
                description: "è‡ªå®šä¹‰å¼€å§‹å’Œç»“æŸæ—¥æœŸæ—¶é—´",
              }
            )
        );

        await interaction.reply({
          content: "ðŸ“… è¯·é€‰æ‹©è¦ç»Ÿè®¡çš„æ—¶é—´èŒƒå›´:",
          components: [row],
          ephemeral: true,
        });
      } catch (err) {
        console.error("æ—¶é—´ç­›é€‰é”™è¯¯:", err);
        await interaction.reply({
          content: `âŒ æ—¶é—´ç­›é€‰å¤±è´¥: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // æ—¶é—´ç­›é€‰ - é€‰æ‹©èœå•å¤„ç†
    // ---------------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === "time_filter_select") {
      try {
        const value = interaction.values[0];

        // å¤„ç†è‡ªå®šä¹‰æ—¶æ®µ
        if (value === "custom") {
          const modal = new ModalBuilder()
            .setCustomId("custom_time_filter_modal")
            .setTitle("è‡ªå®šä¹‰æ—¶é—´èŒƒå›´");

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("custom_start_date")
                .setLabel("å¼€å§‹æ—¥æœŸ (YYYY/M/D)")
                .setPlaceholder("ä¾‹å¦‚: 2026/1/1")
                .setRequired(true)
                .setMaxLength(20)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("custom_start_time")
                .setLabel("å¼€å§‹æ—¶é—´ (HH:MM:SS)")
                .setPlaceholder("ä¾‹å¦‚: 00:00:00")
                .setValue("00:00:00")
                .setRequired(true)
                .setMaxLength(20)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("custom_end_date")
                .setLabel("ç»“æŸæ—¥æœŸ (YYYY/M/D)")
                .setPlaceholder("ä¾‹å¦‚: 2026/1/3")
                .setRequired(true)
                .setMaxLength(20)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("custom_end_time")
                .setLabel("ç»“æŸæ—¶é—´ (HH:MM:SS)")
                .setPlaceholder("ä¾‹å¦‚: 23:59:59")
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

        // ã€æž¶æž„æ”¹é€ ã€‘ä½¿ç”¨SQLite WHEREæŸ¥è¯¢è€ŒéžJSæ•°ç»„filter
        if (value === "all") {
          filteredOrders = db.getAllOrders();
        } else {
          const [startStr, endStr] = value.split("_");
          filteredOrders = db.getOrdersByDateRange(startStr, endStr);
        }

        if (filteredOrders.length === 0) {
          return await interaction.editReply({
            content: "ðŸ“Š é€‰å®šæ—¶é—´èŒƒå›´å†…æš‚æ— æ•°æ®ï½ž",
          });
        }

        // æ ¹æ®ç­›é€‰æ•°æ®è®¡ç®—ç»Ÿè®¡ï¼ˆä½¿ç”¨statisticsæ ¼å¼åŒ–ï¼‰
        const summary = statistics.calculateSummary(filteredOrders);
        
        // ã€æž¶æž„æ”¹é€ ã€‘å¦‚æžœæ˜¯æ—¶é—´èŒƒå›´ç­›é€‰ï¼Œä½¿ç”¨SQLite GROUP BYæŸ¥è¯¢æŽ’è¡Œ
        let assigners, players;
        if (value !== "all") {
          const [startStr, endStr] = value.split("_");
          assigners = db.getAssignerRankingByDateRange(startStr, endStr);
          players = db.getPlayerRankingByDateRange(startStr, endStr);
        } else {
          assigners = db.getAssignerRankingFromDB();
          players = db.getPlayerRankingFromDB();
        }

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle("ðŸ“Š æ—¶é—´èŒƒå›´ç»Ÿè®¡")
          .setDescription(statistics.formatSummary(summary))
          .addFields(
            {
              name: "ðŸ† æ´¾å•å‘˜æŽ’è¡Œ",
              value:
                assigners.length > 0
                  ? assigners
                      .map((a, i) => `${i + 1}. ${a.name}: RM ${a.totalPrice}`)
                      .join('\n')
                  : "æš‚æ— ",
              inline: true,
            },
            {
              name: "â­ é™ªçŽ©å‘˜æŽ’è¡Œ",
              value:
                players.length > 0
                  ? players
                      .map((p, i) => `${i + 1}. ${p.name}: RM ${p.total}`)
                      .slice(0, 5)
                      .join('\n')
                  : "æš‚æ— ",
              inline: true,
            }
          )
          .setFooter({ text: 'ç»Ÿè®¡ç»“æžœï¼Œç»Ÿè®¡äºŽ ' + new Date().toLocaleString('zh-CN') });

        // å¯¼å‡ºæŒ‰é’®
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("export_excel")
            .setLabel("ðŸ“¥ å¯¼å‡º Excel")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("datacenter_refresh")
            .setLabel("ðŸ”„ è¿”å›žä¸»é¢æ¿")
            .setStyle(ButtonStyle.Secondary)
        );

        // ã€æž¶æž„æ”¹é€ ã€‘ä¸å†ä½¿ç”¨global.filteredOrdersCacheç¼“å­˜ï¼Œæ”¹ä¸ºSQLiteå®žæ—¶æŸ¥è¯¢

        await interaction.editReply({
          embeds: [embed],
          components: [row],
        });
      } catch (err) {
        console.error("æ—¶é—´ç­›é€‰å¤„ç†é”™è¯¯:", err);
        await interaction.editReply({
          content: `âŒ å¤„ç†å¤±è´¥: ${err.message}`,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // è‡ªå®šä¹‰æ—¶é—´èŒƒå›´ - Modal æäº¤å¤„ç†
    // ---------------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId === "custom_time_filter_modal") {
      try {
        console.log("[è‡ªå®šä¹‰æ—¶é—´ç­›é€‰] ç”¨æˆ·æäº¤æ•°æ®");
        
        const startDate = interaction.fields.getTextInputValue("custom_start_date");
        const startTime = interaction.fields.getTextInputValue("custom_start_time");
        const endDate = interaction.fields.getTextInputValue("custom_end_date");
        const endTime = interaction.fields.getTextInputValue("custom_end_time");

        console.log(`[è‡ªå®šä¹‰æ—¶é—´ç­›é€‰] æ”¶åˆ°æ•°æ®: ${startDate} ${startTime} ~ ${endDate} ${endTime}`);

        const startDateTime = `${startDate} ${startTime}`;
        const endDateTime = `${endDate} ${endTime}`;

        // éªŒè¯æ—¥æœŸæ ¼å¼
        const validateDateTime = (dateTime) => {
          const dateRegex = /^\d{4}\/\d{1,2}\/\d{1,2}$/;
          const timeRegex = /^\d{1,2}:\d{2}:\d{2}$/;
          const [date, time] = dateTime.split(' ');
          
          if (!dateRegex.test(date) || !timeRegex.test(time)) {
            throw new Error(`æ—¥æœŸæ ¼å¼é”™è¯¯: ${dateTime}. åº”ä¸º YYYY/M/D HH:MM:SS`);
          }
          
          // éªŒè¯æ—¥æœŸå’Œæ—¶é—´çš„æœ‰æ•ˆæ€§
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
            throw new Error(`æ—¥æœŸæˆ–æ—¶é—´æ•°å€¼æ— æ•ˆ: ${dateTime}`);
          }
        };

        validateDateTime(startDateTime);
        validateDateTime(endDateTime);

        console.log("[è‡ªå®šä¹‰æ—¶é—´ç­›é€‰] æ—¥æœŸæ ¼å¼éªŒè¯é€šè¿‡");

        // ã€æž¶æž„æ”¹é€ ã€‘ä½¿ç”¨SQLite WHEREæŸ¥è¯¢è€ŒéžJSæ•°ç»„filter
        const dateStr = startDateTime.split(' ')[0];
        const filteredOrders = db.getOrdersByDateRange(dateStr, dateStr);
        console.log(`[è‡ªå®šä¹‰æ—¶é—´ç­›é€‰] ä»ŽSQLiteæŸ¥è¯¢å¾—åˆ° ${filteredOrders.length} æ¡è®¢å•`);

        await interaction.deferReply({ ephemeral: true });

        if (filteredOrders.length === 0) {
          return await interaction.editReply({
            content: `ðŸ“Š æ—¶é—´èŒƒå›´ ${startDateTime} è‡³ ${endDateTime} å†…æš‚æ— æ•°æ®ï½ž`,
          });
        }

        // æ ¹æ®ç­›é€‰æ•°æ®è®¡ç®—ç»Ÿè®¡
        const summary = statistics.calculateSummary(filteredOrders);
        // ã€æž¶æž„æ”¹é€ ã€‘ä½¿ç”¨SQLite GROUP BYæŸ¥è¯¢æŽ’è¡Œè€ŒéžJSè®¡ç®—
        const assigners = db.getAssignerRankingByDateRange(dateStr, dateStr);
        const players = db.getPlayerRankingByDateRange(dateStr, dateStr);

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle("ðŸ“Š è‡ªå®šä¹‰æ—¶é—´èŒƒå›´ç»Ÿè®¡")
          .setDescription(`ðŸ“… ${startDateTime} è‡³ ${endDateTime}\n\n${statistics.formatSummary(summary)}`)
          .addFields(
            {
              name: "ðŸ† æ´¾å•å‘˜æŽ’è¡Œ",
              value:
                assigners.length > 0
                  ? assigners
                      .map((a, i) => `${i + 1}. ${a.name}: RM ${a.totalPrice}`)
                      .join('\n')
                  : "æš‚æ— ",
              inline: true,
            },
            {
              name: "â­ é™ªçŽ©å‘˜æŽ’è¡Œ",
              value:
                players.length > 0
                  ? players
                      .map((p, i) => `${i + 1}. ${p.name}: RM ${p.total}`)
                      .slice(0, 5)
                      .join('\n')
                  : "æš‚æ— ",
              inline: true,
            }
          )
          .setFooter({ text: 'ç»Ÿè®¡ç»“æžœï¼Œç»Ÿè®¡äºŽ ' + new Date().toLocaleString('zh-CN') });

        // å¯¼å‡ºæŒ‰é’®
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("export_excel")
            .setLabel("ðŸ“¥ å¯¼å‡º Excel")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("datacenter_refresh")
            .setLabel("ðŸ”„ è¿”å›žä¸»é¢æ¿")
            .setStyle(ButtonStyle.Secondary)
        );

        // ã€æž¶æž„æ”¹é€ ã€‘ä¸å†ä½¿ç”¨global.filteredOrdersCacheç¼“å­˜ï¼Œæ”¹ä¸ºSQLiteå®žæ—¶æŸ¥è¯¢

        console.log("[è‡ªå®šä¹‰æ—¶é—´ç­›é€‰] å‡†å¤‡å‘é€å›žå¤");

        await interaction.editReply({
          embeds: [embed],
          components: [row],
        });

        console.log("[è‡ªå®šä¹‰æ—¶é—´ç­›é€‰] å¤„ç†å®Œæˆ");
      } catch (err) {
        console.error("è‡ªå®šä¹‰æ—¶é—´èŒƒå›´å¤„ç†é”™è¯¯:", err);
        console.error("é”™è¯¯å †æ ˆ:", err.stack);
        
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
              content: `âŒ å¤„ç†å¤±è´¥: ${err.message}`,
            });
          } else {
            await interaction.reply({
              content: `âŒ å¤„ç†å¤±è´¥: ${err.message}`,
              ephemeral: true,
            });
          }
        } catch (replyErr) {
          console.error("å›žå¤é”™è¯¯å¤±è´¥:", replyErr);
        }
      }
      return;
    }

    // ---------------------------------------------------------
    // /queryrecordsï¼ˆæŸ¥è¯¢æŠ¥å¤‡å’Œå•å­è®°å½•ï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "queryrecords"
    ) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ“Š å•å­æŸ¥è¯¢ä¸­å¿ƒ")
        .setDescription(`${sep()}\nç‚¹å‡»ä¸‹æ–¹æŒ‰é’®æŸ¥çœ‹æŠ¥å¤‡å’Œå•å­è®°å½•ï½ž\n${sep()}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("view_reports")
          .setLabel("ðŸ“‹ æŸ¥çœ‹æŠ¥å¤‡")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("view_orders")
          .setLabel("ðŸ“¦ æŸ¥çœ‹å•å­è®°å½•")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("export_excel")
          .setLabel("ðŸ“Š å¯¼å‡º Excel")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("export_excel")
          .setLabel("âœˆï¸ å¯¼å‡ºåˆ°é£žæœº")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ---------------------------------------------------------
    // å¯¼å‡º CSV æŒ‰é’® - ã€å®Œå…¨é‡å†™ã€‘ä½¿ç”¨ SQLite CLI å®žæ—¶æŸ¥è¯¢
    // ã€çº¦æŸã€‘ä»…ä½¿ç”¨ SQLite æ•°æ®æºï¼Œæ— ç¼“å­˜ã€æ—  JSONã€æ—  db.getAllOrders()
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "export_excel") {
      try {
        await interaction.deferReply({ ephemeral: true });

        // ðŸ”´ã€CRITICALã€‘ä¸å…è®¸ä½¿ç”¨ä»»ä½•ç¼“å­˜ã€JSON æˆ–ä¸­é—´è¯»å–
        // - âŒ cacheManager.invalidate() - ç¦æ­¢
        // - âŒ db.getAllOrders() - ç¦æ­¢
        // - âŒ statistics.loadOrdersData() - ç¦æ­¢
        // - âŒ orders.json - ç¦æ­¢
        // âœ… ä»…ä½¿ç”¨ SQLite CLI ç›´æŽ¥æŸ¥è¯¢

        const DB_PATH = path.join(__dirname, 'data.db');
        const TMP_DIR = path.join(__dirname, 'tmp');
        
        // ç¡®ä¿ tmp ç›®å½•å­˜åœ¨
        if (!fs.existsSync(TMP_DIR)) {
          fs.mkdirSync(TMP_DIR, { recursive: true });
        }

        // ã€æ­¥éª¤ 1ã€‘ä½¿ç”¨ SQLite CLI å®žæ—¶æŸ¥è¯¢ & å¯¼å‡º CSV
        // ã€å…³é”®ã€‘æ¯æ¬¡éƒ½æ‰§è¡Œæ–°çš„ SELECT æŸ¥è¯¢ï¼Œç¡®ä¿èŽ·å–æœ€æ–°æ•°æ®
        const fileName = `å•å­ç»Ÿè®¡_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
        const filePath = path.join(TMP_DIR, fileName);

        console.log(`[export_excel] ðŸ”„ å¼€å§‹ä½¿ç”¨ SQLite CLI å¯¼å‡º...`);
        console.log(`[export_excel] æ•°æ®åº“è·¯å¾„: ${DB_PATH}`);
        console.log(`[export_excel] è¾“å‡ºè·¯å¾„: ${filePath}`);

        // ã€å…³é”®æ­¥éª¤ã€‘ä½¿ç”¨ sqlite3 CLI å¯¼å‡º CSV
        // .headers on    â†’ åŒ…å«åˆ—å
        // .mode csv      â†’ CSV æ ¼å¼
        // .output        â†’ è¾“å‡ºåˆ°æ–‡ä»¶
        // SELECT ... ORDER BY id DESC â†’ æœ€æ–°æ•°æ®ä¼˜å…ˆ
        const { execSync } = require('child_process');
        
        try {
          // ã€å®žæ—¶æ‰§è¡Œ SQLite æŸ¥è¯¢ã€‘
          const sql = `
.mode csv
.headers on
.output "${filePath}"
SELECT id, type, boss, player, assigner, orderType, game, duration, amount, price, date, source, orderNo, customer, source_channel FROM orders ORDER BY id DESC;
.output stdout
`;
          
          const cmd = `sqlite3 "${DB_PATH}" "${sql}"`;
          execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });

          console.log(`[export_excel] âœ… SQLite CLI å¯¼å‡ºå®Œæˆ`);

          // ã€æ­¥éª¤ 2ã€‘éªŒè¯æ–‡ä»¶æ˜¯å¦æˆåŠŸåˆ›å»º
          if (!fs.existsSync(filePath)) {
            throw new Error(`CSV æ–‡ä»¶æœªæˆåŠŸåˆ›å»º: ${filePath}`);
          }

          const fileSize = fs.statSync(filePath).size;
          console.log(`[export_excel] ðŸ“ æ–‡ä»¶å¤§å°: ${(fileSize / 1024).toFixed(2)} KB`);

          // ã€æ­¥éª¤ 3ã€‘è¯»å– CSV å†…å®¹ï¼Œè®¡ç®—è¡Œæ•°ï¼ˆä¸ä½¿ç”¨ db.getAllOrders()ï¼‰
          const csvContent = fs.readFileSync(filePath, 'utf8');
          const lines = csvContent.split('\n').filter(l => l.trim());
          const dataRowCount = Math.max(0, lines.length - 1); // å‡åŽ» header è¡Œ
          
          console.log(`[export_excel] ðŸ“Š æ•°æ®è¡Œæ•°: ${dataRowCount}`);

          // ã€æ­¥éª¤ 4ã€‘ä½œä¸º Discord é™„ä»¶å‘é€
          const attachment = new AttachmentBuilder(filePath, { name: fileName });
          
          await interaction.editReply({
            content: `âœ… CSV å·²ä»Ž SQLite å®žæ—¶å¯¼å‡º\nðŸ“Š å…± ${dataRowCount} æ¡è®°å½•\nðŸ’¾ æ–‡ä»¶å·²ç”Ÿæˆï¼Œè¯·ä¸‹è½½`,
            files: [attachment],
          });

          console.log(`[export_excel] âœ… é™„ä»¶å·²å‘é€åˆ° Discord`);

          // ã€æ­¥éª¤ 5ã€‘å¼‚æ­¥æ¸…ç†æœ¬åœ°æ–‡ä»¶ï¼ˆ5 ç§’åŽåˆ é™¤ï¼‰
          setTimeout(() => {
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[export_excel] ðŸ—‘ï¸  ä¸´æ—¶æ–‡ä»¶å·²åˆ é™¤: ${fileName}`);
              }
            } catch (err) {
              console.error(`[export_excel] âŒ åˆ é™¤æ–‡ä»¶å¤±è´¥: ${err.message}`);
            }
          }, 5000);

        } catch (execErr) {
          console.error(`[export_excel] âŒ SQLite CLI æ‰§è¡Œå¤±è´¥:`, execErr.message);
          
          // åˆ é™¤å¤±è´¥çš„æ–‡ä»¶
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          throw new Error(`SQLite å¯¼å‡ºå¤±è´¥: ${execErr.message}`);
        }

      } catch (err) {
        console.error(`[export_excel] âŒ å¯¼å‡ºæµç¨‹å¼‚å¸¸:`, err.message);
        console.error(`[export_excel] é”™è¯¯å †æ ˆ:`, err.stack);
        
        await interaction.editReply({
          content: `âŒ å¯¼å‡ºå¤±è´¥: ${err.message}\n\nðŸ’¡ è¯·æ£€æŸ¥ï¼š\nâ€¢ SQLite æ•°æ®åº“æ˜¯å¦å¯è®¿é—®\nâ€¢ ç£ç›˜ç©ºé—´æ˜¯å¦å……è¶³\nâ€¢ æƒé™è®¾ç½®æ˜¯å¦æ­£ç¡®`,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // å¯¼å‡ºåˆ° Telegramï¼ˆé£žæœºï¼‰æŒ‰é’® - å·²æ”¹ä¸º export_excel
    // ---------------------------------------------------------
    // ã€å·²å¼ƒç”¨ã€‘æ­¤å¤„ç†å™¨å·²ç§»é™¤ï¼Œæ‰€æœ‰å¯¼å‡ºå‡ä½¿ç”¨ export_excel

    // ---------------------------------------------------------
    // æŸ¥çœ‹æŠ¥å¤‡è®°å½•æŒ‰é’®
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "view_reports") {
      try {
        const orders = await db.getAllOrders();
        const reports = orders.filter(o => o.source === "reportForm" || o.source === "giftReportForm" || o.source === "renewReportForm");

        if (reports.length === 0) {
          return interaction.reply({
            content: "ðŸ“‹ æš‚æ— æŠ¥å¤‡è®°å½•ï½ž",
            ephemeral: true,
          });
        }

        // åˆ†é¡µæ˜¾ç¤ºï¼ˆæ¯é¡µæœ€å¤š 10 æ¡ï¼‰
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
            .setTitle(`ðŸ“‹ å•å­æŠ¥å¤‡è®°å½• (ç¬¬ ${page + 1}/${pages.length} é¡µ)`)
            .setDescription(`${sep()}\nå…± ${reports.length} æ¡æŠ¥å¤‡è®°å½•\n${sep()}`);

          items.forEach((report, idx) => {
            const index = page * pageSize + idx + 1;
            if (report.source === "reportForm") {
              let value = `ðŸ‘¤ **è€æ¿:** ${report.boss}\nðŸ§š **é™ªé™ª:** ${report.player}\nðŸ§© **ç±»åž‹:** ${report.orderType}\nâ° **æ—¶é•¿:** ${report.duration}\nðŸ’° **é‡‘é¢:** RM ${report.amount}`;
              if (report.orderNo) {
                value += `\nðŸ”¢ **å•å·:** ${report.orderNo}`;
              }
              embed.addFields({
                name: `#${index} - ${report.date}`,
                value: value,
                inline: false,
              });
            } else if (report.source === "giftReportForm") {
              let value = `ðŸ‘¤ **é€ç¤¼äºº:** ${report.giver}\nðŸ§š **æ”¶ç¤¼äºº:** ${report.receiver}\nðŸŽ **ç¤¼ç‰©:** ${report.gift}\nðŸ’° **ä»·å€¼:** RM ${report.amount}`;
              if (report.orderNo) {
                value += `\nðŸ”¢ **å•å·:** ${report.orderNo}`;
              }
              embed.addFields({
                name: `#${index} - ç¤¼ç‰©æŠ¥å¤‡ - ${report.date}`,
                value: value,
                inline: false,
              });
            } else if (report.source === "renewReportForm") {
              let value = `ðŸ‘¤ **è€æ¿:** ${report.boss}\nðŸ§š **é™ªé™ª:** ${report.player}\nðŸ“¦ **åŽŸå•å·:** ${report.originalOrder}\nâ° **æ—¶é•¿:** ${report.duration}\nðŸ’° **é‡‘é¢:** RM ${report.amount}`;
              if (report.orderNo) {
                value += `\nðŸ”¢ **æ–°å•å·:** ${report.orderNo}`;
              }
              embed.addFields({
                name: `#${index} - ðŸ”„ ç»­å•æŠ¥å¤‡ - ${report.date}`,
                value: value,
                inline: false,
              });
            }
          });

          embed.setFooter({ text: "é™ªçŽ©åŽå®« â€¢ æŠ¥å¤‡ç®¡ç†ç³»ç»Ÿ" });
          embed.setTimestamp();
          return embed;
        };

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev_report_page")
            .setLabel("â¬…ï¸ ä¸Šä¸€é¡µ")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId("next_report_page")
            .setLabel("ä¸‹ä¸€é¡µ âž¡ï¸")
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
                .setLabel("â¬…ï¸ ä¸Šä¸€é¡µ")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
              new ButtonBuilder()
                .setCustomId("next_report_page")
                .setLabel("ä¸‹ä¸€é¡µ âž¡ï¸")
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
        console.error("æŸ¥çœ‹æŠ¥å¤‡è®°å½•é”™è¯¯:", err);
        interaction.reply({
          content: "âŒ æŸ¥è¯¢æŠ¥å¤‡è®°å½•æ—¶å‡ºé”™ï¼Œè¯·ç¨åŽé‡è¯•ï½ž",
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // æŸ¥çœ‹å•å­è®°å½•æŒ‰é’®
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "view_orders") {
      try {
        const orders = await db.getAllOrders();
        const assignedOrders = orders.filter(o => o.orderNo);

        if (assignedOrders.length === 0) {
          return interaction.reply({
            content: "ðŸ“¦ æš‚æ— æ´¾å•è®°å½•ï½ž",
            ephemeral: true,
          });
        }

        // åˆ†é¡µæ˜¾ç¤ºï¼ˆæ¯é¡µæœ€å¤š 10 æ¡ï¼‰
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
            .setTitle(`ðŸ“¦ å•å­æ´¾å•è®°å½• (ç¬¬ ${page + 1}/${pages.length} é¡µ)`)
            .setDescription(`${sep()}\nå…± ${assignedOrders.length} æ¡æ´¾å•è®°å½•\n${sep()}`);

          items.forEach((order, idx) => {
            const index = page * pageSize + idx + 1;
            embed.addFields({
              name: `#${index} - ${order.orderNo} - ${order.date}`,
              value: `ðŸ™‹ **æ´¾å•å‘˜:** ${order.assigner}\nðŸ§š **é™ªçŽ©å‘˜:** ${order.player}\nðŸŽ® **æ¸¸æˆ:** ${order.game}\nâ° **æ—¶é•¿:** ${order.duration}\nðŸ’° **ä»·æ ¼:** RM ${order.price}`,
              inline: false,
            });
          });

          embed.setFooter({ text: "é™ªçŽ©åŽå®« â€¢ æ´¾å•ç®¡ç†ç³»ç»Ÿ" });
          embed.setTimestamp();
          return embed;
        };

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev_order_page")
            .setLabel("â¬…ï¸ ä¸Šä¸€é¡µ")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId("next_order_page")
            .setLabel("ä¸‹ä¸€é¡µ âž¡ï¸")
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
                .setLabel("â¬…ï¸ ä¸Šä¸€é¡µ")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
              new ButtonBuilder()
                .setCustomId("next_order_page")
                .setLabel("ä¸‹ä¸€é¡µ âž¡ï¸")
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
        console.error("æŸ¥çœ‹æ´¾å•è®°å½•é”™è¯¯:", err);
        interaction.reply({
          content: "âŒ æŸ¥è¯¢æ´¾å•è®°å½•æ—¶å‡ºé”™ï¼Œè¯·ç¨åŽé‡è¯•ï½ž",
          ephemeral: true,
        });
      }
      return;
    }

    // ---------------------------------------------------------
    // /ticketsetupï¼ˆåˆ›å»ºé™ªçŽ©è®¢å•æŒ‰é’®ï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "ticketsetup"
    ) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸŽŸï¸  é™ªçŽ©ä¸‹å•ç³»ç»Ÿ")
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1440965791313952868/Generated_Image_November_20_2025_-_1_45PM.png?ex=69201378&is=691ec1f8&hm=2ba4de5f511070f09474d79525165cc9ce3a552b90766c65963546a58710f6a7&")
        .setDescription(`${sep()}\nç‚¹ä¸‹é¢çš„æŒ‰é’®å¡«å†™é™ªçŽ©å•å§ï½ž ðŸ’–\n${sep()}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("ðŸŽ® ä¸‹å•é™ªçŽ©è®¢å•")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ---------------------------------------------------------
    // æ‰“å¼€é™ªçŽ©è®¢å• Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "open_ticket") {
      const modal = new ModalBuilder()
        .setCustomId("ticketForm")
        .setTitle("ðŸŽ® é™ªçŽ©è®¢å•è¡¨");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("game")
            .setLabel("ðŸŽ® æ¸¸æˆåç§°")
            .setPlaceholder("ä¾‹å¦‚ï¼šValorant / CS2 / Apex")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("time")
            .setLabel("â° é¢„å®šæ—¶é—´")
            .setPlaceholder("ä¾‹å¦‚ï¼šå‡ å°æ—¶ï¼ˆä¸€å±€/ä¸¤å°æ—¶)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("mode")
            .setLabel("ðŸŽ¯ æ¸¸æˆæ¨¡å¼")
            .setPlaceholder("ä¾‹å¦‚ï¼šå¨±ä¹ / æŽ’ä½ / é™ªçŽ©")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("extra")
            .setLabel("âœ¨ ç‰¹åˆ«éœ€æ±‚")
            .setPlaceholder("ä¾‹å¦‚ï¼šæŒ‡å®šé™ªçŽ© / ä¸å¼€éº¦ / èŠå¤©ï¼ˆé€‰å¡«ï¼‰")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // æäº¤é™ªçŽ©è®¢å• Modalï¼ˆåˆ›å»º ticket é¢‘é“ï¼‰
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
      const extra = interaction.fields.getTextInputValue("extra") || "æ— ";

      // æ£€æŸ¥ç”¨æˆ·çŽ°æœ‰çš„ticketæ•°é‡ï¼ˆé€šè¿‡topicä¸­çš„user.idï¼‰
      const userTickets = guild.channels.cache.filter(
        (c) => c.topic && c.topic.startsWith(`ticket_user:${user.id}`)
      );

      if (userTickets.size >= 5) {
        await interaction.reply({
          content: "â— ä½ å·²ç»æœ‰5ä¸ªè¿›è¡Œä¸­çš„é™ªçŽ©å·¥å•ï¼Œæ— æ³•ç»§ç»­åˆ›å»ºã€‚è¯·å…ˆå®Œæˆå…¶ä»–å·¥å•åŽå†æäº¤æ–°çš„ï½ž",
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
        .setTitle("ðŸŽ® é™ªçŽ©è®¢å•è¯¦æƒ…")
        .setDescription(`${sep()}\nä½ çš„è®¢å•å·²è®°å½•ï¼Œæˆ‘ä»¬ä¼šæ¸©æŸ”åœ°å®‰æŽ’é™ªçŽ©ï½ž\n${sep()}\n\nðŸ“‹ **è®¢å•ä¿¡æ¯**`)
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1440965791313952868/Generated_Image_November_20_2025_-_1_45PM.png?ex=69201378&is=691ec1f8&hm=2ba4de5f511070f09474d79525165cc9ce3a552b90766c65963546a58710f6a7&")
        .addFields(
          { name: "ðŸ‘¤ ç”¨æˆ·", value: `**${user}**`, inline: true },
          { name: "ðŸŽ® æ¸¸æˆ", value: game, inline: true },
          { name: "â° é¢„çº¦æ—¶é—´", value: time, inline: true },
          { name: "ðŸŽ¯ æ¨¡å¼", value: mode, inline: true },
          { name: "âœ¨ ç‰¹åˆ«éœ€æ±‚", value: extra || "æ— ", inline: false },
          { name: "âŒš åˆ›å»ºæ—¶é—´", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "ðŸ“Š è®¢å•çŠ¶æ€", value: "ðŸ”” å¾…æ´¾å•", inline: true }
        )
        .setFooter({ text: "é™ªçŽ©åŽå®« â€¢ æ„Ÿè°¢ä½ çš„ä¿¡ä»» ðŸ’—" })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("assign_order")
          .setLabel("ðŸ“‹ æ´¾å•")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("renew_order")
          .setLabel("ðŸ”„ ç»­å•")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("ðŸ”’ å…³é—­å·¥å•")
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({
        content: `<@&${config.adminRoleId}> <@&${SUPPORT_SECOND_ROLE_ID}> ðŸ“¢ æ–°é™ªçŽ©å·¥å•æ¥è‡ª ${user}`,
        embeds: [embed],
        components: [row],
      });

      // ðŸ• è®¾ç½®è‡ªåŠ¨å…³é—­ï¼š24å°æ—¶åŽè‡ªåŠ¨å…³é—­ticket
      const ticketKey = ticketChannel.id;
      const timeoutId = setTimeout(async () => {
        try {
          const channel = await client.channels.fetch(ticketKey).catch(() => null);
          if (channel) {
            await channel.send({
              content: "â° å·¥å•å·²è¿è¡Œ24å°æ—¶ï¼ŒçŽ°å·²è‡ªåŠ¨å…³é—­ã€‚å¦‚æœ‰æ–°éœ€æ±‚è¯·é‡æ–°æäº¤ï½ž",
            });
            setTimeout(() => {
              // ã€ä¿®å¤é—®é¢˜ 20ã€‘æ£€æŸ¥ Channel æ˜¯å¦ä»ç„¶å­˜åœ¨
              try {
                channel.delete().catch((err) => {
                  if (err.code !== 10003) { // 10003: Unknown channel
                    console.warn("âš ï¸  åˆ é™¤ Ticket Channel å¤±è´¥:", err.message);
                  }
                });
              } catch (err) {
                console.error("âŒ Ticket é¢‘é“åˆ é™¤å¼‚å¸¸:", err.message);
              }
            }, 2000);
            ticketTimers.delete(ticketKey);
          }
        } catch (err) {
          console.error("âŒ è‡ªåŠ¨å…³é—­ticketé”™è¯¯:", err.message);
          // ç¡®ä¿æ¸…ç† timerï¼Œå³ä½¿å‡ºé”™
          ticketTimerCleanup(ticketKey);
        }
      }, TICKET_TIMEOUT);

      // ä¿å­˜timer IDæ–¹ä¾¿å–æ¶ˆï¼ˆå¦‚æžœæ‰‹åŠ¨å…³é—­ï¼‰
      ticketTimers.set(ticketKey, timeoutId);

      await interaction.reply({
        content: `âœ¨ ä½ çš„é™ªçŽ©å·¥å•å·²åˆ›å»ºï¼š${ticketChannel}ï¼Œæˆ‘ä»¬ä¼šå°½å¿«å®‰æŽ’ï½ž`,
        ephemeral: true,
      });

      return;
    }

    // ---------------------------------------------------------
    // ç‚¹å‡»ã€ŒðŸ“‹ æ´¾å•ã€æŒ‰é’® â†’ æ‰“å¼€æ´¾å• Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "assign_order") {
      // åªå…è®¸ç®¡ç†å‘˜æˆ–æ‹¥æœ‰æŒ‡å®šç®¡ç†å‘˜è§’è‰²çš„æˆå‘˜æ´¾å•
      const member =
        interaction.guild.members.cache.get(interaction.user.id) ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

      if (!member) {
        await interaction.reply({ content: "âŒ æ— æ³•éªŒè¯ä½ çš„æƒé™ã€‚", ephemeral: true });
        return;
      }

      const isAdmin =
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.has(config.adminRoleId);

      if (!isAdmin) {
        await interaction.reply({ content: "âŒ æŠ±æ­‰ï¼Œåªæœ‰ç®¡ç†å‘˜å¯ä»¥è¿›è¡Œæ´¾å•æ“ä½œã€‚", ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("assignForm")
        .setTitle("ðŸ“‹ æ´¾å•è¯¦æƒ…");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("player")
            .setLabel("ðŸ†”é™ªçŽ©ç”¨æˆ·å")
            .setPlaceholder("ä¾‹å¦‚ï¼šå°é›ª / å°å¸ƒä¸")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("game")
            .setLabel("ðŸŽ®æ¸¸æˆåç§°")
            .setPlaceholder("ä¾‹å¦‚ï¼šValorant / CS2 / Apex")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("â°æ—¶é•¿")
            .setPlaceholder("ä¾‹å¦‚ï¼š2 å°æ—¶ / 3 å±€")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("price")
            .setLabel("ðŸ’²ä»·æ ¼ (RM)")
            .setPlaceholder("ä¾‹å¦‚ï¼š20 / 40 / 60")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // æ´¾å• Modal æäº¤ï¼ˆæ–°æ´¾å•è®°å½•ï¼‰
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
        : "æœªçŸ¥";

      const player = interaction.fields.getTextInputValue("player");
      const game = interaction.fields.getTextInputValue("game");
      const duration = interaction.fields.getTextInputValue("duration");
      const price = parsePrice(interaction.fields.getTextInputValue("price"));

      // â­ éšæœºç”Ÿæˆå•å·
      const orderNo = generateOrderNumber();

      // ä¿å­˜åˆ°æ•°æ®åº“
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
        console.error("ä¿å­˜æ´¾å•åˆ°æ•°æ®åº“å¤±è´¥ï¼š", err);
      }

      // æ›´æ–°ç»Ÿè®¡
      try {
        const stats = await db.getStats();
        await db.updateStats(stats.totalOrders + 1, stats.totalRevenue + Number(price));
      } catch (err) {
        console.error("æ›´æ–°ç»Ÿè®¡å¤±è´¥ï¼š", err);
      }

      // ðŸ“± è‡ªåŠ¨å‘é€æ´¾å•åˆ° Telegramï¼ˆä»…ç¬¬ä¸€ä¸ªç¾¤ï¼‰
      const telegramOrderMsg = `<b>ðŸ“‹ æ–°çš„æ´¾å•è®°å½•</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
<b>ðŸ™‹ æ´¾å•å‘˜:</b> ${assigner}
<b>ðŸ§š é™ªçŽ©å‘˜:</b> ${player}
<b>ðŸŽ® æ¸¸æˆ:</b> ${game}
<b>â° æ—¶é•¿:</b> ${duration}
<b>ðŸ’° ä»·æ ¼:</b> RM ${price}
<b>ðŸ“¦ å•å·:</b> ${orderNo}
<b>ðŸ“… æ—¶é—´:</b> ${new Date().toLocaleString("zh-CN")}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`;
      await sendTelegramReport(config.telegramChatId, telegramOrderMsg, config.telegramMessageThreadId).catch(() => {});

      // æ–°æ´¾å•è®°å½• embedï¼ˆç²‰è‰²å¯çˆ±é£Žï¼‰
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ“‹ æ–°æ´¾å•è®°å½•ï½žã€æ´¾å•ç¡®è®¤ã€‘")
        .setDescription(`${sep()}\nâœ¨ æ–°æ´¾å•å·²ç™»è®°ï¼Œæˆ‘ä»¬ä¼šæ¸©æŸ”åœ°è·Ÿè¿›ï½ž\n${sep()}\n\nðŸ‘¥ **æ´¾å•è¯¦æƒ…**`)
        .addFields(
          { name: "ðŸ™‹â€â™‚ï¸ æ´¾å•å‘˜", value: `**${assigner}**`, inline: true },
          { name: "ðŸ§šâ€â™€ï¸ é™ªçŽ©å‘˜", value: `**${player}**`, inline: true },
          { name: "ðŸŽ® æ¸¸æˆ", value: game, inline: true },
          { name: "â° æ—¶é•¿", value: duration, inline: true },
          { name: "ðŸ’° ä»·æ ¼", value: `**RM ${price}**`, inline: true },
          { name: "ðŸ†” å®¢æˆ·ID", value: customer, inline: true },
          { name: "ðŸ“¦ å•å·", value: `\`\`\`${orderNo}\`\`\``, inline: false },
          { name: "âŒš æ´¾å•æ—¶é—´", value: new Date().toLocaleString('zh-CN'), inline: true },
          { name: "âœ… å•æ®çŠ¶æ€", value: "âœ”ï¸ å·²ç¡®è®¤", inline: true }
        )
        .setFooter({
          text: "âœ… å·²ä¿å­˜è‡³SQLiteæ•°æ®åº“ â€¢ è°¢è°¢ä½ çš„é…åˆ ðŸ’—",
        })
        .setTimestamp();

      // ã€ç¦ç”¨ã€‘æ´¾å•è®°å½•ä¸éœ€è¦å‘åŽ»LOG_CHANNEL_ID
      // const logChannel =
      //   guild.channels.cache.get(LOG_CHANNEL_ID) ||
      //   (await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
      // if (logChannel) {
      //   await logChannel.send({ embeds: [embed] });
      // }

      // ã€æ–°å¢žã€‘è‡ªåŠ¨å‘é€åˆ°æŠ¥å¤‡æ´¾å•é¢‘é“
      try {
        const reportDispatchChannel = guild.channels.cache.get(REPORT_DISPATCH_CHANNEL_ID) ||
          (await guild.channels.fetch(REPORT_DISPATCH_CHANNEL_ID).catch(() => null));
        if (reportDispatchChannel && reportDispatchChannel.isTextBased()) {
          await reportDispatchChannel.send({ embeds: [embed] });
          console.log(`âœ… æ´¾å•å·²å‘é€åˆ°é¢‘é“: ${REPORT_DISPATCH_CHANNEL_ID}`);
        } else {
          console.warn(`âš ï¸ æŠ¥å¤‡æ´¾å•é¢‘é“ä¸å­˜åœ¨æˆ–éžæ–‡æœ¬é¢‘é“: ${REPORT_DISPATCH_CHANNEL_ID}`);
        }
      } catch (err) {
        console.error("âŒ å‘é€æ´¾å•åˆ°é¢‘é“å¤±è´¥ï¼š", err.message);
      }

      // æ£€æŸ¥channelæ˜¯å¦å­˜åœ¨ï¼ˆå¯èƒ½å·²è¢«åˆ é™¤ï¼‰
      if (interaction.channel) {
        await interaction.reply({
          content: "âœ… æ´¾å•å·²æˆåŠŸè®°å½•ï¼Œæ„Ÿè°¢ä½ ï½ž",
          ephemeral: true,
        }).catch(() => {
          // å¦‚æžœinteractionå¤±æ•ˆï¼Œå¿½ç•¥é”™è¯¯
          console.log("æ´¾å•modal replyå¤±è´¥ï¼Œä½†æ•°æ®å·²ä¿å­˜");
        });
      }

      return;
    }

    // ---------------------------------------------------------
    // ç‚¹å‡»ã€ŒðŸ”„ ç»­å•ã€æŒ‰é’® â†’ æ‰“å¼€ç»­å• Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "renew_order") {
      const modal = new ModalBuilder()
        .setCustomId("renewForm")
        .setTitle("ðŸ”„ ç»­å•è¯¦æƒ…");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("player")
            .setLabel("ðŸ†”é™ªçŽ©ç”¨æˆ·å")
            .setPlaceholder("ä¾‹å¦‚ï¼šå°é›ª / å°å¸ƒä¸")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("game")
            .setLabel("ðŸŽ®æ¸¸æˆåç§°")
            .setPlaceholder("ä¾‹å¦‚ï¼šValorant / CS2 / Apex")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("â°æ—¶é•¿")
            .setPlaceholder("ä¾‹å¦‚ï¼š2 å°æ—¶ / 3 å±€")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("price")
            .setLabel("ðŸ’²ä»·æ ¼ (RM)")
            .setPlaceholder("ä¾‹å¦‚ï¼š20 / 40 / 60")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("original_order")
            .setLabel("ðŸ“¦åŽŸå•å·ï¼ˆç»­å•ç”¨ï¼‰")
            .setPlaceholder("è¾“å…¥åŽŸå•å·ï¼Œå¦‚æ²¡æœ‰å¯ç•™ç©º")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // ç»­å• Modal æäº¤ï¼ˆæ–°ç»­å•è®°å½•ï¼‰
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
        : "æœªçŸ¥";

      const player = interaction.fields.getTextInputValue("player");
      const game = interaction.fields.getTextInputValue("game");
      const duration = interaction.fields.getTextInputValue("duration");
      const price = parsePrice(interaction.fields.getTextInputValue("price"));
      const originalOrder = interaction.fields.getTextInputValue("original_order");

      // â­ éšæœºç”Ÿæˆæ–°å•å·
      const orderNo = generateOrderNumber();

      // ä¿å­˜è‡³ SQLite æ•°æ®åº“
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
        console.error("ä¿å­˜ç»­å•åˆ°æ•°æ®åº“å¤±è´¥ï¼š", err);
      }

      // æ›´æ–°ç»Ÿè®¡
      try {
        const stats = await db.getStats();
        await db.updateStats(stats.totalOrders + 1, stats.totalRevenue + Number(price));
      } catch (err) {
        console.error("æ›´æ–°ç»Ÿè®¡å¤±è´¥ï¼š", err);
      }

      // ðŸ“± è‡ªåŠ¨å‘é€ç»­å•åˆ° Telegram
      const telegramRenewMsg = `<b>ðŸ”„ æ–°çš„ç»­å•è®°å½•</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
<b>ðŸ™‹ æ´¾å•å‘˜:</b> ${assigner}
<b>ðŸ§š é™ªçŽ©å‘˜:</b> ${player}
<b>ðŸŽ® æ¸¸æˆ:</b> ${game}
<b>â° æ—¶é•¿:</b> ${duration}
<b>ðŸ’° ä»·æ ¼:</b> RM ${price}
<b>ðŸ“¦ æ–°å•å·:</b> ${orderNo}
<b>ðŸ“¦ åŽŸå•å·:</b> ${originalOrder || "æœªè®°å½•"}
<b>ðŸ‘¤ å®¢æˆ·ID:</b> ${customer}
<b>ðŸ“… æ—¶é—´:</b> ${new Date().toLocaleString("zh-CN")}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`;
      await sendTelegramReport(config.telegramChatId, telegramRenewMsg, config.telegramMessageThreadId).catch(() => {});

      // ðŸ“Š å‘é€ç»­å•è®°å½•åˆ°æ—¥å¿—é¢‘é“
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ”„ æ–°ç»­å•è®°å½•")
        .setDescription(`${sep()}\nç»­å•å·²ç™»è®°ï¼Œæˆ‘ä»¬ä¼šæ¸©æŸ”åœ°è·Ÿè¿›ï½ž\n${sep()}`)
        .addFields(
          { name: "ðŸ™‹â€â™‚ï¸ æ´¾å•å‘˜", value: assigner, inline: true },
          { name: "ðŸ§šâ€â™€ï¸ é™ªçŽ©å‘˜", value: player, inline: true },
          { name: "ðŸŽ® æ¸¸æˆ", value: game, inline: true },
          { name: "â° æ—¶é•¿", value: duration, inline: true },
          { name: "ðŸ’° ä»·æ ¼", value: `RM ${price}`, inline: true },
          { name: "ðŸ†” å®¢æˆ·ID", value: customer, inline: true },
          { name: "ðŸ“¦ æ–°å•å·", value: `ðŸ“¦ ${orderNo}`, inline: true },
          { name: "ðŸ“¦ åŽŸå•å·", value: `ðŸ“¦ ${originalOrder || "æœªè®°å½•"}`, inline: true }
        )
        .setFooter({
          text: "âœ… å·²ä¿å­˜è‡³SQLiteæ•°æ®åº“ â€¢ è°¢è°¢ä½ çš„é…åˆ ðŸ’—",
        })
        .setTimestamp();

      // ã€ç¦ç”¨ã€‘ç»­å•è®°å½•ä¸éœ€è¦å‘åŽ»LOG_CHANNEL_ID
      // const logChannel =
      //   guild.channels.cache.get(LOG_CHANNEL_ID) ||
      //   (await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
      // if (logChannel) {
      //   await logChannel.send({ embeds: [embed] });
      // }

      // æ£€æŸ¥channelæ˜¯å¦å­˜åœ¨ï¼ˆå¯èƒ½å·²è¢«åˆ é™¤ï¼‰
      if (interaction.channel) {
        await interaction.reply({
          content: "âœ… ç»­å•å·²æˆåŠŸè®°å½•ï¼Œæ„Ÿè°¢ä½ ï½ž",
          ephemeral: true,
        }).catch(() => {
          // å¦‚æžœinteractionå¤±æ•ˆï¼Œå¿½ç•¥é”™è¯¯
          console.log("ç»­å•modal replyå¤±è´¥ï¼Œä½†æ•°æ®å·²ä¿å­˜");
        });
      }

      return;
    }

    // ---------------------------------------------------------
    // å…³é—­é™ªçŽ©å·¥å•
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "close_ticket") {
      const channel = interaction.channel;
      const ticketKey = channel.id;

      // æ¸…é™¤è‡ªåŠ¨å…³é—­timer
      if (ticketTimers.has(ticketKey)) {
        clearTimeout(ticketTimers.get(ticketKey));
        ticketTimers.delete(ticketKey);
      }

      await interaction.reply({
        content: "ðŸ”’ å·¥å•å°†åœ¨ 5 ç§’åŽå…³é—­ã€‚æ„Ÿè°¢ä½ çš„é…åˆï½ž",
        ephemeral: true,
      });

      setTimeout(() => {
        channel.delete().catch(() => {});
      }, 5000);

      return;
    }

    // ---------------------------------------------------------
    // /recordï¼ˆæ‰‹åŠ¨æ›´æ–°/å‘é€ç»Ÿè®¡ embedï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "record"
    ) {
      const member =
        interaction.guild.members.cache.get(interaction.user.id) ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

      if (!member) {
        await interaction.reply({ content: "âŒ æ— æ³•éªŒè¯ä½ çš„æƒé™ã€‚", ephemeral: true });
        return;
      }

      const isAdmin =
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.has(config.adminRoleId);

      if (!isAdmin) {
        await interaction.reply({ content: "âŒ ä»…ç®¡ç†å‘˜å¯æ‰§è¡Œæ­¤å‘½ä»¤ã€‚", ephemeral: true });
        return;
      }

      try {
        await updateStatsSummaryEmbed(interaction.guild).catch(() => {});
        await interaction.reply({ content: "âœ… å·²æ›´æ–°/å‘é€æ´¾å•ç»Ÿè®¡ embedã€‚", ephemeral: true });
      } catch (err) {
        console.error("/record æ›´æ–°ç»Ÿè®¡å¤±è´¥:", err);
        await interaction.reply({ content: "âŒ æ›´æ–°ç»Ÿè®¡æ—¶å‡ºé”™ã€‚", ephemeral: true });
      }

      return;
    }

    // ---------------------------------------------------------
    // /dbï¼ˆæ•°æ®åº“ç®¡ç†ä¸­å¿ƒ - ç»¼åˆæŽ§åˆ¶é¢æ¿ï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "db"
    ) {
      const member =
        interaction.guild.members.cache.get(interaction.user.id) ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

      if (!member) {
        await interaction.reply({ content: "âŒ æ— æ³•éªŒè¯ä½ çš„æƒé™ã€‚", ephemeral: true });
        return;
      }

      const isAdmin =
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.has(config.adminRoleId);

      if (!isAdmin) {
        await interaction.reply({ content: "âŒ ä»…ç®¡ç†å‘˜å¯æ‰§è¡Œæ­¤å‘½ä»¤ã€‚", ephemeral: true });
        return;
      }

      try {
        const dbPanel = await buildDbPanelEmbed();
        await interaction.reply(dbPanel);
      } catch (err) {
        console.error("/db å‘½ä»¤é”™è¯¯:", err);
        await interaction.reply({
          content: "âŒ èŽ·å–æ•°æ®åº“ä¿¡æ¯å¤±è´¥ã€‚",
          ephemeral: true,
        });
      }

      return;
    }

    // ---------------------------------------------------------
    // /db æŒ‰é’®å¤„ç†å™¨ - db_info
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_info") {
      try {
        console.log("[db_info] å¼€å§‹å¤„ç†...");
        await interaction.deferReply({ ephemeral: true });

        const stats = await db.getStats();
        const allOrders = await db.getAllOrders();
        const fs = require("fs");
        const stat = fs.statSync("./data.db");
        console.log("[db_info] æ•°æ®èŽ·å–æˆåŠŸ");

        const embed = new EmbedBuilder()
          .setColor(0xff99cc)
          .setTitle("ðŸ“Š æ•°æ®åº“è¯¦ç»†ä¿¡æ¯")
          .setFields(
            {
              name: "ðŸ“ˆ ç»Ÿè®¡æ•°æ®",
              value: `\`\`\`\næ€»è®¢å•æ•°: ${stats.totalOrders || 0}\næ€»æ”¶å…¥: RM ${(stats.totalRevenue || 0).toFixed(2)}\nå¹³å‡å•ä»·: RM ${stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : "0.00"}\n\`\`\``,
              inline: false,
            },
            {
              name: "ðŸ’¾ æ•°æ®åº“çŠ¶æ€",
              value: `\`\`\`\nè®°å½•æ€»æ•°: ${allOrders.length}\næ•°æ®åº“å¤§å°: ${(stat.size / 1024).toFixed(2)} KB\næœ€åŽæ›´æ–°: ${stats.lastUpdated || "æœªçŸ¥"}\næ–‡ä»¶ä½ç½®: ./data.db\n\`\`\``,
              inline: false,
            }
          )
          .setFooter({ text: "åˆ·æ–°æ•°æ®: ç‚¹å‡»ä¸»èœå•çš„ ðŸ”„ æŒ‰é’®" });

        await interaction.editReply({ embeds: [embed] });
        console.log("[db_info] å®Œæˆ");
      } catch (err) {
        console.error("db_info é”™è¯¯:", err);
        try {
          await interaction.editReply({
            content: `âŒ èŽ·å–ä¿¡æ¯å¤±è´¥: ${err.message}`,
          });
        } catch (e) {
          console.error("db_info å›žå¤å¤±è´¥:", e);
        }
      }
      return;
    }

    // ---------------------------------------------------------
    // /db æŒ‰é’®å¤„ç†å™¨ - db_edit
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_edit") {
      try {
        console.log("[db_edit] å¼€å§‹å¤„ç†...");
        await interaction.deferReply({ ephemeral: true });

        const allOrders = await db.getAllOrders();
        console.log("[db_edit] èŽ·å–è®¢å•æ•°:", allOrders.length);

        if (allOrders.length === 0) {
          await interaction.editReply({
            content: "ðŸ“‹ ç›®å‰æ²¡æœ‰è®¢å•å¯ç¼–è¾‘ã€‚",
          });
          return;
        }

        // æ˜¾ç¤ºæœ€è¿‘çš„ 5 æ¡è®¢å•
        const recent = allOrders.slice(0, 5);
        let orderList = "```\nã€å¯ç¼–è¾‘çš„æœ€è¿‘è®¢å•ã€‘\n\n";

        recent.forEach((order, idx) => {
          orderList += `[${idx + 1}] ID:${order.id}\n    çŽ©å®¶: ${order.player || "æœªå¡«"}\n    é‡‘é¢: RM ${order.amount || 0}\n\n`;
        });

        orderList += "```";

        const embed = new EmbedBuilder()
          .setColor(0xff99cc)
          .setTitle("âœï¸ ç¼–è¾‘æ•°æ®")
          .setDescription(orderList)
          .addFields(
            {
              name: "ðŸ“ å¦‚ä½•ç¼–è¾‘",
              value: "â€¢ ä½¿ç”¨ `node db-edit.js` è¿›è¡Œè¯¦ç»†ç¼–è¾‘\nâ€¢ æˆ–åœ¨ Discord ä¸­è¦æ±‚ç®¡ç†å‘˜ååŠ©ç¼–è¾‘\nâ€¢ æ”¯æŒä¿®æ”¹: çŽ©å®¶åã€é‡‘é¢ã€è®¢å•ç±»åž‹ç­‰",
            }
          )
          .setFooter({ text: "éœ€è¦ä¿®æ”¹? è¯·å‘ŠçŸ¥ç›¸å…³äººå‘˜" });

        await interaction.editReply({ embeds: [embed] });
        console.log("[db_edit] å®Œæˆ");
      } catch (err) {
        console.error("db_edit é”™è¯¯:", err);
        try {
          await interaction.editReply({
            content: `âŒ èŽ·å–ç¼–è¾‘ä¿¡æ¯å¤±è´¥: ${err.message}`,
          });
        } catch (e) {
          console.error("db_edit å›žå¤å¤±è´¥:", e);
        }
      }
    }

    // ---------------------------------------------------------
    // /db æŒ‰é’®å¤„ç†å™¨ - db_manager
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_manager") {
      try {
        console.log("[db_manager] å¼€å§‹å¤„ç†...");
        await interaction.deferReply({ ephemeral: true });

        const allOrders = await db.getAllOrders();
        const stats = await db.getStats();
        console.log("[db_manager] æ•°æ®èŽ·å–æˆåŠŸ");

        const embed = new EmbedBuilder()
          .setColor(0xff99cc)
          .setTitle("âš™ï¸ æ•°æ®åº“ç®¡ç†")
          .setDescription("é€‰æ‹©ç®¡ç†é€‰é¡¹:")
          .addFields(
            {
              name: "ðŸ“Š çŽ°æœ‰è®¢å•",
              value: `\`\`\`\n${allOrders.length} æ¡è®¢å•è®°å½•\n${stats.totalOrders || 0} ä¸ªæœ‰æ•ˆè®¢å•\n\`\`\``,
            },
            {
              name: "ðŸ”§ å¯ç”¨æ“ä½œ",
              value: "â€¢ ä½¿ç”¨ `node db-manager.js` è¿›è¡Œå®Œæ•´ç®¡ç†\nâ€¢ æ”¯æŒ: æŸ¥çœ‹ã€æœç´¢ã€åˆ é™¤ã€å¯¼å‡º\nâ€¢ å»ºè®®: å®šæœŸå¤‡ä»½æ•°æ®åº“",
            }
          )
          .setFooter({ text: "æ›´å¤šæ“ä½œè¯·ä½¿ç”¨å‘½ä»¤è¡Œå·¥å…·" });

        await interaction.editReply({ embeds: [embed] });
        console.log("[db_manager] å®Œæˆ");
      } catch (err) {
        console.error("db_manager é”™è¯¯:", err);
        try {
          await interaction.editReply({
            content: `âŒ èŽ·å–ç®¡ç†ä¿¡æ¯å¤±è´¥: ${err.message}`,
          });
        } catch (e) {
          console.error("db_manager å›žå¤å¤±è´¥:", e);
        }
      }
    }

    // ---------------------------------------------------------
    // /db æŒ‰é’®å¤„ç†å™¨ - db_export_excel (çŽ°åœ¨å¯¼å‡ºCSVä»ŽSQLite)
    // ---------------------------------------------------------
    // /db æŒ‰é’®å¤„ç†å™¨ - db_export_excel - å·²æ”¹ä¸º export_excel
    // ---------------------------------------------------------
    // ã€å·²å¼ƒç”¨ã€‘æ­¤å¤„ç†å™¨å·²ç§»é™¤ï¼Œå¯¼å‡ºæ”¹ä¸ºä½¿ç”¨ export_excel

    // ---------------------------------------------------------
    // /db æŒ‰é’®å¤„ç†å™¨ - db_export_json
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_export_json") {
      try {
        console.log("[db_export_json] å¼€å§‹å¤„ç†...");
        await interaction.deferReply({ ephemeral: true });

        const allOrders = await db.getAllOrders();
        console.log("[db_export_json] èŽ·å–è®¢å•æ•°:", allOrders.length);

        if (allOrders.length === 0) {
          await interaction.editReply({
            content: "ðŸ“Š æš‚æ— æ•°æ®å¯å¯¼å‡ºï½ž",
          });
          return;
        }

        // ã€æ”¹è¿›ã€‘ä½¿ç”¨ exporter æ¨¡å—å¤„ç†å¯¼å‡º
        const filePath = exporter.exportToJSON(allOrders);
        const attachment = new AttachmentBuilder(filePath);
        await interaction.editReply({
          content: `âœ… å·²å¯¼å‡º ${allOrders.length} æ¡è®¢å•è®°å½•`,
          files: [attachment],
        });
        console.log("[db_export_json] å®Œæˆ");

        // è‡ªåŠ¨åˆ é™¤ä¸´æ—¶æ–‡ä»¶
        exporter.deleteFileAsync(filePath, 2000);
      } catch (err) {
        console.error("db_export_json é”™è¯¯:", err);
        try {
          await interaction.editReply({
            content: `âŒ å¯¼å‡º JSON å¤±è´¥: ${err.message}`,
          });
        } catch (e) {
          console.error("db_export_json å›žå¤å¤±è´¥:", e);
        }
      }
    }

    // ---------------------------------------------------------
    // /db æŒ‰é’®å¤„ç†å™¨ - db_refresh
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "db_refresh") {
      try {
        console.log("[db_refresh] å¼€å§‹å¤„ç†...");
        
        // é‡æ–°èŽ·å–æ•°æ®åº“ç»Ÿè®¡ä¿¡æ¯
        const stats = await db.getStats();
        const allOrders = await db.getAllOrders();
        console.log("[db_refresh] æ•°æ®èŽ·å–æˆåŠŸ");

        const newEmbed = new EmbedBuilder()
          .setColor(0xff99cc)
          .setTitle("ðŸ“Š æ•°æ®åº“ç®¡ç†ä¸­å¿ƒ")
          .setDescription("é€‰æ‹©ä¸‹æ–¹åŠŸèƒ½æŒ‰é’®è¿›è¡Œç›¸åº”æ“ä½œï½ž")
          .setFields(
            {
              name: "ðŸ“ˆ æ•°æ®åº“ç»Ÿè®¡",
              value: `\`\`\`\næ€»è®¢å•æ•°: ${stats.totalOrders || 0}\næ€»æ”¶å…¥: RM ${(stats.totalRevenue || 0).toFixed(2)}\nè®°å½•æ€»æ•°: ${allOrders.length}\næœ€åŽæ›´æ–°: ${stats.lastUpdated || "æœªçŸ¥"}\n\`\`\``,
              inline: false,
            }
          )
          .setFooter({ text: "âœ… å·²åˆ·æ–°æ•°æ® | ðŸ’¡ æç¤º: ç‚¹å‡»ä¸‹æ–¹æŒ‰é’®é€‰æ‹©åŠŸèƒ½" });

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("db_info")
            .setLabel("ðŸ“Š æ•°æ®åº“ä¿¡æ¯")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("ðŸ“Š"),

          new ButtonBuilder()
            .setCustomId("db_edit")
            .setLabel("âœï¸ ç¼–è¾‘æ•°æ®")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("âœï¸"),

          new ButtonBuilder()
            .setCustomId("db_manager")
            .setLabel("âš™ï¸ æ•°æ®ç®¡ç†")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("âš™ï¸")
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("export_excel")
            .setLabel("ðŸ“¥ å¯¼å‡º Excel")
            .setStyle(ButtonStyle.Success)
            .setEmoji("ðŸ“¥"),

          new ButtonBuilder()
            .setCustomId("db_export_json")
            .setLabel("ðŸ’¾ å¯¼å‡º JSON")
            .setStyle(ButtonStyle.Success)
            .setEmoji("ðŸ’¾"),

          new ButtonBuilder()
            .setCustomId("db_refresh")
            .setLabel("ðŸ”„ åˆ·æ–°æ•°æ®")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("ðŸ”„")
        );

        await interaction.update({
          embeds: [newEmbed],
          components: [row1, row2],
        });
        console.log("[db_refresh] å®Œæˆ");
      } catch (err) {
        console.error("db_refresh é”™è¯¯:", err);
        try {
          await interaction.reply({
            content: `âŒ åˆ·æ–°å¤±è´¥: ${err.message}`,
            ephemeral: true,
          });
        } catch (e) {
          console.error("db_refresh å›žå¤å¤±è´¥:", e);
        }
      }
    }

    // ---------------------------------------------------------
    // /statssetupï¼ˆå‘é€ç»Ÿè®¡æŒ‰é’®é¢æ¿ï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "statssetup"
    ) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ“Š æ´¾å–®çµ±è¨ˆä¸­å¿ƒ")
        .setDescription(`${sep()}\nç‚¹å‡»ä¸‹æ–¹æŒ‰é’®å¯æŸ¥çœ‹æˆ–é‡ç½®æ´¾å•ç»Ÿè®¡ï½ž\n${sep()}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("view_stats")
          .setLabel("ðŸ“ˆ æŸ¥çœ‹ç»Ÿè®¡")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("reset_stats")
          .setLabel("ðŸ” é‡ç½®ç»Ÿè®¡")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });

      return;
    }

    // =============================================================
    // ç»Ÿè®¡ç³»ç»Ÿï¼ˆæŸ¥çœ‹ / é‡ç½® / è‡ªåŠ¨æ›´æ–°ï¼‰
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

      //æŸ¥æ‰¾æ˜¯å¦å·²æœ‰è‡ªåŠ¨ç»Ÿè®¡ embed
      const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
      const existing = messages?.find(
        (m) =>
          m.author.id === client.user.id &&
          m.embeds?.[0]?.title === "ðŸ“Š æ–°æ´¾å•ç»Ÿè®¡ï¼ˆè‡ªåŠ¨æ›´æ–°ï¼‰"
      );

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ“Š æ–°æ´¾å•ç»Ÿè®¡ï¼ˆè‡ªåŠ¨æ›´æ–°ï¼‰")
        .setDescription(`${sep()}\nä»¥ä¸‹ä¸ºæ¸©æŸ”ç»Ÿè®¡æ€»è§ˆï½ž\n${sep()}`)
        .addFields(
          { name: "æ´¾å•æ€»æ•°", value: `${stats.totalOrders}`, inline: true },
          {
            name: "è®¢å•æ€»é‡‘é¢",
            value: `RM ${Number(stats.totalRevenue || 0).toFixed(2)}`,
            inline: true,
          },
          {
            name: "æœ€åŽæ›´æ–°æ—¶é—´",
            value: `${
              stats.lastUpdated
                ? new Date(stats.lastUpdated).toLocaleString()
                : "æ— "
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

    // æŸ¥çœ‹ç»Ÿè®¡ï¼ˆæŒ‰é’®ï¼‰
    if (interaction.isButton() && interaction.customId === "view_stats") {
      const stats = await readStats();
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ“ˆ æ–°æ´¾å•ç»Ÿè®¡ï¼ˆå³æ—¶ï¼‰")
        .setDescription(`${sep()}\nè¿™æ˜¯å½“å‰çš„ç»Ÿè®¡æ•°æ®ï¼Œæ„Ÿè°¢ä½ ä¸€ç›´çš„æ”¯æŒï½ž\n${sep()}`)
        .addFields(
          { name: "æ´¾å•æ€»æ•°", value: `${stats.totalOrders}`, inline: true },
          {
            name: "è®¢å•æ€»é‡‘é¢",
            value: `RM ${Number(stats.totalRevenue || 0).toFixed(2)}`,
            inline: true,
          },
          {
            name: "æœ€åŽæ›´æ–°æ—¶é—´",
            value: `${
              stats.lastUpdated
                ? new Date(stats.lastUpdated).toLocaleString()
                : "æ— "
            }`,
            inline: false,
          }
        )
        .setTimestamp();

      // ðŸ“± è‡ªåŠ¨å‘é€æŠ¥è¡¨åˆ° Telegramï¼ˆä»…ç¬¬ä¸€ä¸ªç¾¤ï¼‰
      const telegramStatsMsg = `<b>ðŸ“Š æ´¾å•ç»Ÿè®¡æŠ¥è¡¨</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
<b>ðŸ“ˆ æ´¾å•æ€»æ•°:</b> ${stats.totalOrders}
<b>ðŸ’° è®¢å•æ€»é‡‘é¢:</b> RM ${Number(stats.totalRevenue || 0).toFixed(2)}
<b>â° æœ€åŽæ›´æ–°æ—¶é—´:</b> ${
        stats.lastUpdated
          ? new Date(stats.lastUpdated).toLocaleString("zh-CN")
          : "æ— "
      }
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ”” æŠ¥è¡¨å·²åœ¨ Discord æŸ¥çœ‹`;
      // å¼‚æ­¥å‘é€Telegramï¼Œä¸é˜»å¡žDiscordå“åº”
      sendTelegramReport(config.telegramChatId, telegramStatsMsg, config.telegramMessageThreadId).catch(() => {});

      await updateStatsSummaryEmbed(interaction.guild).catch(() => {});
      await interaction.reply({ embeds: [embed], flags: 64 }).catch(() => {
        console.log("view_stats replyå¤±è´¥ï¼Œä½†æ•°æ®å·²å¤„ç†");
      });
      return;
    }

    // é‡ç½®ç»Ÿè®¡ï¼ˆç®¡ç†å‘˜ï¼‰
    if (interaction.isButton() && interaction.customId === "reset_stats") {
      const member =
        interaction.guild.members.cache.get(interaction.user.id) ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

      if (!member) {
        await interaction.reply({ content: "âŒ æ— æ³•éªŒè¯ä½ çš„æƒé™ã€‚è¯·ç¨åŽé‡è¯•æˆ–è”ç³»ç®¡ç†å‘˜ï½ž", ephemeral: true });
        return;
      }

      const isAdmin =
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.has(config.adminRoleId);

      if (!isAdmin) {
        await interaction.reply({ content: "âŒ ä»…ç®¡ç†å‘˜å¯ä»¥é‡ç½®ç»Ÿè®¡ã€‚è‹¥ä½ è®¤ä¸ºè¿™æ˜¯è¯¯åˆ¤è¯·è”ç³»ç®¡ç†å‘˜ï½ž", ephemeral: true });
        return;
      }

      resetStatsCounts();
      await updateStatsSummaryEmbed(interaction.guild).catch(() => {});

      await interaction.reply({
        content: "ðŸ” ç»Ÿè®¡å·²é‡ç½®ï¼totalOrders ä¸Ž totalRevenue å·²è®¾ä¸º 0ï¼Œæ¸©æŸ”åœ°å¼€å§‹æ–°çš„ç»Ÿè®¡ï½ž",
        ephemeral: true,
      });

      return;
    }

    // ====================== é™ªçŽ©/æ´¾å•/ç»Ÿè®¡ ç³»ç»Ÿç»“æŸ ======================
    // ---------------------------------------------------------
    // /supportsetupï¼ˆå»ºç«‹å®¢æœæŒ‰é’®ï¼‰
    // ---------------------------------------------------------
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "supportsetup"
    ) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("ðŸ’¬ å®¢æœä¸­å¿ƒ")
        .setThumbnail("https://cdn.discordapp.com/attachments/1433987480524165213/1440965790764503060/Generated_Image_November_20_2025_-_1_44PM.png?ex=69201378&is=691ec1f8&hm=b557cca8284e29b7c5610a868db7d6ae31610c0c4fd8d8e717bad59cbc0c839b&")
        .setDescription(`${sep()}\néœ€è¦å¸®åŠ©ï¼Ÿç‚¹å‡»ä¸‹æ–¹æŒ‰é’®è”ç³»å·¥ä½œäººå‘˜ã€‚\n${sep()}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_support")
          .setLabel("ðŸ’¬ è”ç³»å®¢æœ")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ---------------------------------------------------------
    // æ‰“å¼€å®¢æœè¡¨å• Modal
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "open_support") {
      const modal = new ModalBuilder()
        .setCustomId("supportForm")
        .setTitle("ðŸ’¬ å®¢æœè¡¨å•");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("type")
            .setLabel("ðŸ§© é—®é¢˜ç±»åž‹")
            .setPlaceholder("ä¾‹å¦‚ï¼šè®¢å•é—®é¢˜ / æŠ€æœ¯é—®é¢˜ / æŠ•è¯‰")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("description")
            .setLabel("ðŸ“ é—®é¢˜æè¿°")
            .setPlaceholder("è¯·å°½é‡è¯¦ç»†æè¿°ä½ çš„é—®é¢˜")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------------------------------------------------------
    // æäº¤å®¢æœè¡¨å• â†’ åˆ›å»ºå®¢æœé¢‘é“
    // ---------------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId === "supportForm") {
      const guild = interaction.guild;
      const user = interaction.user;

      const type = interaction.fields.getTextInputValue("type");
      const desc = interaction.fields.getTextInputValue("description");

      const channelName = `support-${sanitizeName(user.username)}`;

      // é¿å…é‡å¤å¼€å®¢æœ
      const existing = guild.channels.cache.find((c) => c.name === channelName);
      if (existing) {
        await interaction.reply({
          content: "â— ä½ å·²æœ‰ä¸€ä¸ªå®¢æœé¢‘é“ã€‚è¯·åœ¨åŽŸé¢‘é“ç»§ç»­æ²Ÿé€šï½ž",
          ephemeral: true,
        });
        return;
      }

      // å†™å…¥ support_logs.json
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
        console.error("å†™å…¥æ”¯æŒè®°å½•å¤±è´¥:", err);
      }

      // åˆ›å»ºå®¢æœé¢‘é“
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
        .setTitle("ðŸ’¬ å®¢æœé—®é¢˜è¯¦æƒ…")
        .setDescription(`${sep()}\næˆ‘ä»¬å·²æ”¶åˆ°ä½ çš„é—®é¢˜ï¼Œå·¥ä½œäººå‘˜ä¼šå¾ˆå¿«è”ç³»ä½ ï½ž\n${sep()}`)
        .addFields(
          { name: "ðŸ§© ç±»åž‹", value: type, inline: true },
          { name: "ðŸ“ æè¿°", value: desc, inline: false }
        )
        .setFooter({ text: `æ¥è‡ªç”¨æˆ·ï¼š${user.tag}` })
        .setTimestamp();

      const closeBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_support")
          .setLabel("ðŸ“ž å…³é—­å®¢æœ")
          .setStyle(ButtonStyle.Danger)
      );

      await supportChannel.send({
        content: `ðŸ’¬ ${user} çš„å®¢æœé¢‘é“å·²å»ºç«‹ï¼Œå·¥ä½œäººå‘˜ä¼šå°½å¿«å¤„ç†ï½ž`,
        embeds: [embed],
        components: [closeBtn],
      });

      await interaction.reply({
        content: `âœ… å®¢æœé¢‘é“å·²åˆ›å»ºï¼š${supportChannel}`,
        ephemeral: true,
      });

      return;
    }

    // ---------------------------------------------------------
    // å…³é—­å®¢æœé¢‘é“
    // ---------------------------------------------------------
    if (interaction.isButton() && interaction.customId === "close_support") {
      const channel = interaction.channel;

      await interaction.reply({
        content: "ðŸ“ž æ­¤å®¢æœé¢‘é“å°†åœ¨ 5 ç§’åŽå…³é—­ã€‚æ„Ÿè°¢ä½ çš„é…åˆï½ž",
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
          content: "âŒ å¤„ç†è¯·æ±‚æ—¶å‘ç”Ÿé”™è¯¯ï¼Œè¯·è”ç³»ç®¡ç†å‘˜ã€‚",
          ephemeral: true,
        });
      }
    } catch {}
  }
});

// =============================================================
// æ¬¢è¿Žç³»ç»Ÿï¼ˆç²‰è‰²å¯çˆ±é£Žï¼‰
// ---------------- Welcome & keyword replies ----------------
client.on("guildMemberAdd", async (member) => {
  try {
    const channel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (!channel) return;

    // Banner å›¾ç‰‡ï¼ˆä¸Šä¼ åˆ° Discord åŽå¤åˆ¶å›¾ç‰‡é“¾æŽ¥ï¼‰
    const bannerUrl = "https://cdn.discordapp.com/attachments/1433987480524165213/1436675976376483840/2567ced4-39ff-4b37-b055-31839c369199_1.png?ex=69107844&is=690f26c4&hm=8b29dfdfb09bf715c2bdbf3b895a070b7fdf356a6476b52cbe40b157251aa90b&"; // â† æ›¿æ¢ä¸ºä½ çš„Bannerå›¾

    // 1ï¸âƒ£ å‘é€åƒç´ é£Žã€Œæ¬¢è¿Žè´µå®¢å…‰ä¸´ã€Banner
    const bannerEmbed = new EmbedBuilder()
      .setColor(0xffc800)
      .setTitle("ðŸ‘‘ æ¬¢è¿Žè´µå®¢å…‰ä¸´ ðŸ‘‘")
      .setImage(bannerUrl)
      .setFooter({ text: "åŽå®«ä½³ä¸½ Â· é™ªçŽ©ä¿±ä¹éƒ¨" });

    // 2ï¸âƒ£ åŽŸæœ¬çš„æ¬¢è¿Žä¿¡æ¯
    const infoEmbed = new EmbedBuilder()
      .setColor(0xff8cff)
      .setTitle(`ðŸŒ¸ æ¬¢è¿ŽåŠ å…¥ï¼Œ${member.user.username}ï¼ðŸ’«`)
      .setDescription(
        `å—¨å—¨ ${member} ðŸ’•
æ¬¢è¿Žæ¥åˆ° **${member.guild.name}** ï½žï¼

âœ¨ åœ¨è¿™é‡Œä½ å¯ä»¥ï¼š
ðŸ“œ ä¿¡æ¯åŒºï¼š<#1433927932765540473>
ðŸŽ® ç‚¹å•åŒºï¼š<#1433718201690357802>
ðŸ’¬ å®¢æœä¼ é€é—¨ï¼š<#1434458460824801282>
âœ¨ æ”¾è½»æ¾ï¼Œè¿™é‡Œä¸åªæ˜¯ç¾¤ï½ž
ðŸ’ž è¿™é‡Œæ˜¯ä¸€ä¸ªèƒ½è®©ä½ ç¬‘å‡ºæ¥çš„å°ä¸–ç•Œ ðŸ’«

> ðŸ‘‘ æ¬¢è¿Žæ¥åˆ° Â· **ä½ çš„åŽå®«ä½³ä¸½**
> æ„¿ä½ åœ¨è¿™é‡Œæ”¶èŽ·é™ªä¼´ä¸Žå¿«ä¹ â¤ï¸`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "é™ªçŽ©åŽå®« âœ¨ è®©æ¸¸æˆæ›´æœ‰è¶£" })
      .setTimestamp();

    // è¿žç»­å‘é€ä¸¤æ¡ Embed
    await channel.send({ embeds: [bannerEmbed] });
    await channel.send({ content: `ðŸŽ‰ ${member} æ¬¢è¿Žæ¥åˆ° **${member.guild.name}**ï¼ðŸ’ž`, embeds: [infoEmbed] });

  } catch (err) {
    console.error("welcome message error:", err);
  }
});

// =============================================================
// âŒ æœ¬ç‰ˆæœ¬ v4.2c-Pink å·²ç§»é™¤å…³é”®è¯è‡ªåŠ¨å›žå¤ï¼ˆmessageCreateï¼‰
// =============================================================

// =============================================================
// MESSAGE LISTENER - ç›‘å¬ç‰¹å®šé¢‘é“çš„æ¶ˆæ¯å¹¶è½¬å‘åˆ° Telegram
// =============================================================
client.on("messageCreate", async (message) => {
  // å¿½ç•¥æœºå™¨äººæ¶ˆæ¯
  if (message.author.bot) return;
  
  // åªç›‘å¬æŠ¥å¤‡é¢‘é“çš„æ¶ˆæ¯
  if (message.channel.id !== REPORT_CHANNEL_ID) return;

  try {
    const orderNumber = `PO-${Date.now()}`; // ç”Ÿæˆè®¢å•å·
    
    // ä»Žæ¶ˆæ¯å†…å®¹ä¸­æå–é™ªé™ªåå­—å’Œé‡‘é¢ï¼ˆå‡è®¾æ ¼å¼ä¸­åŒ…å«è¿™äº›ä¿¡æ¯ï¼‰
    // å¯ä»¥æ ¹æ®ä½ çš„å®žé™…æ¶ˆæ¯æ ¼å¼è¿›è¡Œè°ƒæ•´
    const contentLines = message.content.split('\n');
    let playerName = "æœªå¡«å†™";
    let amount = "æœªå¡«å†™";
    
    // ç®€å•çš„æå–é€»è¾‘ - å¯ä»¥æ ¹æ®å®žé™…éœ€æ±‚ä¿®æ”¹
    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i];
      if (line.includes("é™ªé™ª") || line.includes("é™ªçŽ©")) {
        playerName = line.replace(/é™ªé™ª|é™ªçŽ©|ï¼š|:/g, "").trim();
      }
      if (line.includes("é‡‘é¢") || line.includes("ä»·æ ¼") || line.includes("RM")) {
        amount = line.replace(/é‡‘é¢|ä»·æ ¼|ï¼š|:|RM/g, "").trim();
      }
    }

    const professionalTemplate = `ðŸ“ <b>æŠ¥å¤‡å•å·²æ”¶åˆ°</b>

ðŸ“Œ <b>å•å·:</b> #${orderNumber}
ðŸ‘¤ <b>å®¢æˆ·:</b> ${message.author.username}
ðŸ§šâ€â™€ï¸ <b>é™ªé™ª:</b> ${playerName}
ðŸ’° <b>é‡‘é¢:</b> ${amount}
ðŸ’¬ <b>å†…å®¹:</b>
${message.content}

â° <b>æ—¶é—´:</b> ${new Date().toLocaleString("zh-CN")}`;

    // å‘é€åˆ° Telegram
    await axios.post(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
      chat_id: config.telegramChatId,
      text: professionalTemplate,
      parse_mode: "HTML"
    });

    console.log("âœ… æŠ¥å¤‡å·²å‘é€åˆ° Telegram");
  } catch (err) {
    console.error("âŒ Telegram å‘é€é”™è¯¯:", err.response?.data || err.message);
  }
});

client.login(config.token);


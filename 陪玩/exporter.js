// =============================================================
// exporter.js - 统一的数据导出模块（生产级）
// 唯一的数据→文件导出入口，支持 Excel / JSON / Telegram
// =============================================================

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const FormData = require('form-data');
const axios = require('axios');

// 确保 tmp 目录存在
function ensureTmpDir() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

/**
 * 标准化导出数据 - 将 orders 映射为中文列名（按模板格式）
 * @param {Array} orders - 原始订单数组
 * @param {Map} bossMap - 报备记录的 orderNo->boss 映射（用于派单记录获取老板信息）
 * @returns {Array} 中文字段的订单数组
 */
function normalizeOrdersForExport(orders, bossMap = null) {
  if (!Array.isArray(orders) || orders.length === 0) return [];
  
  return orders.map((order, idx) => ({
    '序号': idx + 1,
    '单号': order.orderNo || '',
    '派单员': order.assigner || '',
    '陪玩员': order.player || '',
    '游戏': order.game || '',
    '时长': order.duration || '',
    '价格': order.price || 0,
    '派单时间': order.date || '',
  }));
}

/**
 * 标准化报备记录数据 - 将报备数据映射为中文列名（按模板格式）
 * 报备记录字段顺序：序号、类型、报备类型、老板、陪陪、单子类型、时长、金额、单号、报备时间
 * @param {Array} reports - 原始报备记录数组
 * @returns {Array} 中文字段的报备记录数组
 */
function normalizeReportsForExport(reports) {
  if (!Array.isArray(reports) || reports.length === 0) return [];
  
  return reports.map((report, idx) => {
    // 根据 source 判断报备类型
    let reportType = '新单';
    if (report.source === 'renewReportForm') {
      reportType = '续单';
    } else if (report.source === 'giftReportForm') {
      reportType = '礼物';
    } else if (report.source === 'reportForm') {
      reportType = '新单';
    } else {
      // 如果没有 source 字段，默认为新单
      reportType = '新单';
    }
    
    console.log(`[导出报备] ID:${report.id} source:${report.source} -> 报备类型:${reportType}`);
    
    return {
      '序号': idx + 1,
      '类型': '单子报备',
      '报备类型': reportType,
      '老板': report.boss || '',
      '陪陪': report.player || '',
      '单子类型': report.orderType || '',
      '时长': report.duration || '',
      '金额': report.amount || 0,
      '单号': report.orderNo || '未填写',
      '报备时间': report.date || '',
    };
  });
}

/**
 * 导出订单为 Excel 文件
 * @param {Array} orders - 订单数组
 * @param {string} filename - 输出文件名（不含路径）
 * @returns {string} 完整文件路径
 */
function exportToExcel(orders, filename = null) {
  try {
    if (!Array.isArray(orders) || orders.length === 0) {
      throw new Error('订单数据为空');
    }

    const tmpDir = ensureTmpDir();
    const fname = filename || `订单数据_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(tmpDir, fname);

    // 标准化数据
    const exportData = normalizeOrdersForExport(orders);

    // 创建 Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, '订单记录');
    XLSX.writeFile(workbook, filePath);

    console.log(`✅ Excel 已导出: ${path.basename(filePath)}`);
    return filePath;
  } catch (err) {
    console.error('❌ Excel 导出失败:', err.message);
    throw err;
  }
}

/**
 * 导出订单和报备为 Excel 文件（多个sheet）
 * @param {Array} orders - 订单数组（包含 type='report' 和其他类型）
 * @param {string} filename - 输出文件名（不含路径）
 * @returns {string} 完整文件路径
 */
function exportToExcelMultiSheet(orders, filename = null) {
  try {
    const tmpDir = ensureTmpDir();
    const fname = filename || `单子统计_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(tmpDir, fname);

    // 创建 Excel workbook
    const workbook = XLSX.utils.book_new();

    // 从 orders 中分离报备记录和派单记录
    const reportRecords = Array.isArray(orders) ? orders.filter(o => o.type === 'report') : [];
    const dispatchRecords = Array.isArray(orders) ? orders.filter(o => o.type !== 'report') : [];

    // Sheet 1: 报备记录
    if (reportRecords.length > 0) {
      const reportData = normalizeReportsForExport(reportRecords);
      const reportSheet = XLSX.utils.json_to_sheet(reportData);
      // 设置列宽
      reportSheet['!cols'] = [
        { wch: 8 },  // 序号
        { wch: 12 }, // 类型
        { wch: 10 }, // 报备类型
        { wch: 15 }, // 老板
        { wch: 12 }, // 陪陪
        { wch: 15 }, // 单子类型
        { wch: 20 }, // 时长
        { wch: 8 },  // 金额
        { wch: 18 }, // 单号
        { wch: 20 }, // 报备时间
      ];
      XLSX.utils.book_append_sheet(workbook, reportSheet, '报备记录');
    } else {
      // 如果没有报备记录，创建空sheet
      const emptySheet = XLSX.utils.json_to_sheet([]);
      XLSX.utils.book_append_sheet(workbook, emptySheet, '报备记录');
    }

    // Sheet 2: 派单记录
    if (dispatchRecords.length > 0) {
      const orderData = normalizeOrdersForExport(dispatchRecords);
      const orderSheet = XLSX.utils.json_to_sheet(orderData);
      // 设置列宽
      orderSheet['!cols'] = [
        { wch: 8 },  // 序号
        { wch: 18 }, // 单号
        { wch: 12 }, // 派单员
        { wch: 12 }, // 陪玩员
        { wch: 15 }, // 游戏
        { wch: 20 }, // 时长
        { wch: 8 },  // 价格
        { wch: 20 }, // 派单时间
      ];
      XLSX.utils.book_append_sheet(workbook, orderSheet, '派单记录');
    } else {
      // 如果没有派单记录，创建空sheet
      const emptySheet = XLSX.utils.json_to_sheet([]);
      XLSX.utils.book_append_sheet(workbook, emptySheet, '派单记录');
    }

    XLSX.writeFile(workbook, filePath);

    console.log(`✅ Excel 已导出（多sheet）: ${path.basename(filePath)}`);
    return filePath;
  } catch (err) {
    console.error('❌ Excel 导出失败:', err.message);
    throw err;
  }
}

/**
 * 导出订单为 JSON 文件
 * @param {Array} orders - 订单数组
 * @param {string} filename - 输出文件名（不含路径）
 * @returns {string} 完整文件路径
 */
function exportToJSON(orders, filename = null) {
  try {
    if (!Array.isArray(orders) || orders.length === 0) {
      throw new Error('订单数据为空');
    }

    const tmpDir = ensureTmpDir();
    const fname = filename || `订单数据_${new Date().toISOString().split('T')[0]}.json`;
    const filePath = path.join(tmpDir, fname);

    fs.writeFileSync(filePath, JSON.stringify(orders, null, 2), 'utf8');

    console.log(`✅ JSON 已导出: ${path.basename(filePath)}`);
    return filePath;
  } catch (err) {
    console.error('❌ JSON 导出失败:', err.message);
    throw err;
  }
}

/**
 * 导出 Excel 到 Telegram（供外部命令调用，如 /queryrecords）
 * @param {Array} orders - 订单数组
 * @param {Object} telegramConfig - Telegram 配置 { token, chatId, messageThreadId }
 * @param {string} caption - 发送的说明文字
 * @returns {Promise<void>}
 */
async function exportExcelToTelegram(orders, telegramConfig, caption = null) {
  try {
    if (!telegramConfig.token || !telegramConfig.chatId) {
      throw new Error('Telegram 配置不完整');
    }

    if (!Array.isArray(orders) || orders.length === 0) {
      throw new Error('订单数据为空');
    }

    // 生成 Excel 文件
    const fileName = `单子记录_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`;
    const filePath = exportToExcel(orders, fileName);

    // 发送到 Telegram
    const telegramUrl = `https://api.telegram.org/bot${telegramConfig.token}/sendDocument`;
    const formData = new FormData();
    
    formData.append('chat_id', telegramConfig.chatId);
    formData.append('document', fs.createReadStream(filePath));
    
    if (telegramConfig.messageThreadId) {
      formData.append('message_thread_id', telegramConfig.messageThreadId);
    }
    
    const defaultCaption = `📊 <b>单子记录数据</b>\n⏰ ${new Date().toLocaleString('zh-CN')}\n\n✅ 已导出至 Telegram`;
    formData.append('caption', caption || defaultCaption);
    formData.append('parse_mode', 'HTML');

    await axios.post(telegramUrl, formData, {
      headers: formData.getHeaders()
    });

    console.log(`✅ Excel 已发送至 Telegram`);

    // 延迟删除临时文件
    deleteFileAsync(filePath, 5000);
  } catch (err) {
    console.error('❌ Telegram 导出失败:', err.message);
    throw err;
  }
}

/**
 * 导出 Excel（包含报备和派单）到 Telegram
 * @param {Array} orders - 订单数组（包含 type='report' 和其他类型）
 * @param {Object} telegramConfig - Telegram 配置 { token, chatId, messageThreadId }
 * @param {string} caption - 发送的说明文字
 * @returns {Promise<void>}
 */
async function exportExcelMultiSheetToTelegram(orders, telegramConfig, caption = null) {
  try {
    if (!telegramConfig.token || !telegramConfig.chatId) {
      throw new Error('Telegram 配置不完整');
    }

    // 生成 Excel 文件（多sheet）
    const fileName = `单子统计_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`;
    const filePath = exportToExcelMultiSheet(orders, fileName);

    // 发送到 Telegram
    const telegramUrl = `https://api.telegram.org/bot${telegramConfig.token}/sendDocument`;
    const formData = new FormData();
    
    formData.append('chat_id', telegramConfig.chatId);
    formData.append('document', fs.createReadStream(filePath));
    
    if (telegramConfig.messageThreadId) {
      formData.append('message_thread_id', telegramConfig.messageThreadId);
    }
    
    const defaultCaption = `📊 <b>单子统计数据</b>\n⏰ ${new Date().toLocaleString('zh-CN')}\n报备记录 + 派单记录\n\n✅ 已导出至 Telegram`;
    formData.append('caption', caption || defaultCaption);
    formData.append('parse_mode', 'HTML');

    await axios.post(telegramUrl, formData, {
      headers: formData.getHeaders()
    });

    console.log(`✅ Excel（多sheet）已发送至 Telegram`);

    // 延迟删除临时文件
    deleteFileAsync(filePath, 5000);
  } catch (err) {
    console.error('❌ Telegram 导出失败:', err.message);
    throw err;
  }
}

/**
 * 自动删除临时文件
 * 【修复问题 9】添加文件存在性检查和错误捕获
 * @param {string} filePath - 要删除的文件路径
 * @param {number} delayMs - 延迟多少毫秒后删除（默认 2000）
 */
function deleteFileAsync(filePath, delayMs = 2000) {
  setTimeout(() => {
    try {
      if (!filePath) {
        console.warn(`⚠️ 文件路径为空`);
        return;
      }
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ 临时文件已删除: ${path.basename(filePath)}`);
      } else {
        console.warn(`⚠️ 文件不存在，跳过删除: ${path.basename(filePath)}`);
      }
    } catch (err) {
      console.error(`⚠️ 删除临时文件失败: ${err.message}`);
    }
  }, delayMs);
}

/**
 * 批量删除 tmp 目录下超过 N 小时的文件
 * @param {number} hoursOld - 删除多少小时以前的文件（默认 1）
 */
function cleanupOldFiles(hoursOld = 1) {
  try {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) return;

    const now = Date.now();
    const ageMs = hoursOld * 60 * 60 * 1000;

    fs.readdirSync(tmpDir).forEach((file) => {
      const filePath = path.join(tmpDir, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > ageMs) {
        fs.unlinkSync(filePath);
        console.log(`🧹 已清理过期文件: ${file}`);
      }
    });
  } catch (err) {
    console.error(`⚠️ 清理临时文件出错: ${err.message}`);
  }
}

module.exports = {
  exportToExcel,
  exportToExcelMultiSheet,
  exportToJSON,
  exportExcelToTelegram,
  exportExcelMultiSheetToTelegram,
  deleteFileAsync,
  cleanupOldFiles,
  ensureTmpDir,
  normalizeOrdersForExport,
  normalizeReportsForExport,
};

// =============================================================
// statistics.js - 数据统计和分析模块
// 用于数据管理中心的各种统计、排行、检查功能
// =============================================================

const fs = require('fs');
const path = require('path');
const db = require('./db'); // 【修改】添加数据库导入

/**
 * 从 SQLite 数据库读取所有数据（优先级更高）
 * 如果数据库初始化失败，则回退到 orders.json
 */
function loadOrdersData() {
  try {
    // 【修改】优先从SQLite数据库读取
    if (db.initialized) {
      const orders = db.getAllOrders();
      if (Array.isArray(orders) && orders.length > 0) {
        console.log(`✅ 从SQLite数据库加载 ${orders.length} 条订单数据`);
        return orders;
      }
    }
    
    // 回退到orders.json
    console.log('📖 从orders.json加载数据（SQLite数据库为空或未初始化）');
    const ordersPath = path.join(process.cwd(), 'orders.json');
    const ordersData = fs.readFileSync(ordersPath, 'utf8');
    return JSON.parse(ordersData) || [];
  } catch (err) {
    console.error('❌ 读取数据失败:', err.message);
    return [];
  }
}

/**
 * 按日期范围筛选数据
/**
 * 按日期范围筛选订单
 * @param {Array} orders - 订单数组
 * @param {string|Date} startDate - 开始日期 (YYYY/M/D HH:MM:SS 或 YYYY-MM-DD 或 Date对象)
 * @param {string|Date} endDate - 结束日期 (YYYY/M/D HH:MM:SS 或 YYYY-MM-DD 或 Date对象)
 * @returns {Array} 筛选后的订单
 */
function filterByDateRange(orders, startDate, endDate) {
  if (!startDate || !endDate) return orders;
  
  // 将字符串日期转换为Date对象
  let start, end;
  
  const parseDate = (dateStr) => {
    if (typeof dateStr !== 'string') return dateStr;
    
    // 格式1: "YYYY/M/D HH:MM:SS" (orders.json中的格式)
    if (dateStr.includes('/') && dateStr.includes(':')) {
      return new Date(dateStr);
    }
    
    // 格式2: "YYYY-MM-DD" (以前的格式)
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return new Date(year, parseInt(month) - 1, day, 0, 0, 0, 0);
    }
    
    // 默认使用原字符串转换
    return new Date(dateStr);
  };
  
  start = parseDate(startDate);
  end = parseDate(endDate);
  
  return orders.filter(order => {
    if (!order.date) return false;
    const orderDate = new Date(order.date);
    return orderDate >= start && orderDate <= end;
  });
}

/**
 * 计算数据统计摘要
 * @param {Array} orders - 订单数组（已筛选）
 * @returns {Object} 统计数据
 */
function calculateSummary(orders = null) {
  if (!orders) orders = loadOrdersData();
  
  const reports = orders.filter(o => o.type === 'report');
  const dispatches = orders.filter(o => o.type !== 'report');
  
  // 计算总金额
  const reportsTotalAmount = reports.reduce((sum, r) => sum + (r.amount || 0), 0);
  const dispatchesTotalPrice = dispatches.reduce((sum, d) => sum + (d.price || 0), 0);
  
  // 计算总时长（需要转换）
  const parseDuration = (durationStr) => {
    if (!durationStr) return 0;
    const match = durationStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };
  
  const reportsTotalHours = reports.reduce((sum, r) => sum + parseDuration(r.duration), 0);
  const dispatchesTotalHours = dispatches.reduce((sum, d) => sum + parseDuration(d.duration), 0);
  
  // 检查缺失单号的记录
  const reportsMissingOrderNo = reports.filter(r => !r.orderNo).length;
  const dispatchesMissingOrderNo = dispatches.filter(d => !d.orderNo).length;
  
  return {
    totalReports: reports.length,
    totalDispatches: dispatches.length,
    reportsTotalAmount,
    dispatchesTotalPrice,
    totalAmount: reportsTotalAmount + dispatchesTotalPrice,
    reportsTotalHours,
    dispatchesTotalHours,
    totalHours: reportsTotalHours + dispatchesTotalHours,
    reportsMissingOrderNo,
    dispatchesMissingOrderNo,
    totalMissingOrderNo: reportsMissingOrderNo + dispatchesMissingOrderNo,
  };
}

/**
 * 获取派单员排行
 * @param {Array} orders - 订单数组（已筛选）
 * @returns {Array} 派单员排行榜
 */
function getAssignerRanking(orders = null) {
  if (!orders) orders = loadOrdersData();
  
  const dispatches = orders.filter(o => o.type !== 'report' && o.assigner);
  const ranking = {};
  
  dispatches.forEach(d => {
    if (!ranking[d.assigner]) {
      ranking[d.assigner] = {
        name: d.assigner,
        count: 0,
        totalPrice: 0,
      };
    }
    ranking[d.assigner].count++;
    ranking[d.assigner].totalPrice += d.price || 0;
  });
  
  return Object.values(ranking)
    .sort((a, b) => b.totalPrice - a.totalPrice)
    .slice(0, 10);
}

/**
 * 获取陪玩员排行
 * @param {Array} orders - 订单数组（已筛选）
 * @returns {Array} 陪玩员排行榜
 */
function getPlayerRanking(orders = null) {
  if (!orders) orders = loadOrdersData();
  
  const ranking = {};
  
  orders.forEach(o => {
    if (!o.player) return;
    if (!ranking[o.player]) {
      ranking[o.player] = {
        name: o.player,
        reportCount: 0,
        dispatchCount: 0,
        totalAmount: 0,
        totalPrice: 0,
      };
    }
    
    if (o.type === 'report') {
      ranking[o.player].reportCount++;
      ranking[o.player].totalAmount += o.amount || 0;
    } else {
      ranking[o.player].dispatchCount++;
      ranking[o.player].totalPrice += o.price || 0;
    }
  });
  
  return Object.values(ranking)
    .map(p => ({
      ...p,
      total: p.totalAmount + p.totalPrice,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

/**
 * 获取老板排行
 * @param {Array} orders - 订单数组（已筛选）
 * @returns {Array} 老板排行榜
 */
function getBossRanking(orders = null) {
  if (!orders) orders = loadOrdersData();
  
  const reports = orders.filter(o => o.type === 'report' && o.boss);
  const ranking = {};
  
  reports.forEach(r => {
    if (!ranking[r.boss]) {
      ranking[r.boss] = {
        name: r.boss,
        count: 0,
        totalAmount: 0,
      };
    }
    ranking[r.boss].count++;
    ranking[r.boss].totalAmount += r.amount || 0;
  });
  
  return Object.values(ranking)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);
}

/**
 * 数据质量检查
 * @param {Array} orders - 订单数组（已筛选）
 * @returns {Object} 检查结果
 */
function performDataQualityCheck(orders = null) {
  if (!orders) orders = loadOrdersData();
  
  const issues = [];
  const warnings = [];
  
  // 检查报备记录缺失单号
  const reportsMissingNo = orders.filter(o => o.type === 'report' && !o.orderNo);
  if (reportsMissingNo.length > 0) {
    issues.push(`⚠️ ${reportsMissingNo.length} 条报备记录缺失单号`);
  }
  
  // 检查派单记录缺失单号
  const dispatchesMissingNo = orders.filter(o => o.type !== 'report' && !o.orderNo);
  if (dispatchesMissingNo.length > 0) {
    issues.push(`⚠️ ${dispatchesMissingNo.length} 条派单记录缺失单号`);
  }
  
  // 检查缺失陪玩员信息
  const missingPlayer = orders.filter(o => !o.player).length;
  if (missingPlayer > 0) {
    warnings.push(`📌 ${missingPlayer} 条记录缺失陪玩员信息`);
  }
  
  // 检查缺失时长
  const missingDuration = orders.filter(o => !o.duration).length;
  if (missingDuration > 0) {
    warnings.push(`📌 ${missingDuration} 条记录缺失时长信息`);
  }
  
  // 检查重复的单号
  const orderNos = orders.filter(o => o.orderNo).map(o => o.orderNo);
  const duplicates = orderNos.filter((no, idx) => orderNos.indexOf(no) !== idx);
  if (duplicates.length > 0) {
    issues.push(`⚠️ 发现 ${duplicates.length} 个重复的单号`);
  }
  
  return {
    hasIssues: issues.length > 0,
    issues,
    warnings,
    totalIssuesAndWarnings: issues.length + warnings.length,
  };
}

/**
 * 获取最近的数据（用于快速查看）
 * @param {Array} orders - 订单数组
 * @param {number} count - 获取数量（默认10）
 * @returns {Array} 最近的记录
 */
function getRecentOrders(orders = null, count = 10) {
  if (!orders) orders = loadOrdersData();
  
  return orders
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, count);
}

/**
 * 格式化统计数据为字符串（用于Embed显示）
 * @param {Object} summary - 统计摘要
 * @returns {string} 格式化字符串
 */
function formatSummary(summary) {
  let result = '';
  result += `📋 **报备记录:** ${summary.totalReports} 条\n`;
  result += `📦 **派单记录:** ${summary.totalDispatches} 条\n`;
  result += `💰 **总收入:** RM ${summary.totalAmount}\n`;
  result += `⏱️ **总时长:** ${summary.totalHours} 小时\n`;
  
  if (summary.totalMissingOrderNo > 0) {
    result += `⚠️ **缺失单号:** ${summary.totalMissingOrderNo} 条\n`;
  }
  
  return result;
}

module.exports = {
  loadOrdersData,
  filterByDateRange,
  calculateSummary,
  getAssignerRanking,
  getPlayerRanking,
  getBossRanking,
  performDataQualityCheck,
  getRecentOrders,
  formatSummary,
};

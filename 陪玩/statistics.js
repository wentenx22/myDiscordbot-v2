// =============================================================
// statistics.js - 数据统计和分析模块（仅负责格式化）
// 【架构改造】不再负责数据读取、缓存、质量检查
// 所有数据查询都在db.js中使用SQLite直接实现
// =============================================================

const fs = require('fs');
const path = require('path');
const db = require('./db');

/**
 * 【已弃用】loadOrdersData() - 移到 db.getAllOrders()
 * 保留此函数仅为了向后兼容
 */
function loadOrdersData() {
  console.warn('⚠️ statistics.loadOrdersData() 已弃用，请使用 db.getAllOrders() 代替');
  return db.getAllOrders();
}

/**
 * 按日期范围筛选订单（仅用于已加载的数据）
 * 【注意】应该在SQLite中使用WHERE查询而非此函数
 * @param {Array} orders - 订单数组
 * @param {string|Date} startDate - 开始日期
 * @param {string|Date} endDate - 结束日期
 * @returns {Array} 筛选后的订单
 */
function filterByDateRange(orders, startDate, endDate) {
  if (!startDate || !endDate) return orders;
  
  const parseDate = (dateStr) => {
    if (typeof dateStr !== 'string') return dateStr;
    if (dateStr.includes('/') && dateStr.includes(':')) {
      return new Date(dateStr);
    }
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return new Date(year, parseInt(month) - 1, day, 0, 0, 0, 0);
    }
    return new Date(dateStr);
  };
  
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  return orders.filter(order => {
    if (!order.date) return false;
    const orderDate = new Date(order.date);
    return orderDate >= start && orderDate <= end;
  });
}

/**
 * 计算数据统计摘要（仅对已加载的数据进行格式化计算）
 * 【注意】应该使用 db.getStatsSummary() 获取原始数据，再用此函数格式化
 * @param {Array} orders - 订单数组（已筛选）
 * @returns {Object} 统计数据
 */
function calculateSummary(orders = null) {
  if (!orders || !Array.isArray(orders)) orders = [];
  
  const reports = orders.filter(o => o.type === 'report');
  const dispatches = orders.filter(o => o.type !== 'report');
  
  const reportsTotalAmount = reports.reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0);
  const dispatchesTotalPrice = dispatches.reduce((sum, d) => sum + (parseInt(d.price) || 0), 0);
  
  const parseDuration = (durationStr) => {
    if (!durationStr) return 0;
    const match = String(durationStr).match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };
  
  const reportsTotalHours = reports.reduce((sum, r) => sum + parseDuration(r.duration), 0);
  const dispatchesTotalHours = dispatches.reduce((sum, d) => sum + parseDuration(d.duration), 0);
  
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
 * 【已弃用】getAssignerRanking() - 移到 db.getAssignerRankingFromDB()
 */
function getAssignerRanking(orders = null) {
  if (!orders || !Array.isArray(orders)) orders = [];
  
  const dispatches = orders.filter(o => o.type !== 'report' && o.assigner);
  const ranking = {};
  
  dispatches.forEach(d => {
    if (!ranking[d.assigner]) {
      ranking[d.assigner] = { name: d.assigner, count: 0, totalPrice: 0 };
    }
    ranking[d.assigner].count++;
    ranking[d.assigner].totalPrice += parseInt(d.price) || 0;
  });
  
  return Object.values(ranking)
    .sort((a, b) => b.totalPrice - a.totalPrice)
    .slice(0, 10);
}

/**
 * 【已弃用】getPlayerRanking() - 移到 db.getPlayerRankingFromDB()
 */
function getPlayerRanking(orders = null) {
  if (!orders || !Array.isArray(orders)) orders = [];
  
  const ranking = {};
  
  orders.forEach(o => {
    if (!o.player) return;
    if (!ranking[o.player]) {
      ranking[o.player] = { name: o.player, reportCount: 0, dispatchCount: 0, totalAmount: 0, totalPrice: 0 };
    }
    
    if (o.type === 'report') {
      ranking[o.player].reportCount++;
      ranking[o.player].totalAmount += parseInt(o.amount) || 0;
    } else {
      ranking[o.player].dispatchCount++;
      ranking[o.player].totalPrice += parseInt(o.price) || 0;
    }
  });
  
  return Object.values(ranking)
    .map(p => ({ ...p, total: p.totalAmount + p.totalPrice }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

/**
 * 【已弃用】getBossRanking() - 移到 db.getBossRankingFromDB()
 */
function getBossRanking(orders = null) {
  if (!orders || !Array.isArray(orders)) orders = [];
  
  const reports = orders.filter(o => o.type === 'report' && o.boss);
  const ranking = {};
  
  reports.forEach(r => {
    if (!ranking[r.boss]) {
      ranking[r.boss] = { name: r.boss, count: 0, totalAmount: 0 };
    }
    ranking[r.boss].count++;
    ranking[r.boss].totalAmount += parseInt(r.amount) || 0;
  });
  
  return Object.values(ranking)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);
}

/**
 * 【已弃用】performDataQualityCheck() - 移到 db.performDataQualityCheck()
 */
function performDataQualityCheck(orders = null) {
  if (!orders || !Array.isArray(orders)) orders = [];
  
  const issues = [];
  const warnings = [];
  
  const reportsMissingNo = orders.filter(o => o.type === 'report' && !o.orderNo);
  if (reportsMissingNo.length > 0) {
    issues.push(`⚠️ ${reportsMissingNo.length} 条报备记录缺失单号`);
  }
  
  const dispatchesMissingNo = orders.filter(o => o.type !== 'report' && !o.orderNo);
  if (dispatchesMissingNo.length > 0) {
    issues.push(`⚠️ ${dispatchesMissingNo.length} 条派单记录缺失单号`);
  }
  
  const missingPlayer = orders.filter(o => !o.player).length;
  if (missingPlayer > 0) {
    warnings.push(`📌 ${missingPlayer} 条记录缺失陪玩员信息`);
  }
  
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
  if (!orders || !Array.isArray(orders)) orders = [];
  
  return orders
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, count);
}

/**
 * ✅ 【保留】格式化统计数据为字符串（用于Embed显示）
 * 这是statistics.js唯一的核心职责
 * @param {Object} summary - 统计摘要
 * @returns {string} 格式化字符串
 */
function formatSummary(summary) {
  let result = '';
  result += `📋 **报备记录:** ${summary.totalReports || 0} 条\n`;
  result += `📦 **派单记录:** ${summary.totalDispatches || 0} 条\n`;
  result += `💰 **总收入:** RM ${summary.totalAmount || 0}\n`;
  result += `⏱️ **总时长:** ${summary.totalHours || 0} 小时\n`;
  
  if (summary.totalMissingOrderNo > 0) {
    result += `⚠️ **缺失单号:** ${summary.totalMissingOrderNo} 条\n`;
  }
  
  return result;
}

module.exports = {
  loadOrdersData,        // 已弃用
  filterByDateRange,     // 仅用于JS数组过滤
  calculateSummary,      // 仅用于格式化计算
  getAssignerRanking,    // 已弃用
  getPlayerRanking,      // 已弃用
  getBossRanking,        // 已弃用
  performDataQualityCheck, // 已弃用
  getRecentOrders,
  formatSummary,         // ✅ 核心函数
};

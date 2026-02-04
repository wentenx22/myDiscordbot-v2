// =============================================================
// sqlite-exporter.js - SQLite CLI CSV 导出模块
// 使用sqlite3命令行导出CSV，避免依赖Excel库
// =============================================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');
const TMP_DIR = path.join(__dirname, 'tmp');

// 确保tmp目录存在
function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
  return TMP_DIR;
}

/**
 * 使用sqlite3 CLI导出CSV文件
 * @param {string} filename - 输出文件名
 * @returns {string} 完整文件路径
 */
function exportToCSV(filename = null) {
  try {
    ensureTmpDir();
    
    const fname = filename || `订单数据_${new Date().toISOString().split('T')[0]}.csv`;
    const filePath = path.join(TMP_DIR, fname);
    
    console.log(`📊 开始导出CSV...\n`);
    console.log(`  数据库: ${DB_PATH}`);
    console.log(`  输出: ${filePath}\n`);
    
    // 使用sqlite3 CLI导出CSV
    const sql = `
.mode csv
.headers on
.output "${filePath}"
SELECT id, type, boss, player, assigner, orderType, game, duration, amount, price, date, source, orderNo, customer, source_channel FROM orders ORDER BY id DESC;
.output stdout
`;
    
    // 执行sqlite3命令
    const cmd = `sqlite3 "${DB_PATH}" "${sql}"`;
    execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    
    // 验证文件是否创建成功
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV文件未成功创建: ${filePath}`);
    }
    
    const fileSize = fs.statSync(filePath).size;
    console.log(`✅ CSV已导出: ${fname}`);
    console.log(`📁 文件大小: ${(fileSize / 1024).toFixed(2)} KB\n`);
    
    return filePath;
  } catch (err) {
    console.error('❌ CSV导出失败:', err.message);
    throw err;
  }
}

/**
 * 使用sqlite3 CLI导出多张表到单个CSV（包含分隔符）
 * @param {string} filename - 输出文件名
 * @returns {string} 完整文件路径
 */
function exportMultiTableToCSV(filename = null) {
  try {
    ensureTmpDir();
    
    const fname = filename || `完整数据导出_${new Date().toISOString().split('T')[0]}.csv`;
    const filePath = path.join(TMP_DIR, fname);
    
    console.log(`📊 开始导出完整数据CSV...\n`);
    
    // 读取orders表
    const sql = `
.mode csv
.headers on
SELECT 
  '=== 订单数据 ===' as _header
UNION ALL
SELECT 
  CAST(id as text), type, boss, player, assigner, orderType, game, duration, 
  CAST(amount as text), CAST(price as text), date, source, orderNo, customer, source_channel
FROM orders
ORDER BY id DESC;
`;
    
    const cmd = `sqlite3 "${DB_PATH}"`;
    try {
      execSync(`echo "${sql}" | ${cmd}`, { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      // 继续执行，使用替代方法
      const sqlFile = path.join(TMP_DIR, 'export_query.sql');
      fs.writeFileSync(sqlFile, sql, 'utf8');
      execSync(`sqlite3 "${DB_PATH}" < "${sqlFile}" > "${filePath}"`, { encoding: 'utf8' });
      fs.unlinkSync(sqlFile);
    }
    
    if (!fs.existsSync(filePath)) {
      throw new Error('CSV文件未成功创建');
    }
    
    const fileSize = fs.statSync(filePath).size;
    console.log(`✅ 完整数据CSV已导出: ${fname}`);
    console.log(`📁 文件大小: ${(fileSize / 1024).toFixed(2)} KB\n`);
    
    return filePath;
  } catch (err) {
    console.error('❌ 导出失败:', err.message);
    throw err;
  }
}

/**
 * 异步删除文件
 * @param {string} filePath - 文件路径
 * @param {number} delayMs - 延迟时间（毫秒）
 */
function deleteFileAsync(filePath, delayMs = 5000) {
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ 临时文件已删除: ${path.basename(filePath)}`);
      }
    } catch (err) {
      console.error(`❌ 删除文件失败: ${err.message}`);
    }
  }, delayMs);
}

/**
 * 获取文件统计信息
 * @param {string} filePath - 文件路径
 * @returns {object} 统计信息
 */
function getFileStats(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    
    return {
      size: stats.size,
      sizeKB: (stats.size / 1024).toFixed(2),
      lines: lines.length - 1, // 减去header行
      createdAt: stats.birthtime,
    };
  } catch (err) {
    console.error('获取文件统计失败:', err.message);
    return null;
  }
}

module.exports = {
  exportToCSV,
  exportMultiTableToCSV,
  deleteFileAsync,
  getFileStats,
  TMP_DIR,
};

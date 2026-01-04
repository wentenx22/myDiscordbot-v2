#!/usr/bin/env node

// =============================================================
// db-manager.js - SQLite 数据库管理工具
// 用途：查看、编辑、导出数据库数据
// 使用: node db-manager.js [命令] [选项]
// =============================================================

const db = require('./db');
const fs = require('fs');
const readline = require('readline');
const XLSX = require('xlsx');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printMenu() {
  log('\n╔════════════════════════════════════════╗', 'blue');
  log('║     📊 SQLite 数据库管理工具          ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');
  log('\n可用命令：', 'bright');
  log('  1. 查看所有订单');
  log('  2. 查看统计数据');
  log('  3. 查看最近 N 条订单');
  log('  4. 按 ID 查看订单详情');
  log('  5. 搜索订单（按玩家名称）');
  log('  6. 导出订单为 JSON');
  log('  7. 导出订单为 Excel');
  log('  8. 清空所有订单（警告！）');
  log('  9. 重置统计数据');
  log('  0. 退出\n');
}

async function viewAllOrders() {
  try {
    const orders = db.getAllOrders();
    
    if (orders.length === 0) {
      log('📭 暂无订单', 'yellow');
      return;
    }

    log(`\n📋 共有 ${orders.length} 条订单:\n`, 'bright');
    
    // 表格头
    console.log('┌─────┬─────────┬──────────┬──────────┬─────────────┬──────────────────┐');
    console.log('│ ID  │ 类型    │ 玩家     │ 老板     │ 金额        │ 日期             │');
    console.log('├─────┼─────────┼──────────┼──────────┼─────────────┼──────────────────┤');
    
    orders.forEach(order => {
      const id = String(order.id || '').padStart(3);
      const type = String(order.type || '').padEnd(7);
      const player = String(order.player || '-').substring(0, 8).padEnd(8);
      const boss = String(order.boss || '-').substring(0, 8).padEnd(8);
      const amount = String(order.amount || 0).padStart(11);
      const date = String(order.date || '-').substring(0, 16).padEnd(16);
      
      console.log(`│ ${id} │ ${type} │ ${player} │ ${boss} │RM${amount} │ ${date} │`);
    });
    
    console.log('└─────┴─────────┴──────────┴──────────┴─────────────┴──────────────────┘');
    
  } catch (err) {
    log(`❌ 错误: ${err.message}`, 'red');
  }
}

async function viewStats() {
  try {
    const stats = db.getStats();
    
    log('\n📊 统计数据:\n', 'bright');
    log(`  总订单数: ${colors.bright}${stats.totalOrders}${colors.reset}`);
    log(`  总收入: ${colors.bright}RM ${stats.totalRevenue}${colors.reset}`);
    log(`  平均单价: ${colors.bright}RM ${(stats.totalRevenue / (stats.totalOrders || 1)).toFixed(2)}${colors.reset}`);
    log(`  最后更新: ${colors.bright}${stats.lastUpdated || '从未'}${colors.reset}\n`);
    
  } catch (err) {
    log(`❌ 错误: ${err.message}`, 'red');
  }
}

async function viewRecentOrders(limit) {
  try {
    const orders = db.getAllOrders().slice(0, limit || 10);
    
    if (orders.length === 0) {
      log('📭 暂无订单', 'yellow');
      return;
    }

    log(`\n📋 最近 ${orders.length} 条订单:\n`, 'bright');
    
    orders.forEach((order, idx) => {
      log(`\n  [${idx + 1}] ID: ${order.id}`, 'bright');
      log(`      类型: ${order.type}`);
      log(`      玩家: ${order.player || '-'}`);
      log(`      老板: ${order.boss || '-'}`);
      log(`      订单类型: ${order.orderType || '-'}`);
      log(`      时长: ${order.duration || '-'}`);
      log(`      金额: RM ${order.amount || 0}`);
      log(`      日期: ${order.date || '-'}`);
      log(`      来源: ${order.source || '-'}`);
      log(`      单号: ${order.orderNo || '未分配'}`);
    });
    log('\n');
    
  } catch (err) {
    log(`❌ 错误: ${err.message}`, 'red');
  }
}

async function viewOrderById(id) {
  try {
    const order = db.getOrderById(id);
    
    if (!order) {
      log(`❌ 未找到 ID 为 ${id} 的订单`, 'red');
      return;
    }

    log(`\n📦 订单详情 (ID: ${id}):\n`, 'bright');
    log(`  ID: ${order.id}`);
    log(`  类型: ${order.type}`);
    log(`  玩家: ${order.player || '-'}`);
    log(`  老板: ${order.boss || '-'}`);
    log(`  订单类型: ${order.orderType || '-'}`);
    log(`  时长: ${order.duration || '-'}`);
    log(`  金额: RM ${order.amount || 0}`);
    log(`  日期: ${order.date || '-'}`);
    log(`  来源: ${order.source || '-'}`);
    log(`  单号: ${order.orderNo || '未分配'}`);
    log(`  创建时间: ${order.createdAt || '-'}\n`);
    
  } catch (err) {
    log(`❌ 错误: ${err.message}`, 'red');
  }
}

async function searchOrders(keyword) {
  try {
    const orders = db.getAllOrders().filter(o => 
      (o.player && o.player.includes(keyword)) ||
      (o.boss && o.boss.includes(keyword)) ||
      (o.orderType && o.orderType.includes(keyword))
    );
    
    if (orders.length === 0) {
      log(`❌ 未找到包含 "${keyword}" 的订单`, 'yellow');
      return;
    }

    log(`\n📋 搜索结果（共 ${orders.length} 条）:\n`, 'bright');
    
    orders.forEach((order, idx) => {
      log(`  [${idx + 1}] ID: ${order.id} | 玩家: ${order.player || '-'} | 老板: ${order.boss || '-'} | 类型: ${order.orderType || '-'}`);
    });
    log('\n');
    
  } catch (err) {
    log(`❌ 错误: ${err.message}`, 'red');
  }
}

async function exportToJSON() {
  try {
    const orders = db.getAllOrders();
    const stats = db.getStats();
    const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const data = {
      exportDate: new Date().toISOString(),
      stats: stats,
      orders: orders
    };
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
    log(`✅ 数据已导出到 ${filename}`, 'green');
    log(`   包含 ${orders.length} 条订单和统计数据\n`);
    
  } catch (err) {
    log(`❌ 错误: ${err.message}`, 'red');
  }
}

async function exportToExcel() {
  try {
    const orders = db.getAllOrders();
    const filename = `backup_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // 准备导出数据（中文列名）
    const exportData = orders.map((o, idx) => ({
      '序号': idx + 1,
      'ID': o.id,
      '老板': o.boss || '',
      '陪玩': o.player || '',
      '类型': o.orderType || '',
      '时长': o.duration || '',
      '金额': o.amount || 0,
      '单号': o.orderNo || '',
      '来源': o.source || '',
      '日期': o.date || ''
    }));
    
    // 创建 Excel 工作簿
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, '订单记录');
    XLSX.writeFile(workbook, filename);
    
    log(`✅ 数据已导出到 ${filename}`, 'green');
    log(`   包含 ${orders.length} 条订单\n`);
    
  } catch (err) {
    log(`❌ 错误: ${err.message}`, 'red');
  }
}

async function clearAllOrders() {
  return new Promise((resolve) => {
    rl.question('⚠️  确定要删除所有订单吗？(输入 "确定" 来确认): ', (answer) => {
      if (answer === '确定') {
        try {
          const orders = db.getAllOrders();
          orders.forEach(o => db.deleteOrder(o.id));
          log('✅ 已删除所有订单', 'green');
        } catch (err) {
          log(`❌ 错误: ${err.message}`, 'red');
        }
      } else {
        log('❌ 已取消', 'yellow');
      }
      resolve();
    });
  });
}

async function resetStats() {
  return new Promise((resolve) => {
    rl.question('⚠️  确定要重置统计数据吗？(输入 "确定" 来确认): ', (answer) => {
      if (answer === '确定') {
        try {
          db.updateStats(0, 0);
          log('✅ 统计数据已重置', 'green');
        } catch (err) {
          log(`❌ 错误: ${err.message}`, 'red');
        }
      } else {
        log('❌ 已取消', 'yellow');
      }
      resolve();
    });
  });
}

async function main() {
  try {
    // 初始化数据库
    await db.init();
    
    printMenu();
    
    const command = process.argv[2];
    
    if (!command) {
      // 交互模式
      rl.question('请选择命令 (0-9): ', async (choice) => {
        switch (choice.trim()) {
          case '1':
            await viewAllOrders();
            break;
          case '2':
            await viewStats();
            break;
          case '3':
            rl.question('请输入要显示的条数 (默认 10): ', async (num) => {
              await viewRecentOrders(parseInt(num) || 10);
              rl.close();
            });
            return;
          case '4':
            rl.question('请输入订单 ID: ', async (id) => {
              await viewOrderById(parseInt(id));
              rl.close();
            });
            return;
          case '5':
            rl.question('请输入搜索关键词: ', async (keyword) => {
              await searchOrders(keyword);
              rl.close();
            });
            return;
          case '6':
            await exportToJSON();
            break;
          case '7':
            await exportToExcel();
            break;
          case '8':
            await clearAllOrders();
            break;
          case '9':
            await resetStats();
            break;
          case '0':
            log('👋 退出', 'yellow');
            rl.close();
            process.exit(0);
          default:
            log('❌ 无效命令', 'red');
        }
        rl.close();
      });
    } else {
      // 命令行模式
      switch (command) {
        case 'view':
        case 'all':
          await viewAllOrders();
          break;
        case 'stats':
          await viewStats();
          break;
        case 'recent':
          const limit = process.argv[3] || 10;
          await viewRecentOrders(parseInt(limit));
          break;
        case 'get':
          const id = process.argv[3];
          if (!id) {
            log('❌ 请提供订单 ID', 'red');
            break;
          }
          await viewOrderById(parseInt(id));
          break;
        case 'search':
          const keyword = process.argv[3];
          if (!keyword) {
            log('❌ 请提供搜索关键词', 'red');
            break;
          }
          await searchOrders(keyword);
          break;
        case 'export-json':
          await exportToJSON();
          break;
        case 'export-csv':
          await exportToCSV();
          break;
        case 'clear':
          await clearAllOrders();
          break;
        case 'reset-stats':
          await resetStats();
          break;
        default:
          log(`❌ 未知命令: ${command}`, 'red');
          log('可用命令: view, stats, recent, get, search, export-json, export-csv, clear, reset-stats\n');
      }
      rl.close();
    }
    
  } catch (err) {
    log(`❌ 初始化失败: ${err.message}`, 'red');
    rl.close();
    process.exit(1);
  }
}

// 处理程序退出
rl.on('close', () => {
  db.close();
  process.exit(0);
});

main().catch(err => {
  log(`❌ 错误: ${err.message}`, 'red');
  rl.close();
  process.exit(1);
});

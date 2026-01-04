#!/usr/bin/env node

// =============================================================
// db-info.js - 快速数据库信息查看
// 用途：快速查看数据库统计和最新订单
// =============================================================

const db = require('./db');

async function main() {
  try {
    console.log('\n');
    await db.init();
    
    const stats = db.getStats();
    const orders = db.getAllOrders();
    const recentOrders = orders.slice(0, 5);
    
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║          📊 数据库信息快速查看                    ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    console.log('📈 统计信息：');
    console.log(`   总订单数：${stats.totalOrders}`);
    console.log(`   总收入：RM ${stats.totalRevenue}`);
    console.log(`   平均单价：RM ${(stats.totalRevenue / (stats.totalOrders || 1)).toFixed(2)}`);
    console.log(`\n💾 数据库文件：data.db (${(require('fs').statSync('./data.db').size / 1024).toFixed(2)} KB)\n`);
    
    console.log('📋 最近 5 条订单：');
    console.log('   ' + '─'.repeat(70));
    
    if (recentOrders.length === 0) {
      console.log('   暂无订单');
    } else {
      recentOrders.forEach((order, idx) => {
        console.log(`   [${idx + 1}] ID:${order.id} | 玩家:${order.player || '-'} | 老板:${order.boss || '-'}`);
        console.log(`       类型:${order.orderType || '-'} | 金额:RM${order.amount || 0} | 日期:${order.date || '-'}`);
      });
    }
    
    console.log('   ' + '─'.repeat(70));
    console.log(`\n💡 提示：运行 "node db-manager.js" 进入交互式数据库管理工具\n`);
    
    db.close();
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }
}

main();

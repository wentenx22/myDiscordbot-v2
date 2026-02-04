// =============================================================
// migrate.js - JSON 到 SQLite 迁移脚本
// 运行: node migrate.js
// =============================================================

const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrateData() {
  try {
    console.log('🚀 开始迁移数据...');
    
    // 初始化数据库
    await db.init();

    // 迁移 orders.json
    console.log('\n📋 迁移订单数据...');
    const ordersPath = path.join(__dirname, 'orders.json');
    if (fs.existsSync(ordersPath)) {
      const ordersData = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
      
      if (Array.isArray(ordersData) && ordersData.length > 0) {
        for (const order of ordersData) {
          await db.addOrder({
            type: order.type,
            boss: order.boss,
            player: order.player,
            orderType: order.orderType,
            duration: order.duration,
            amount: order.amount,
            date: order.date,
            source: order.source
          });
        }
        console.log(`✅ 已导入 ${ordersData.length} 条订单记录`);
      }
    }

    // 迁移 stats.json
    console.log('\n📊 迁移统计数据...');
    const statsPath = path.join(__dirname, 'stats.json');
    if (fs.existsSync(statsPath)) {
      const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      
      if (statsData.totalOrders || statsData.totalRevenue) {
        await db.updateStats(statsData.totalOrders || 0, statsData.totalRevenue || 0);
        console.log(`✅ 已导入统计数据 - 订单数: ${statsData.totalOrders}, 收入: ${statsData.totalRevenue}`);
      }
    }

    console.log('\n✨ 迁移完成！');
    console.log('💡 提示：你现在可以在 index.js 中使用 db 模块替代 JSON 文件操作');

  } catch (err) {
    console.error('❌ 迁移失败:', err);
    process.exit(1);
  } finally {
    await db.close();
  }
}

migrateData();

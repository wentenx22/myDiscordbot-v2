// =============================================================
// migrate-and-merge.js - 合并orders.json和SQLite数据
// 使用方法: node migrate-and-merge.js
// =============================================================

const db = require('./db');
const fs = require('fs');
const path = require('path');

const ORDERS_JSON_PATH = path.join(__dirname, 'orders.json');
const ORDERS_BACKUP_PATH = path.join(__dirname, 'orders_backup.json');

async function main() {
  try {
    console.log('📊 开始合并orders.json和SQLite数据...\n');
    
    // 1. 初始化数据库
    if (!db.initialized) {
      console.log('⏳ 初始化数据库...');
      await db.init();
      console.log('✅ 数据库已初始化\n');
    }
    
    // 2. 读取orders.json
    console.log('📖 读取orders.json...');
    let jsonOrders = [];
    if (fs.existsSync(ORDERS_JSON_PATH)) {
      try {
        const content = fs.readFileSync(ORDERS_JSON_PATH, 'utf8').trim();
        if (content && content !== '[]') {
          jsonOrders = JSON.parse(content);
        } else {
          jsonOrders = [];
        }
        console.log(`✅ 获取到 ${jsonOrders.length} 条JSON数据\n`);
      } catch (err) {
        console.warn(`⚠️  orders.json读取失败: ${err.message}`);
        jsonOrders = [];
      }
    } else {
      console.log('⚠️  orders.json不存在\n');
    }
    
    // 3. 读取SQLite数据
    console.log('📖 读取SQLite数据...');
    const sqliteOrders = db.getAllOrders();
    console.log(`✅ 获取到 ${sqliteOrders.length} 条SQLite数据\n`);
    
    // 4. 数据去重和合并
    console.log('🔄 进行去重和合并...');
    const mergedMap = new Map();
    
    // 先加入SQLite数据（保留现有数据）
    sqliteOrders.forEach(order => {
      const key = order.orderNo || `${order.player}_${order.date}`;
      mergedMap.set(key, order);
    });
    
    console.log(`  SQLite数据 - ${mergedMap.size} 条`);
    
    // 再加入JSON数据（新数据）
    let newCount = 0;
    let duplicateCount = 0;
    
    jsonOrders.forEach(order => {
      const key = order.orderNo || `${order.player}_${order.date}`;
      if (mergedMap.has(key)) {
        duplicateCount++;
        console.log(`  [重复] 跳过: ${key}`);
      } else {
        mergedMap.set(key, order);
        newCount++;
        console.log(`  [新增] 导入: ${key}`);
      }
    });
    
    console.log(`\n📊 合并结果:`);
    console.log(`  - 新增数据: ${newCount} 条`);
    console.log(`  - 重复数据: ${duplicateCount} 条`);
    console.log(`  - 合并后总数: ${mergedMap.size} 条\n`);
    
    // 5. 将新数据导入SQLite
    if (newCount > 0) {
      console.log('💾 导入新数据到SQLite...');
      
      const mergedOrders = Array.from(mergedMap.values());
      let importCount = 0;
      let failCount = 0;
      
      for (const order of mergedOrders) {
        // 检查是否已存在
        try {
          const existing = db.getOrderByNo(order.orderNo);
          if (!existing) {
            // 确保必要字段存在
            const safeOrder = {
              type: order.type || 'report',
              boss: order.boss || null,
              player: order.player || null,
              assigner: order.assigner || null,
              orderType: order.orderType || null,
              game: order.game || null,
              duration: order.duration || null,
              amount: order.amount || order.price || null,
              price: order.price || null,
              date: order.date || new Date().toISOString(),
              source: order.source || null,
              orderNo: order.orderNo || null,
              source_channel: order.source_channel || null,
              customer: order.customer || null,
              originalOrder: order.originalOrder || null,
            };
            
            db.addOrder(safeOrder);
            importCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`  ❌ 导入失败: ${order.orderNo} - ${err.message}`);
        }
      }
      
      console.log(`✅ 成功导入 ${importCount} 条新数据`);
      if (failCount > 0) {
        console.log(`⚠️  导入失败 ${failCount} 条\n`);
      } else {
        console.log();
      }
      
      // 保存数据库
      db.save();
      console.log('✅ 数据库已保存\n');
    }
    
    // 6. 备份orders.json
    if (jsonOrders.length > 0) {
      console.log('📦 备份orders.json...');
      const backupPath = ORDERS_BACKUP_PATH;
      fs.copyFileSync(ORDERS_JSON_PATH, backupPath);
      console.log(`✅ 备份已保存: ${backupPath}\n`);
      
      // 清空orders.json（数据已合并到SQLite）
      console.log('🧹 清空orders.json...');
      fs.writeFileSync(ORDERS_JSON_PATH, '[]', 'utf8');
      console.log('✅ orders.json已清空\n');
    }
    
    // 7. 统计最终数据
    console.log('📈 最终数据统计:');
    const finalOrders = db.getAllOrders();
    const reports = finalOrders.filter(o => o.type === 'report');
    const tickets = finalOrders.filter(o => o.type !== 'report' && o.type);
    
    console.log(`  - 报备记录: ${reports.length} 条`);
    console.log(`  - 派单记录: ${tickets.length} 条`);
    console.log(`  - 总计: ${finalOrders.length} 条\n`);
    
    console.log('✨ 合并完成！所有数据现已统一存储在SQLite数据库中。');
    console.log('💡 提示: 后续请使用SQLite数据库作为唯一的数据源。');
    console.log('💡 提示: 可以删除orders.json或作为备份保留。\n');
    
  } catch (err) {
    console.error('❌ 合并失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});

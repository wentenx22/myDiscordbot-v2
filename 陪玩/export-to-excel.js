// =============================================================
// export-to-excel.js - 直接从SQLite导出数据到Excel
// 使用方法: node export-to-excel.js [输出文件名]
// =============================================================

const db = require('./db');
const exporter = require('./exporter');
const path = require('path');

async function main() {
  try {
    console.log('📊 开始从SQLite导出数据到Excel...\n');
    
    // 初始化数据库
    if (!db.initialized) {
      console.log('⏳ 初始化数据库...');
      await db.init();
      console.log('✅ 数据库已初始化\n');
    }
    
    // 获取所有订单
    console.log('📋 正在读取SQLite数据...');
    const allOrders = db.getAllOrders();
    console.log(`✅ 获取到 ${allOrders.length} 条记录\n`);
    
    if (allOrders.length === 0) {
      console.warn('⚠️  数据库中没有记录，跳过导出');
      return;
    }
    
    // 分别导出报备记录和派单记录
    const reports = allOrders.filter(o => o.type === 'report');
    const orders = allOrders.filter(o => o.type !== 'report' && o.type);
    const allMixed = allOrders; // 混合所有记录
    
    console.log(`📊 数据统计:`);
    console.log(`  - 报备记录: ${reports.length} 条`);
    console.log(`  - 派单记录: ${orders.length} 条`);
    console.log(`  - 总计: ${allMixed.length} 条\n`);
    
    // 生成输出文件名
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = process.argv[2] || `完整数据导出_${timestamp}.xlsx`;
    
    // 导出为Excel（多Sheet）
    console.log(`💾 正在生成Excel文件...\n`);
    const filePath = exporter.exportToExcelMultiSheet(allMixed, filename);
    
    console.log(`\n✅ 导出成功！`);
    console.log(`📁 文件位置: ${filePath}`);
    console.log(`\n💡 提示: 你可以在 Discord 中使用 /db export 命令来导出数据`);
    
  } catch (err) {
    console.error('❌ 导出失败:', err.message);
    process.exit(1);
  }
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});

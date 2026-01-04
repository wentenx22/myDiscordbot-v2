#!/usr/bin/env node

/**
 * 数据库编辑示例脚本
 * 这个脚本展示了如何通过代码编辑数据库
 * 
 * 使用示例：
 *   node db-edit-example.js
 */

const db = require('./db');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  try {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║        📝 数据库编辑工具                          ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    await db.init();
    
    console.log('请选择要执行的操作：');
    console.log('  1. 查看所有订单');
    console.log('  2. 修改订单单号');
    console.log('  3. 删除特定订单');
    console.log('  4. 查看并编辑统计数据');
    console.log('  0. 退出\n');
    
    const choice = await question('请选择 (0-4): ');
    
    switch (choice.trim()) {
      case '1':
        await viewAllOrders();
        break;
      case '2':
        await updateOrderNumber();
        break;
      case '3':
        await deleteOrder();
        break;
      case '4':
        await editStats();
        break;
      case '0':
        console.log('\n👋 退出\n');
        break;
      default:
        console.log('❌ 无效选择');
    }
    
    rl.close();
    db.close();
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
    rl.close();
    db.close();
    process.exit(1);
  }
}

async function viewAllOrders() {
  console.log('\n📋 所有订单：\n');
  const orders = db.getAllOrders();
  
  if (orders.length === 0) {
    console.log('暂无订单');
    return;
  }
  
  orders.forEach((order, idx) => {
    console.log(`[${idx + 1}] ID:${order.id} | 玩家:${order.player || '-'} | 老板:${order.boss || '-'} | 单号:${order.orderNo || '未分配'}`);
  });
  console.log();
}

async function updateOrderNumber() {
  console.log('\n📝 修改订单单号\n');
  
  const idStr = await question('请输入订单 ID: ');
  const id = parseInt(idStr);
  
  if (isNaN(id)) {
    console.log('❌ 无效的 ID');
    return;
  }
  
  const order = db.getOrderById(id);
  if (!order) {
    console.log(`❌ 找不到 ID 为 ${id} 的订单`);
    return;
  }
  
  console.log(`\n当前订单信息：`);
  console.log(`  ID: ${order.id}`);
  console.log(`  玩家: ${order.player || '-'}`);
  console.log(`  老板: ${order.boss || '-'}`);
  console.log(`  类型: ${order.orderType || '-'}`);
  console.log(`  金额: RM ${order.amount || 0}`);
  console.log(`  当前单号: ${order.orderNo || '未分配'}\n`);
  
  const newOrderNo = await question('请输入新单号: ');
  
  if (!newOrderNo.trim()) {
    console.log('❌ 单号不能为空');
    return;
  }
  
  db.updateOrderNumber(id, newOrderNo.trim());
  console.log(`✅ 订单 ${id} 的单号已更新为: ${newOrderNo.trim()}\n`);
}

async function deleteOrder() {
  console.log('\n🗑️ 删除订单\n');
  
  const idStr = await question('请输入要删除的订单 ID: ');
  const id = parseInt(idStr);
  
  if (isNaN(id)) {
    console.log('❌ 无效的 ID');
    return;
  }
  
  const order = db.getOrderById(id);
  if (!order) {
    console.log(`❌ 找不到 ID 为 ${id} 的订单`);
    return;
  }
  
  console.log(`\n要删除的订单：`);
  console.log(`  ID: ${order.id}`);
  console.log(`  玩家: ${order.player || '-'}`);
  console.log(`  老板: ${order.boss || '-'}`);
  console.log(`  类型: ${order.orderType || '-'}`);
  console.log(`  金额: RM ${order.amount || 0}\n`);
  
  const confirm = await question('确定要删除这个订单吗？(是/否): ');
  
  if (confirm.toLowerCase() !== '是') {
    console.log('❌ 已取消\n');
    return;
  }
  
  db.deleteOrder(id);
  console.log(`✅ 订单 ${id} 已删除\n`);
}

async function editStats() {
  console.log('\n📊 编辑统计数据\n');
  
  const stats = db.getStats();
  console.log('当前统计数据：');
  console.log(`  总订单数: ${stats.totalOrders}`);
  console.log(`  总收入: RM ${stats.totalRevenue}`);
  console.log(`  平均单价: RM ${(stats.totalRevenue / (stats.totalOrders || 1)).toFixed(2)}\n`);
  
  const ordersStr = await question('请输入新的总订单数 (按 Enter 跳过): ');
  const revenueStr = await question('请输入新的总收入 (按 Enter 跳过): ');
  
  let newOrders = stats.totalOrders;
  let newRevenue = stats.totalRevenue;
  
  if (ordersStr.trim()) {
    newOrders = parseInt(ordersStr);
    if (isNaN(newOrders)) {
      console.log('❌ 无效的订单数');
      return;
    }
  }
  
  if (revenueStr.trim()) {
    newRevenue = parseInt(revenueStr);
    if (isNaN(newRevenue)) {
      console.log('❌ 无效的收入');
      return;
    }
  }
  
  if (newOrders === stats.totalOrders && newRevenue === stats.totalRevenue) {
    console.log('ℹ️  没有做出任何改动');
    return;
  }
  
  console.log(`\n新的统计数据：`);
  console.log(`  总订单数: ${newOrders}`);
  console.log(`  总收入: RM ${newRevenue}`);
  console.log(`  平均单价: RM ${(newRevenue / (newOrders || 1)).toFixed(2)}\n`);
  
  const confirm = await question('确定要保存这些更改吗？(是/否): ');
  
  if (confirm.toLowerCase() !== '是') {
    console.log('❌ 已取消\n');
    return;
  }
  
  db.updateStats(newOrders, newRevenue);
  console.log('✅ 统计数据已更新\n');
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  rl.close();
  process.exit(1);
});

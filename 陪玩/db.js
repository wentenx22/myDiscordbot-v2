// =============================================================
// db.js - SQLite 数据库模块（使用 sql.js - 纯 JavaScript）
// 处理所有数据库操作和初始化
// =============================================================

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.initialized = false;
  }

  // 初始化数据库连接
  async init() {
    try {
      // 初始化 SQL.js
      this.SQL = await initSqlJs();
      
      // 如果存在数据库文件，加载它；否则创建新的
      let data;
      if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        data = new Uint8Array(buffer);
      }
      
      this.db = new this.SQL.Database(data);
      console.log('✅ 数据库连接成功');
      
      await this.createTables();
      this.initialized = true;
      return true;
    } catch (err) {
      console.error('❌ 无法初始化数据库:', err);
      throw err;
    }
  }

  // 保存数据库到文件
  save() {
    try {
      if (!this.db) return;
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error('❌ 保存数据库失败:', err);
    }
  }

  // 创建所有必要的表
  async createTables() {
    try {
      // 订单表 - 支持报备和派单的统一字段
      this.db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL DEFAULT 'report',
          boss TEXT,
          player TEXT,
          assigner TEXT,
          orderType TEXT,
          game TEXT,
          duration TEXT,
          amount INTEGER,
          price INTEGER,
          date TEXT,
          source TEXT,
          orderNo TEXT,
          customer TEXT,
          source_channel TEXT,
          originalOrder TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ orders 表已创建/存在');

      // 统计表
      this.db.run(`
        CREATE TABLE IF NOT EXISTS stats (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          totalOrders INTEGER DEFAULT 0,
          totalRevenue INTEGER DEFAULT 0,
          lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ stats 表已创建/存在');

      // 确保 stats 表中有一行数据
      try {
        this.db.run('INSERT INTO stats (id, totalOrders, totalRevenue) VALUES (1, 0, 0)');
        console.log('✅ stats 数据已初始化');
      } catch (e) {
        // 表已存在，数据也已存在
      }
      
      this.save();
    } catch (err) {
      console.error('❌ 创建表失败:', err);
      throw err;
    }
  }

  // 添加订单
  addOrder(orderData) {
    try {
      const { type, boss, player, orderType, duration, amount, date, source, orderNo, assigner, game, price, customer, source_channel, originalOrder } = orderData;
      const stmt = this.db.prepare(
        `INSERT INTO orders (type, boss, player, assigner, orderType, game, duration, amount, price, date, source, orderNo, customer, source_channel, originalOrder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      
      // sql.js不接受undefined，需要用null或空字符串替换
      const values = [
        type || 'report',
        boss ? String(boss) : '',
        player ? String(player) : '',
        assigner ? String(assigner) : '',
        orderType ? String(orderType) : '',
        game ? String(game) : '',
        duration ? String(duration) : '',
        amount !== undefined && amount !== null ? Number(amount) : 0,
        price !== undefined && price !== null ? Number(price) : 0,
        date ? String(date) : new Date().toISOString(),
        source ? String(source) : '',
        orderNo ? String(orderNo) : '',
        customer ? String(customer) : '',
        source_channel ? String(source_channel) : '',
        originalOrder ? String(originalOrder) : ''
      ];
      
      stmt.bind(values);
      stmt.step();
      stmt.free();
      
      this.save();
      return { ...orderData };
    } catch (err) {
      console.error('❌ 添加订单失败:', err);
      throw err;
    }
  }

  // 获取所有订单
  getAllOrders() {
    try {
      const stmt = this.db.prepare('SELECT * FROM orders ORDER BY id DESC');
      const results = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row);
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('❌ 获取订单失败:', err);
      throw err;
    }
  }

  // 获取指定 ID 的订单
  getOrderById(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM orders WHERE id = ?');
      stmt.bind([id]);
      let result = null;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.free();
      return result;
    } catch (err) {
      console.error('❌ 获取订单失败:', err);
      throw err;
    }
  }

  // 获取指定订单号的订单
  getOrderByNo(orderNo) {
    try {
      const stmt = this.db.prepare('SELECT * FROM orders WHERE orderNo = ?');
      stmt.bind([orderNo]);
      let result = null;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.free();
      return result;
    } catch (err) {
      console.error('❌ 获取订单失败:', err);
      throw err;
    }
  }

  // 删除订单
  deleteOrder(id) {
    try {
      this.db.run('DELETE FROM orders WHERE id = ?', [id]);
      this.save();
      return 1;
    } catch (err) {
      console.error('❌ 删除订单失败:', err);
      throw err;
    }
  }
  // 【已移除】getLastReportWithoutOrderNo() 
  // 原因：这个方法"猜测"最后一条报备，容易在并发时出错
  // 新做法：在 Embed footer 中存储 orderId，从 modal 提交时直接读取

  // 更新订单单号
  updateOrderNumber(id, orderNo) {
    try {
      this.db.run('UPDATE orders SET orderNo = ? WHERE id = ?', [orderNo, id]);
      this.save();
    } catch (err) {
      console.error('❌ 更新订单单号失败:', err);
      throw err;
    }
  }

  // 获取统计数据 - 【修复】从 orders 表实时计算，确保数据一致
  getStats() {
    try {
      const orders = this.getAllOrders();
      
      // 计算总订单数和总收入
      let totalOrders = 0;
      let totalRevenue = 0;
      
      orders.forEach(order => {
        if (order.amount && !isNaN(order.amount)) {
          totalRevenue += parseInt(order.amount) || 0;
          totalOrders += 1;
        }
      });

      const now = new Date().toISOString();
      return {
        totalOrders,
        totalRevenue,
        lastUpdated: now,
        recordCount: orders.length
      };
    } catch (err) {
      console.error('❌ 获取统计数据失败:', err);
      return { totalOrders: 0, totalRevenue: 0, lastUpdated: new Date().toISOString(), recordCount: 0 };
    }
  }

  // 更新统计数据
  updateStats(totalOrders, totalRevenue) {
    try {
      this.db.run(
        `UPDATE stats SET totalOrders = ?, totalRevenue = ?, lastUpdated = CURRENT_TIMESTAMP WHERE id = 1`,
        [totalOrders, totalRevenue]
      );
      this.save();
      return { totalOrders, totalRevenue, lastUpdated: new Date().toISOString() };
    } catch (err) {
      console.error('❌ 更新统计数据失败:', err);
      throw err;
    }
  }

  // 查询订单统计（按类型或其他条件）
  queryOrders(filter = {}) {
    try {
      let query = `SELECT * FROM orders WHERE 1=1`;
      const params = [];

      if (filter.type) {
        query += ` AND type = ?`;
        params.push(filter.type);
      }
      if (filter.player) {
        query += ` AND player = ?`;
        params.push(filter.player);
      }
      if (filter.boss) {
        query += ` AND boss = ?`;
        params.push(filter.boss);
      }
      if (filter.startDate && filter.endDate) {
        query += ` AND date BETWEEN ? AND ?`;
        params.push(filter.startDate, filter.endDate);
      }

      query += ` ORDER BY id DESC`;

      const stmt = this.db.prepare(query);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('❌ 查询订单失败:', err);
      throw err;
    }
  }

  // 关闭数据库连接
  close() {
    try {
      if (this.db) {
        this.save();
        this.db.close();
        console.log('✅ 数据库连接已关闭');
      }
    } catch (err) {
      console.error('❌ 关闭数据库失败:', err);
    }
  }
}

module.exports = new DatabaseManager();

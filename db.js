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
      
      // 【新增】执行数据库迁移，为旧版本记录补充 orderId 信息
      this.migrateOldRecords();
    } catch (err) {
      console.error('❌ 创建表失败:', err);
      throw err;
    }
  }

  // 【新增】数据库迁移：为旧版本记录（Embed footer 中没有 orderId 的记录）补充信息
  migrateOldRecords() {
    try {
      const orders = this.getAllOrders();
      const oldRecordCount = orders.filter(o => !o.source || o.source === '').length;
      
      if (oldRecordCount > 0) {
        console.warn(`⚠️ [迁移] 检测到 ${oldRecordCount} 条旧版本记录（缺少 source 信息）`);
        
        // 为缺少 source 的旧记录补充默认来源标记
        const updateStmt = this.db.prepare('UPDATE orders SET source = ? WHERE source IS NULL OR source = ""');
        updateStmt.bind(['migrated']);
        updateStmt.step();
        updateStmt.free();
        
        this.save();
        console.log(`✅ [迁移] 已为 ${oldRecordCount} 条旧记录补充来源标记`);
      }
      
      // 检查是否存在其他潜在问题
      const recordsWithoutOrderNo = orders.filter(o => !o.orderNo || o.orderNo === '').length;
      const recordsWithoutBoss = orders.filter(o => !o.boss || o.boss === '').length;
      
      if (recordsWithoutOrderNo > 0) {
        console.warn(`⚠️ [迁移] 检测到 ${recordsWithoutOrderNo} 条记录未填写单号`);
      }
      if (recordsWithoutBoss > 0) {
        console.warn(`⚠️ [迁移] 检测到 ${recordsWithoutBoss} 条记录缺少老板信息`);
      }
      
      console.log('✅ [迁移] 数据库迁移完成');
    } catch (err) {
      console.error('❌ [迁移] 数据库迁移失败:', err.message);
      // 不中断程序执行
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
      
      // 【修复】获取最后插入的自增ID
      let orderId = null;
      try {
        const idStmt = this.db.prepare('SELECT last_insert_rowid() as id');
        if (idStmt.step()) {
          const result = idStmt.getAsObject();
          orderId = result.id;
          console.log(`✅ 订单已插入，orderId: ${orderId}`);
        }
        idStmt.free();
      } catch (e) {
        console.error('⚠️ 获取自增ID失败:', e.message);
        // 备选方案：查询最后一条记录
        const fallbackStmt = this.db.prepare('SELECT id FROM orders ORDER BY id DESC LIMIT 1');
        if (fallbackStmt.step()) {
          const result = fallbackStmt.getAsObject();
          orderId = result.id;
          console.log(`✅ 使用备选方案获取orderId: ${orderId}`);
        }
        fallbackStmt.free();
      }
      
      this.save();
      
      // 返回包含orderId的对象
      return {
        ...orderData,
        id: orderId,
        orderId: orderId
      };
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

  // 【新增】为没有source的旧记录添加标记
  fixMissingSource() {
    try {
      const stmt = this.db.prepare('UPDATE orders SET source = ? WHERE source IS NULL OR source = ""');
      stmt.bind(['imported']);
      stmt.step();
      stmt.free();
      this.save();
      console.log('✅ 已为旧记录添加来源标记');
      return true;
    } catch (err) {
      console.error('❌ 修复source失败:', err);
      return false;
    }
  }

  // ========================================================
  // 【新增SQL查询函数】架构改造第一阶段
  // 用于替换 statistics.loadOrdersData() 等旧函数
  // ========================================================

  /**
   * 获取订单统计摘要（从SQLite直接聚合）
   * 返回：总订单数、总收入、总时长等统计数据
   */
  getStatsSummary() {
    try {
      // 报备和派单分别统计
      const reportsStmt = this.db.prepare(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(CAST(amount AS INTEGER)), 0) as totalAmount,
          GROUP_CONCAT(duration, ',') as durations
        FROM orders WHERE type = 'report'
      `);
      reportsStmt.step();
      const reportStats = reportsStmt.getAsObject();
      reportsStmt.free();

      const dispatchesStmt = this.db.prepare(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(CAST(price AS INTEGER)), 0) as totalPrice,
          GROUP_CONCAT(duration, ',') as durations
        FROM orders WHERE type != 'report'
      `);
      dispatchesStmt.step();
      const dispatchStats = dispatchesStmt.getAsObject();
      dispatchesStmt.free();

      // 计算总时长（提取数字部分）
      const parseDuration = (durationStr) => {
        if (!durationStr) return 0;
        const match = String(durationStr).match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };

      const reportDurations = reportStats.durations ? reportStats.durations.split(',').map(parseDuration) : [];
      const dispatchDurations = dispatchStats.durations ? dispatchStats.durations.split(',').map(parseDuration) : [];
      const totalReportHours = reportDurations.reduce((a, b) => a + b, 0);
      const totalDispatchHours = dispatchDurations.reduce((a, b) => a + b, 0);

      // 检查缺失单号的记录
      const missingOrderNoStmt = this.db.prepare(`
        SELECT 
          SUM(CASE WHEN type = 'report' AND (orderNo IS NULL OR orderNo = '') THEN 1 ELSE 0 END) as reportsMissing,
          SUM(CASE WHEN type != 'report' AND (orderNo IS NULL OR orderNo = '') THEN 1 ELSE 0 END) as dispatchesMissing
        FROM orders
      `);
      missingOrderNoStmt.step();
      const missingStats = missingOrderNoStmt.getAsObject();
      missingOrderNoStmt.free();

      return {
        totalReports: parseInt(reportStats.count) || 0,
        totalDispatches: parseInt(dispatchStats.count) || 0,
        reportsTotalAmount: parseInt(reportStats.totalAmount) || 0,
        dispatchesTotalPrice: parseInt(dispatchStats.totalPrice) || 0,
        totalAmount: (parseInt(reportStats.totalAmount) || 0) + (parseInt(dispatchStats.totalPrice) || 0),
        reportsTotalHours: totalReportHours,
        dispatchesTotalHours: totalDispatchHours,
        totalHours: totalReportHours + totalDispatchHours,
        reportsMissingOrderNo: parseInt(missingStats.reportsMissing) || 0,
        dispatchesMissingOrderNo: parseInt(missingStats.dispatchesMissing) || 0,
        totalMissingOrderNo: (parseInt(missingStats.reportsMissing) || 0) + (parseInt(missingStats.dispatchesMissing) || 0)
      };
    } catch (err) {
      console.error('❌ 获取统计摘要失败:', err);
      return {
        totalReports: 0, totalDispatches: 0, reportsTotalAmount: 0, dispatchesTotalPrice: 0,
        totalAmount: 0, reportsTotalHours: 0, dispatchesTotalHours: 0, totalHours: 0,
        reportsMissingOrderNo: 0, dispatchesMissingOrderNo: 0, totalMissingOrderNo: 0
      };
    }
  }

  /**
   * 数据质量检查（从SQLite）
   * 返回：问题列表、警告列表等
   */
  performDataQualityCheck() {
    try {
      const orders = this.getAllOrders();
      const issues = [];
      const warnings = [];

      // 检查数据一致性问题
      const reportsWithoutOrderNo = orders.filter(o => o.type === 'report' && !o.orderNo).length;
      const dispatchesWithoutOrderNo = orders.filter(o => o.type !== 'report' && !o.orderNo).length;

      if (reportsWithoutOrderNo > 0) {
        warnings.push(`⚠️ 有 ${reportsWithoutOrderNo} 条报备未填写单号`);
      }
      if (dispatchesWithoutOrderNo > 0) {
        warnings.push(`⚠️ 有 ${dispatchesWithoutOrderNo} 条派单未填写单号`);
      }

      // 检查重复的单号
      const orderNos = {};
      orders.forEach(o => {
        if (o.orderNo) {
          if (!orderNos[o.orderNo]) orderNos[o.orderNo] = 0;
          orderNos[o.orderNo]++;
        }
      });
      
      const duplicateOrderNos = Object.entries(orderNos)
        .filter(([, count]) => count > 1)
        .map(([no, count]) => `❌ 单号 ${no} 重复 ${count} 次`);
      
      issues.push(...duplicateOrderNos);

      // 检查缺失重要字段
      const ordersWithoutPlayer = orders.filter(o => o.type !== 'report' && !o.player).length;
      const ordersWithoutBoss = orders.filter(o => !o.boss).length;

      if (ordersWithoutPlayer > 0) {
        warnings.push(`⚠️ 有 ${ordersWithoutPlayer} 条派单缺少陪玩员信息`);
      }
      if (ordersWithoutBoss > 0) {
        warnings.push(`⚠️ 有 ${ordersWithoutBoss} 条记录缺少老板信息`);
      }

      return {
        hasIssues: issues.length > 0,
        issues,
        warnings,
        totalIssuesAndWarnings: issues.length + warnings.length
      };
    } catch (err) {
      console.error('❌ 数据质量检查失败:', err);
      return { hasIssues: false, issues: [], warnings: [], totalIssuesAndWarnings: 0 };
    }
  }

  /**
   * 获取派单员排行（从SQLite GROUP BY）
   * 返回：派单员名称、派单数、总金额等
   */
  getAssignerRankingFromDB() {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          assigner,
          COUNT(*) as count,
          COALESCE(SUM(CAST(price AS INTEGER)), 0) as totalPrice
        FROM orders
        WHERE type != 'report' AND assigner IS NOT NULL AND assigner != ''
        GROUP BY assigner
        ORDER BY totalPrice DESC
        LIMIT 10
      `);

      const results = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          name: row.assigner,
          count: parseInt(row.count) || 0,
          totalPrice: parseInt(row.totalPrice) || 0
        });
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('❌ 获取派单员排行失败:', err);
      return [];
    }
  }

  /**
   * 获取指定日期范围内的派单员排行（从SQLite GROUP BY）
   */
  getAssignerRankingByDateRange(startDate, endDate) {
    try {
      const startDateTime = startDate + ' 00:00:00';
      const endDateTime = endDate + ' 23:59:59';

      const stmt = this.db.prepare(`
        SELECT 
          assigner,
          COUNT(*) as count,
          COALESCE(SUM(CAST(price AS INTEGER)), 0) as totalPrice
        FROM orders
        WHERE type != 'report' AND assigner IS NOT NULL AND assigner != ''
          AND date >= ? AND date <= ?
        GROUP BY assigner
        ORDER BY totalPrice DESC
        LIMIT 10
      `);
      stmt.bind([startDateTime, endDateTime]);

      const results = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          name: row.assigner,
          count: parseInt(row.count) || 0,
          totalPrice: parseInt(row.totalPrice) || 0
        });
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('❌ 获取日期范围派单员排行失败:', err);
      return [];
    }
  }

  /**
   * 获取陪玩员排行（从SQLite GROUP BY）
   */
  getPlayerRankingFromDB() {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          player,
          COUNT(*) as count,
          COALESCE(SUM(CAST(price AS INTEGER)), 0) as total
        FROM orders
        WHERE type != 'report' AND player IS NOT NULL AND player != ''
        GROUP BY player
        ORDER BY total DESC
        LIMIT 10
      `);

      const results = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          name: row.player,
          count: parseInt(row.count) || 0,
          total: parseInt(row.total) || 0
        });
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('❌ 获取陪玩员排行失败:', err);
      return [];
    }
  }

  /**
   * 获取老板排行（从SQLite GROUP BY）
   */
  getBossRankingFromDB() {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          boss,
          COUNT(*) as count,
          COALESCE(SUM(CAST(amount AS INTEGER)) + SUM(CAST(price AS INTEGER)), 0) as totalAmount
        FROM orders
        WHERE boss IS NOT NULL AND boss != ''
        GROUP BY boss
        ORDER BY totalAmount DESC
        LIMIT 10
      `);

      const results = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          name: row.boss,
          count: parseInt(row.count) || 0,
          totalAmount: parseInt(row.totalAmount) || 0
        });
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('❌ 获取老板排行失败:', err);
      return [];
    }
  }

  /**
   * 获取指定日期范围内的陪玩员排行（从SQLite GROUP BY）
   */
  getPlayerRankingByDateRange(startDate, endDate) {
    try {
      const startDateTime = startDate + ' 00:00:00';
      const endDateTime = endDate + ' 23:59:59';

      const stmt = this.db.prepare(`
        SELECT 
          player,
          COUNT(*) as count,
          COALESCE(SUM(CAST(price AS INTEGER)), 0) as total
        FROM orders
        WHERE type != 'report' AND player IS NOT NULL AND player != ''
          AND date >= ? AND date <= ?
        GROUP BY player
        ORDER BY total DESC
        LIMIT 10
      `);
      stmt.bind([startDateTime, endDateTime]);

      const results = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          name: row.player,
          count: parseInt(row.count) || 0,
          total: parseInt(row.total) || 0
        });
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('❌ 获取日期范围陪玩员排行失败:', err);
      return [];
    }
  }

  /**
   * 获取指定日期范围内的订单（从SQLite WHERE查询）
   * @param {string} startDate - 开始日期 (YYYY-MM-DD)
   * @param {string} endDate - 结束日期 (YYYY-MM-DD)
   * @returns {Array} 筛选后的订单
   */
  getOrdersByDateRange(startDate, endDate) {
    try {
      // 构建日期范围查询：确保包含endDate当天的全部记录
      const startDateTime = startDate + ' 00:00:00';
      const endDateTime = endDate + ' 23:59:59';

      const stmt = this.db.prepare(`
        SELECT * FROM orders
        WHERE date >= ? AND date <= ?
        ORDER BY id DESC
      `);
      stmt.bind([startDateTime, endDateTime]);

      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('❌ 按日期范围查询订单失败:', err);
      return [];
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

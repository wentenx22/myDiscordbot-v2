// =============================================================
// google-sheets-exporter.js
// 功能: 使用Google Sheets API将订单数据写入Google Sheets
// =============================================================

const axios = require('axios');

class GoogleSheetsExporter {
  constructor(sheetsId, apiKey) {
    this.sheetsId = sheetsId;
    this.apiKey = apiKey;
    this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  }

  /**
   * 获取Sheet的现有数据
   */
  async getSheetData(range = 'A1:Z1000') {
    try {
      const url = `${this.baseUrl}/${this.sheetsId}/values/${range}?key=${this.apiKey}`;
      const response = await axios.get(url);
      return response.data.values || [];
    } catch (err) {
      console.error('❌ 获取Google Sheet数据失败:', err.message);
      return null;
    }
  }

  /**
   * 将数据追加到Google Sheet（新增行）
   */
  async appendToSheet(values, range = 'A1') {
    try {
      const url = `${this.baseUrl}/${this.sheetsId}/values/${range}:append?key=${this.apiKey}`;
      const response = await axios.post(url, {
        values: values,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS'
      });

      console.log(`✅ Google Sheets 数据追加成功 (${values.length} 行)`);
      return { success: true, updates: response.data.updates };
    } catch (err) {
      console.error('❌ Google Sheets 追加失败:', err.message);
      if (err.response?.data) {
        console.error('📋 详细错误:', err.response.data);
      }
      return { success: false, error: err.message };
    }
  }

  /**
   * 清空Sheet所有数据
   */
  async clearSheet(range = 'A:Z') {
    try {
      const url = `${this.baseUrl}/${this.sheetsId}/values/${range}:clear?key=${this.apiKey}`;
      const response = await axios.post(url, {});
      console.log('✅ Google Sheet 已清空');
      return { success: true };
    } catch (err) {
      console.error('❌ 清空Google Sheet失败:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * 批量更新Sheet（多个范围）
   */
  async batchUpdate(data) {
    try {
      const url = `${this.baseUrl}/${this.sheetsId}/values:batchUpdate?key=${this.apiKey}`;
      const response = await axios.post(url, {
        data: data,
        valueInputOption: 'USER_ENTERED'
      });

      console.log('✅ Google Sheets 批量更新成功');
      return { success: true, responses: response.data.responses };
    } catch (err) {
      console.error('❌ Google Sheets 批量更新失败:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * 将订单数据导出到Google Sheets
   * @param {Array} orders - 订单数组
   * @param {String} sheetName - Sheet名称（默认为"Sheet1"）
   */
  async exportOrdersToSheet(orders, sheetName = 'Sheet1') {
    try {
      if (!orders || orders.length === 0) {
        console.warn('⚠️ 没有订单数据可导出');
        return { success: false, reason: 'NO_DATA' };
      }

      // 准备表头
      const headers = [
        '订单号',
        '类型',
        '老板',
        '玩家',
        '分配者',
        '订单类型',
        '游戏',
        '时长',
        '金额',
        '价格',
        '日期',
        '来源',
        '原始订单',
        '客户',
        '频道来源',
        '创建时间'
      ];

      // 准备数据行
      const dataRows = orders.map(order => [
        order.orderNo || '',
        order.type || '',
        order.boss || '',
        order.player || '',
        order.assigner || '',
        order.orderType || '',
        order.game || '',
        order.duration || '',
        order.amount || '',
        order.price || '',
        order.date || '',
        order.source || '',
        order.originalOrder || '',
        order.customer || '',
        order.source_channel || '',
        order.createdAt || ''
      ]);

      // 清空现有数据并写入表头 + 新数据
      const allData = [headers, ...dataRows];

      // 使用batchUpdate进行整体更新
      const result = await this.batchUpdate([
        {
          range: `${sheetName}!A1:P${allData.length}`,
          values: allData
        }
      ]);

      if (result.success) {
        console.log(`✅ 成功导出 ${orders.length} 条订单到 Google Sheets`);
        return {
          success: true,
          recordCount: orders.length,
          sheetsUrl: `https://docs.google.com/spreadsheets/d/${this.sheetsId}`
        };
      } else {
        return result;
      }
    } catch (err) {
      console.error('❌ 导出到Google Sheets失败:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * 仅追加新订单（不清空已有数据）
   */
  async appendOrders(orders, sheetName = 'Sheet1') {
    try {
      if (!orders || orders.length === 0) {
        console.warn('⚠️ 没有订单数据可追加');
        return { success: false, reason: 'NO_DATA' };
      }

      // 准备数据行（不包括表头）
      const dataRows = orders.map(order => [
        order.orderNo || '',
        order.type || '',
        order.boss || '',
        order.player || '',
        order.assigner || '',
        order.orderType || '',
        order.game || '',
        order.duration || '',
        order.amount || '',
        order.price || '',
        order.date || '',
        order.source || '',
        order.originalOrder || '',
        order.customer || '',
        order.source_channel || '',
        order.createdAt || ''
      ]);

      // 追加到Sheet（假设表头已存在）
      const result = await this.appendToSheet(dataRows, `${sheetName}!A2`);

      if (result.success) {
        console.log(`✅ 成功追加 ${orders.length} 条订单到 Google Sheets`);
        return {
          success: true,
          recordCount: orders.length,
          sheetsUrl: `https://docs.google.com/spreadsheets/d/${this.sheetsId}`
        };
      } else {
        return result;
      }
    } catch (err) {
      console.error('❌ 追加订单失败:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * 验证API密钥和Sheet连接
   */
  async verify() {
    try {
      const url = `${this.baseUrl}/${this.sheetsId}?key=${this.apiKey}`;
      const response = await axios.get(url);
      console.log('✅ Google Sheets 连接验证成功');
      return { success: true, title: response.data.properties?.title };
    } catch (err) {
      console.error('❌ Google Sheets 连接验证失败:', err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = GoogleSheetsExporter;

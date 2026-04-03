#!/usr/bin/env node
/**
 * 测试脚本：验证导入脚本的逻辑（不使用真实 API）
 * 
 * 运行方式:
 *   npx ts-node server/modules/consumption-record/import-script-test.ts
 */
import { Logger } from '@nestjs/common';

// ==================== 配置 ====================
const CONFIG = {
  // 飞书多维表格配置（从 capability 配置中获取）
  appToken: 'UFtdb3zgras17usfp4pcyWA9n9d',
  tableId: 'tblEXktIbA7w4JCk',
  // 字段映射配置
  fields: {
    platform: '平台',
    sku: 'SKU',
    amount: '消耗金额',
    date: '日期',
  },
};

// ==================== 平台工具名称映射 ====================
const PLATFORM_TOOL_MAPPING: Record<string, string> = {
  'dou+': '抖音',
  '竞价种草通': '抖音',
  '竞价A3': '抖音',
  '热推': '抖音',
  '二次推广': '微信',
};

/**
 * 将工具名称映射到平台名称
 */
function mapToolToPlatform(toolName: string): string {
  if (!toolName) return '';
  
  // 先尝试直接匹配映射表
  if (PLATFORM_TOOL_MAPPING[toolName]) {
    return PLATFORM_TOOL_MAPPING[toolName];
  }
  
  // 如果已经在目标平台列表中，直接返回
  const validPlatforms = ['抖音', 'B站', '小红书', '微博', '微信', '知乎'];
  if (validPlatforms.includes(toolName)) {
    return toolName;
  }
  
  // 默认返回原值
  return toolName;
}

/**
 * 将Unix时间戳(毫秒)转换为日期字符串 YYYY-MM-DD
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 模拟飞书多维表格返回的数据
 */
function getMockBitableRecords(): any[] {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  return [
    { record_id: 'rec1', fields: { '平台': 'dou+', 'SKU': '吹风机', '消耗金额': 1250.50, '日期': now - oneDay } },
    { record_id: 'rec2', fields: { '平台': '竞价种草通', 'SKU': '剃须刀', '消耗金额': 2800.00, '日期': now - oneDay } },
    { record_id: 'rec3', fields: { '平台': '热推', 'SKU': '牙刷', '消耗金额': 560.75, '日期': now - oneDay * 2 } },
    { record_id: 'rec4', fields: { '平台': '二次推广', 'SKU': '化妆镜', '消耗金额': 3200.00, '日期': now - oneDay * 2 } },
    { record_id: 'rec5', fields: { '平台': '竞价A3', 'SKU': '吹风机', '消耗金额': 1890.25, '日期': now - oneDay * 3 } },
    { record_id: 'rec6', fields: { '平台': '抖音', 'SKU': '卷发棒', '消耗金额': 4500.00, '日期': now - oneDay * 3 } },
    { record_id: 'rec7', fields: { '平台': '微信', 'SKU': '大路灯', '消耗金额': 1200.00, '日期': now - oneDay * 4 } },
    { record_id: 'rec8', fields: { '平台': '小红书', 'SKU': '吹风机', '消耗金额': 890.50, '日期': now - oneDay * 4 } },
    { record_id: 'rec9', fields: { '平台': 'dou+', 'SKU': '剃须刀', '消耗金额': 670.00, '日期': now - oneDay * 5 } },
    { record_id: 'rec10', fields: { '平台': '竞价种草通', 'SKU': '牙刷', '消耗金额': 2300.00, '日期': now - oneDay * 5 } },
  ];
}

/**
 * 测试导入逻辑
 */
async function testImport() {
  const logger = new Logger('TestImport');
  
  logger.log('========================================');
  logger.log('测试导入脚本逻辑');
  logger.log('========================================');
  
  // 模拟飞书数据
  const bitableRecords = getMockBitableRecords();
  
  logger.log(`模拟数据: ${bitableRecords.length} 条记录`);
  
  // 转换数据格式
  logger.log('开始转换数据格式...');
  const { fields: fieldNames } = CONFIG;
  
  const formattedRecords = bitableRecords.map((record: any, index: number) => {
    const fields = record.fields || {};
    
    try {
      // 字段映射
      const platformRaw = fields[fieldNames.platform];
      const skuRaw = fields[fieldNames.sku];
      const amountRaw = fields[fieldNames.amount];
      const dateRaw = fields[fieldNames.date];
      
      // 解析平台（处理文本类型）
      let platformText = '';
      if (typeof platformRaw === 'string') {
        platformText = platformRaw;
      } else if (Array.isArray(platformRaw) && platformRaw.length > 0) {
        platformText = platformRaw[0]?.text || platformRaw[0] || '';
      } else if (typeof platformRaw === 'object' && platformRaw !== null) {
        platformText = platformRaw.text || String(platformRaw);
      }
      const platform = mapToolToPlatform(platformText);
      
      // 解析 SKU（处理文本类型）
      let sku = '';
      if (typeof skuRaw === 'string') {
        sku = skuRaw;
      } else if (Array.isArray(skuRaw) && skuRaw.length > 0) {
        sku = skuRaw[0]?.text || skuRaw[0] || '';
      } else if (typeof skuRaw === 'object' && skuRaw !== null) {
        sku = skuRaw.text || String(skuRaw);
      }
      
      // 解析金额（处理数字类型）
      let amount = 0;
      if (typeof amountRaw === 'number') {
        amount = amountRaw;
      } else if (typeof amountRaw === 'string') {
        amount = Number(amountRaw.replace(/[^0-9.-]/g, ''));
      }
      
      // 解析日期（处理 Unix 时间戳毫秒）
      let recordDate: string;
      if (typeof dateRaw === 'number') {
        recordDate = formatDate(dateRaw);
      } else if (typeof dateRaw === 'string') {
        const timestamp = Date.parse(dateRaw);
        recordDate = isNaN(timestamp) ? dateRaw : formatDate(timestamp);
      } else {
        logger.warn(`第 ${index + 1} 条记录日期格式无效，跳过`);
        return null;
      }
      
      // 验证必填字段
      if (!platform || !sku || !recordDate) {
        logger.warn(`第 ${index + 1} 条记录缺少必填字段，跳过`);
        return null;
      }
      
      return {
        recordDate,
        platform,
        sku,
        amount,
      };
    } catch (error) {
      logger.warn(`第 ${index + 1} 条记录处理失败:`, error);
      return null;
    }
  }).filter((r: any) => r !== null);
  
  logger.log(`有效记录数: ${formattedRecords.length}`);
  
  // 显示所有转换后的记录
  logger.log('转换后的数据:');
  formattedRecords.forEach((r: any, i: number) => {
    logger.log(`  ${i + 1}. ${r.recordDate} | ${r.platform} | ${r.sku} | ¥${r.amount}`);
  });
  
  // 验证平台映射
  logger.log('========================================');
  logger.log('验证平台映射:');
  const platformMappingCheck = [
    { input: 'dou+', expected: '抖音' },
    { input: '竞价种草通', expected: '抖音' },
    { input: '竞价A3', expected: '抖音' },
    { input: '热推', expected: '抖音' },
    { input: '二次推广', expected: '微信' },
    { input: '抖音', expected: '抖音' },
    { input: '微信', expected: '微信' },
    { input: '小红书', expected: '小红书' },
  ];
  
  let allPassed = true;
  for (const check of platformMappingCheck) {
    const result = mapToolToPlatform(check.input);
    const passed = result === check.expected;
    if (!passed) allPassed = false;
    logger.log(`  ${check.input} => ${result} ${passed ? '✓' : '✗ (期望: ' + check.expected + ')'}`);
  }
  
  logger.log('========================================');
  if (allPassed) {
    logger.log('所有测试通过！');
  } else {
    logger.error('部分测试失败！');
  }
  logger.log('========================================');
  
  // 显示统计信息
  const platformStats: Record<string, number> = {};
  const skuStats: Record<string, number> = {};
  
  for (const record of formattedRecords) {
    platformStats[record.platform] = (platformStats[record.platform] || 0) + 1;
    skuStats[record.sku] = (skuStats[record.sku] || 0) + 1;
  }
  
  logger.log('按平台统计:');
  Object.entries(platformStats).forEach(([platform, count]) => {
    logger.log(`  ${platform}: ${count} 条`);
  });
  
  logger.log('按SKU统计:');
  Object.entries(skuStats).forEach(([sku, count]) => {
    logger.log(`  ${sku}: ${count} 条`);
  });
  
  logger.log('========================================');
}

// 执行测试
testImport().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('测试失败:', error);
  process.exit(1);
});

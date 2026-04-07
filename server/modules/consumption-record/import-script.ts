#!/usr/bin/env node
/**
 * 临时脚本：从飞书多维表格导入每日消耗数据
 * 
 * 使用方法:
 * 方式1 - 使用环境变量:
 *   export FEISHU_ACCESS_TOKEN="your_token"
 *   export SUDA_DATABASE_URL="postgresql://user:pass@host:port/db"
 *   npx ts-node server/modules/consumption-record/import-script.ts
 * 
 * 方式2 - 使用命令行参数:
 *   npx ts-node server/modules/consumption-record/import-script.ts --token="your_token" --db-url="postgresql://..."
 * 
 * 方式3 - 在 .env 文件中设置变量后运行
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// 加载 .env 文件
dotenv.config();

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
  '千川种草通': '抖音',
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
 * 解析命令行参数
 */
function parseArgs(): { token?: string; dbUrl?: string; help?: boolean } {
  const args = process.argv.slice(2);
  const result: { token?: string; dbUrl?: string; help?: boolean } = {};
  
  for (const arg of args) {
    if (arg.startsWith('--token=')) {
      result.token = arg.split('=')[1];
    } else if (arg.startsWith('--db-url=')) {
      result.dbUrl = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    }
  }
  
  return result;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  // eslint-disable-next-line no-console
  console.log(`
飞书多维表格数据导入脚本

使用方法:
  方式1 - 使用环境变量:
    export FEISHU_ACCESS_TOKEN="your_token"
    export SUDA_DATABASE_URL="postgresql://user:pass@host:port/db"
    npx ts-node server/modules/consumption-record/import-script.ts

  方式2 - 使用命令行参数:
    npx ts-node server/modules/consumption-record/import-script.ts --token="your_token" --db-url="postgresql://..."

  方式3 - 混合使用（命令行参数优先级更高）:
    export SUDA_DATABASE_URL="postgresql://..."
    npx ts-node server/modules/consumption-record/import-script.ts --token="your_token"

参数:
  --token=xxx     飞书访问令牌（或设置 FEISHU_ACCESS_TOKEN 环境变量）
  --db-url=xxx    数据库连接URL（或设置 SUDA_DATABASE_URL 环境变量）
  --help, -h      显示帮助信息
`);
}

/**
 * 调用飞书多维表格 API 获取记录
 */
async function fetchBitableRecords(accessToken: string): Promise<any[]> {
  const logger = new Logger('FeishuAPI');
  const { appToken, tableId } = CONFIG;
  
  const records: any[] = [];
  let pageToken: string | undefined;
  let hasMore = true;
  
  logger.log('开始从飞书多维表格获取数据...');
  logger.log(`App Token: ${appToken}`);
  logger.log(`Table ID: ${tableId}`);
  
  while (hasMore) {
    const requestBody: Record<string, any> = {};
    
    if (pageToken) {
      requestBody.page_token = pageToken;
    }
    
    try {
      const response = await axios.post(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.data.code !== 0) {
        throw new Error(`飞书API错误: ${response.data.msg} (code: ${response.data.code})`);
      }
      
      const data = response.data.data;
      records.push(...(data.items || []));
      
      hasMore = data.has_more === true;
      pageToken = data.page_token;
      
      logger.log(`已获取 ${records.length} 条记录...`);
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('飞书API请求失败:', error.response?.data || error.message);
        throw new Error(`飞书API请求失败: ${error.response?.data?.msg || error.message}`);
      }
      throw error;
    }
  }
  
  logger.log(`数据获取完成，共 ${records.length} 条记录`);
  return records;
}

/**
 * 主导入函数
 */
async function importData() {
  const logger = new Logger('ImportScript');
  
  // 解析命令行参数
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    return;
  }
  
  // 获取配置
  const accessToken = args.token || process.env.FEISHU_ACCESS_TOKEN;
  const dbUrl = args.dbUrl || process.env.SUDA_DATABASE_URL || process.env.DATABASE_URL;
  
  logger.log('========================================');
  logger.log('启动飞书多维表格数据导入脚本');
  logger.log('========================================');
  
  // 验证配置
  if (!accessToken) {
    logger.error('错误: 请设置飞书访问令牌');
    logger.error('方式1: export FEISHU_ACCESS_TOKEN="your_token"');
    logger.error('方式2: --token="your_token"');
    showHelp();
    process.exit(1);
  }
  
  if (!dbUrl) {
    logger.error('错误: 请设置数据库连接URL');
    logger.error('方式1: export SUDA_DATABASE_URL="postgresql://..."');
    logger.error('方式2: --db-url="postgresql://..."');
    showHelp();
    process.exit(1);
  }
  
  // 设置数据库连接环境变量（供 AppModule 使用）
  process.env.SUDA_DATABASE_URL = dbUrl;
  
  // 动态导入 AppModule 和 ConsumptionRecordService
  // 使用动态导入以支持路径别名
  const { AppModule } = await import('../../app.module');
  const { ConsumptionRecordService } = await import('./consumption-record.service');
  
  // 创建 NestJS 应用上下文
  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  } catch (error) {
    logger.error('创建应用上下文失败:', error);
    throw error;
  }
  
  try {
    // 获取服务
    const consumptionRecordService = app.get(ConsumptionRecordService);
    
    // 从飞书获取数据
    const bitableRecords = await fetchBitableRecords(accessToken);
    
    if (!bitableRecords || bitableRecords.length === 0) {
      logger.warn('没有获取到任何记录');
      return;
    }
    
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
          // 处理多选或lookup字段
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
          // 尝试解析字符串日期
          const timestamp = Date.parse(dateRaw);
          recordDate = isNaN(timestamp) ? dateRaw : formatDate(timestamp);
        } else {
          logger.warn(`第 ${index + 1} 条记录日期格式无效，跳过`);
          return null;
        }
        
        // 验证必填字段
        if (!platform || !sku || !recordDate) {
          logger.warn(`第 ${index + 1} 条记录缺少必填字段，跳过: platform=${platform}, sku=${sku}, date=${recordDate}`);
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
    
    if (formattedRecords.length === 0) {
      logger.warn('没有有效的记录可以导入');
      return;
    }
    
    // 显示前10条记录预览
    logger.log('数据预览 (前10条):');
    formattedRecords.slice(0, 10).forEach((r: any, i: number) => {
      logger.log(`  ${i + 1}. ${r.recordDate} | ${r.platform} | ${r.sku} | ¥${r.amount}`);
    });
    
    if (formattedRecords.length > 10) {
      logger.log(`  ... 还有 ${formattedRecords.length - 10} 条记录`);
    }
    
    // 批量保存到数据库
    logger.log('========================================');
    logger.log('开始批量保存到数据库...');
    
    const response = await consumptionRecordService.batchSave({ records: formattedRecords });
    
    logger.log('========================================');
    logger.log('导入完成！');
    logger.log(`总记录数: ${bitableRecords.length}`);
    logger.log(`有效记录数: ${formattedRecords.length}`);
    logger.log(`导入成功: ${response.successCount} 条`);
    logger.log(`导入失败: ${response.failCount} 条`);
    logger.log('========================================');
    
    if (response.errors.length > 0) {
      logger.error('错误详情:');
      response.errors.slice(0, 10).forEach((err) => {
        logger.error(`  第 ${err.row} 行: ${err.message}`);
      });
      if (response.errors.length > 10) {
        logger.error(`  ... 还有 ${response.errors.length - 10} 条错误`);
      }
    }
    
  } catch (error) {
    logger.error('导入过程中发生错误:', error);
    throw error;
  } finally {
    await app.close();
    logger.log('脚本执行完毕');
  }
}

// 执行导入
importData().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('脚本执行失败:', error);
  process.exit(1);
});

import { Controller, Get, Post, Query, Body, Logger, Req } from '@nestjs/common';
import { NeedLogin, CapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import { ConsumptionRecordService } from './consumption-record.service';
import type { Request } from 'express';
import type {
  BatchSaveConsumptionRequest,
  BatchSaveConsumptionResponse,
  GetDailyConsumptionResponse,
  GetConsumptionDetailsResponse,
  ImportFromBitableResponse,
} from '@shared/api.interface';

@Controller('api/consumption-records')
export class ConsumptionRecordController {
  private readonly logger = new Logger(ConsumptionRecordController.name);

  constructor(
    private readonly consumptionRecordService: ConsumptionRecordService,
    private readonly capabilityService: CapabilityService,
  ) {}

  /**
   * 清空所有消耗记录
   * POST /api/consumption-records/clear-all
   */
  @NeedLogin()
  @Post('clear-all')
  async clearAll(): Promise<{ success: boolean; message: string }> {
    try {
      await this.consumptionRecordService.clearAll();
      return { success: true, message: '所有消耗记录已清空' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error('清空数据失败:', errorMessage);
      throw error;
    }
  }

  // 平台工具名称映射表
  private readonly PLATFORM_TOOL_MAP: Record<string, string> = {
    'dou+': '抖音',
    '竞价种草通': '抖音',
    '竞价A3': '抖音',
    '热推': '抖音',
    '二次推广': '微信',
  };

  /**
   * 将工具名称归拢到所属平台
   */
  private normalizePlatform(toolName: string): string {
    return this.PLATFORM_TOOL_MAP[toolName] || toolName;
  }

  /**
   * 批量保存消耗记录
   * POST /api/consumption-records/batch-save
   */
  @NeedLogin()
  @Post('batch-save')
  async batchSave(
    @Body() request: BatchSaveConsumptionRequest,
  ): Promise<BatchSaveConsumptionResponse> {
    return this.consumptionRecordService.batchSave(request);
  }

  /**
   * 获取每日消耗明细
   * GET /api/consumption-records/daily?month=2026-04&platform=&sku=
   */
  @Get('daily')
  async getDailyConsumption(
    @Query('month') month: string,
    @Query('platform') platform?: string,
    @Query('sku') sku?: string,
  ): Promise<GetDailyConsumptionResponse> {
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    return this.consumptionRecordService.getDailyConsumption(month, platform, sku);
  }

  /**
   * 获取消耗明细列表
   * GET /api/consumption-details?month=2026-04&platform=&sku=&page=1&pageSize=20
   */
  @Get('details')
  async getConsumptionDetails(
    @Query('month') month: string,
    @Query('platform') platform?: string,
    @Query('sku') sku?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ): Promise<GetConsumptionDetailsResponse> {
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20;
    return this.consumptionRecordService.getConsumptionDetails(month, platform, sku, page, pageSize);
  }

  /**
   * 从飞书多维表格导入数据（服务端直接调用）
   * POST /api/consumption-records/import-from-bitable
   */
  @NeedLogin()
  @Post('import-from-bitable')
  async importFromBitable(@Req() req: Request): Promise<ImportFromBitableResponse> {
    const PLUGIN_INSTANCE_ID = 'feishu_bitable_import_daily_consumption_data_1';
    const records: Array<{ recordDate: string; platform: string; sku: string; amount: number; bitableRecordId: string }> = [];
    
    try {
      this.logger.log('开始从多维表格获取数据...');
      this.logger.log(`插件实例ID: ${PLUGIN_INSTANCE_ID}`);
      
      // 计算90天前的日期时间戳（毫秒）
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const startTimestamp = ninetyDaysAgo.getTime();
      
      // 调用多维表格插件获取记录，限制最多2页（1000条）避免超时
      let pageToken: string | undefined;
      let hasMore = true;
      let totalCount = 0;
      let pageNum = 0;
      const MAX_PAGES = 2; // 最多获取2页，避免504超时
      
      while (hasMore && pageNum < MAX_PAGES) {
        pageNum++;
        const input: Record<string, unknown> = {
          pageSize: 500,
          pageToken,
          sort: [{ fieldName: '日期', desc: true }], // 降序获取最新数据
          // 明确指定要获取的字段，包括投放目标
          fieldNames: ['日期', '平台', 'SKU', '消耗金额', '投放目标', '序号'],
        };
        
        this.logger.log(`正在获取第 ${pageNum} 页数据...`);
        
        const response = await this.capabilityService.load(PLUGIN_INSTANCE_ID).call(
          'searchRecords',
          input,
        ) as {
          records: Array<{
            id: string;
            record: Record<string, unknown>;
          }>;
          hasMore: boolean;
          pageToken?: string;
          total?: number;
        };
        
        // 移除大数据日志避免性能问题
        
        const { records: pageRecords, hasMore: more, pageToken: nextToken, total } = response;
        
        this.logger.log(`第 ${pageNum} 页获取到 ${pageRecords?.length || 0} 条原始记录, hasMore=${more}, total=${total}`);
        
        if (total !== undefined) {
          totalCount = total;
        }
        
        // 转换数据格式
        for (const item of pageRecords) {
          const record = item.record;
          
          this.logger.debug(`原始记录数据: ${JSON.stringify(record)}`);
          
          // 日期是 Unix 时间戳（毫秒）
          const dateValue = record['日期'] as number;
          if (!dateValue) continue;
          
          // 只处理90天内的数据
          if (dateValue < startTimestamp) continue;
          
          const dateObj = new Date(dateValue);
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          // 平台和产品是 { text: string } 格式
          const platformData = record['平台'] as { text: string } | string | undefined;
          const skuData = record['SKU'] as { text: string } | string | undefined;
          
          // 消耗金额 - 新表格中是 number 类型直接读取
          let amount: number | undefined;
          const rawAmount = record['消耗金额'];
          this.logger.debug(`消耗金额原始值: ${JSON.stringify(rawAmount)}, 类型: ${typeof rawAmount}`);
          
          if (typeof rawAmount === 'number') {
            amount = rawAmount;
          } else if (typeof rawAmount === 'string') {
            const match = rawAmount.match(/[\d.]+/);
            amount = match ? Number(match[0]) : undefined;
          }
          
          // 将SKU转换为字符串（支持 {text: string} 或 string 格式）
          let sku = '';
          if (typeof skuData === 'object' && skuData?.text) {
            sku = skuData.text;
          } else if (typeof skuData === 'string') {
            sku = skuData;
          }
          
          // 平台字段解析（支持 {text: string} 或 string 格式）
          let rawPlatform = '';
          if (typeof platformData === 'object' && platformData?.text) {
            rawPlatform = platformData.text;
          } else if (typeof platformData === 'string') {
            rawPlatform = platformData;
          }
          const platform = this.normalizePlatform(rawPlatform);
          
          this.logger.debug(`解析结果: platform=${platform}, sku=${sku}, amount=${amount}`);
          
          // 获取 Base 表记录 ID（飞书多维表格记录 ID）
          const bitableRecordId = item.id;
          
          // 获取投放目标作为备选平台/SKU（可能是 string[] 或 {text: string}[] 格式）
          const targetData = record['投放目标'];
          let target = '';
          this.logger.log(`投放目标原始数据: ${JSON.stringify(targetData)}, 类型: ${typeof targetData}, 是否数组: ${Array.isArray(targetData)}`);
          if (Array.isArray(targetData) && targetData.length > 0) {
            // 数组格式：可能是字符串数组或对象数组
            const firstItem = targetData[0];
            this.logger.log(`投放目标第一项: ${JSON.stringify(firstItem)}, 类型: ${typeof firstItem}`);
            if (typeof firstItem === 'string') {
              target = firstItem;
            } else if (typeof firstItem === 'object' && firstItem?.text) {
              target = firstItem.text;
            }
          }
          
          // 如果平台为空，使用投放目标或默认值
          const finalPlatform = platform || target || '未知平台';
          this.logger.log(`平台选择: platform='${platform}', target='${target}', finalPlatform='${finalPlatform}'`);
          // 如果SKU为空，使用序号或默认值
          const serialData = record['序号'] as Array<{text: string}> | undefined;
          const serial = serialData?.[0]?.text || '';
          const finalSku = sku || serial || target || '未知SKU';
          
          if (amount !== undefined && amount !== null && bitableRecordId) {
            records.push({
              recordDate: dateStr,
              platform: finalPlatform,
              sku: finalSku,
              amount,
              bitableRecordId,
            });
          } else {
            this.logger.debug(`跳过无效记录: platform=${finalPlatform}, sku=${finalSku}, amount=${amount}, bitableRecordId=${bitableRecordId}`);
          }
        }
        
        hasMore = more;
        pageToken = nextToken;
      }
      
      this.logger.log(`从多维表格获取到 ${records.length} 条有效记录`);
      
      if (records.length === 0) {
        this.logger.warn('未获取到有效记录，可能原因：1) 表格中无数据 2) 字段名称不匹配 3) 查询视图无数据');
        return { 
          successCount: 0, 
          failCount: 0, 
          errors: [{ row: 0, message: '未获取到有效数据，请检查多维表格中是否存在数据，以及字段名称是否正确（日期、平台、SKU、消耗金额）' }] 
        };
      }
      
      // 批量保存到数据库
      const result = await this.consumptionRecordService.batchSave({ records });
      
      this.logger.log(`导入完成: 成功 ${result.successCount} 条, 失败 ${result.failCount} 条`);
      
      return {
        successCount: result.successCount,
        failCount: result.failCount,
        errors: result.errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error('从多维表格导入数据失败:', errorMessage);
      throw error;
    }
  }
}

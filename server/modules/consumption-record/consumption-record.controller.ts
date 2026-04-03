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
    const PLUGIN_INSTANCE_ID = 'feishu_bitable_import_daily_cost_data_1';
    const records: Array<{ recordDate: string; platform: string; sku: string; amount: number }> = [];
    
    try {
      this.logger.log('开始从多维表格获取数据...');
      
      // 调用多维表格插件获取所有记录
      let pageToken: string | undefined;
      let hasMore = true;
      let totalCount = 0;
      
      while (hasMore) {
        const input: Record<string, unknown> = {
          pageSize: 500,
          pageToken,
          sort: [{ fieldName: '日期', desc: false }],
        };
        
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
        
        const { records: pageRecords, hasMore: more, pageToken: nextToken, total } = response;
        
        if (total !== undefined) {
          totalCount = total;
        }
        
        // 转换数据格式
        for (const item of pageRecords) {
          const record = item.record;
          
          // 日期是 Unix 时间戳（毫秒）
          const dateValue = record['日期'] as number;
          if (!dateValue) continue;
          
          const dateObj = new Date(dateValue);
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          // 平台和产品是 { text: string } 格式
          const platformData = record['平台'] as { text: string } | undefined;
          const skuData = record['产品'] as { text: string } | undefined;
          const amount = record['消耗'] as number | undefined;
          
          const rawPlatform = platformData?.text || '';
          const platform = this.normalizePlatform(rawPlatform);
          const sku = skuData?.text || '';
          
          if (platform && sku && amount !== undefined) {
            records.push({
              recordDate: dateStr,
              platform,
              sku,
              amount,
            });
          }
        }
        
        hasMore = more;
        pageToken = nextToken;
      }
      
      this.logger.log(`从多维表格获取到 ${records.length} 条有效记录`);
      
      if (records.length === 0) {
        return { successCount: 0, failCount: 0, errors: [] };
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

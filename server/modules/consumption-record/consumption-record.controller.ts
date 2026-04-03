import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { ConsumptionRecordService } from './consumption-record.service';
import type {
  BatchSaveConsumptionRequest,
  BatchSaveConsumptionResponse,
  GetDailyConsumptionResponse,
  GetConsumptionDetailsResponse,
} from '@shared/api.interface';

@Controller('api/consumption-records')
export class ConsumptionRecordController {
  private readonly logger = new Logger(ConsumptionRecordController.name);

  constructor(private readonly consumptionRecordService: ConsumptionRecordService) {}

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
}

import { Controller, Get, Query, Logger } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import type {
  GetOverviewRequest,
  GetOverviewResponse,
  GetPlatformComparisonRequest,
  GetPlatformComparisonResponse,
  GetSkuProportionRequest,
  GetSkuProportionResponse,
  GetConsumptionTrendRequest,
  GetConsumptionTrendResponse,
} from '@shared/api.interface';

@Controller('api/dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 获取概览核心指标
   * GET /api/dashboard/overview?month=2026-04
   */
  @Get('overview')
  async getOverview(
    @Query('month') month: string,
  ): Promise<GetOverviewResponse> {
    if (!month) {
      // 默认返回当月
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    return this.dashboardService.getOverview(month);
  }

  /**
   * 获取平台预算消耗对比数据
   * GET /api/dashboard/platform-comparison?month=2026-04
   */
  @Get('platform-comparison')
  async getPlatformComparison(
    @Query('month') month: string,
  ): Promise<GetPlatformComparisonResponse> {
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    return this.dashboardService.getPlatformComparison(month);
  }

  /**
   * 获取SKU预算占比数据
   * GET /api/dashboard/sku-proportion?month=2026-04
   */
  @Get('sku-proportion')
  async getSkuProportion(
    @Query('month') month: string,
  ): Promise<GetSkuProportionResponse> {
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    return this.dashboardService.getSkuProportion(month);
  }

  /**
   * 获取消耗趋势数据
   * GET /api/dashboard/consumption-trend?days=30&platform=&sku=
   */
  @Get('consumption-trend')
  async getConsumptionTrend(
    @Query('days') daysStr?: string,
    @Query('platform') platform?: string,
    @Query('sku') sku?: string,
  ): Promise<GetConsumptionTrendResponse> {
    const days = daysStr ? parseInt(daysStr, 10) : 30;
    return this.dashboardService.getConsumptionTrend(days, platform, sku);
  }
}

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { budget, consumptionRecord } from '@server/database/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import type {
  GetOverviewResponse,
  GetPlatformComparisonResponse,
  GetSkuProportionResponse,
  GetConsumptionTrendResponse,
} from '@shared/api.interface';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  /**
   * 获取概览核心指标
   */
  async getOverview(month: string): Promise<GetOverviewResponse> {
    // 获取月度总预算
    const budgetResult = await this.db
      .select({
        totalBudget: sql<number>`COALESCE(SUM(${budget.amount}), 0)`,
      })
      .from(budget)
      .where(eq(budget.month, month));

    const totalBudget = Number(budgetResult[0]?.totalBudget || 0);

    // 获取月度消耗总额
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    // 获取该月最后一天
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

    const consumptionResult = await this.db
      .select({
        consumedAmount: sql<number>`COALESCE(SUM(${consumptionRecord.amount}), 0)`,
      })
      .from(consumptionRecord)
      .where(
        and(
          gte(consumptionRecord.recordDate, startDate),
          lte(consumptionRecord.recordDate, endDate),
        ),
      );

    const consumedAmount = Number(consumptionResult[0]?.consumedAmount || 0);
    const remainingBudget = totalBudget - consumedAmount;
    const completionRate = totalBudget > 0 ? Number(((consumedAmount / totalBudget) * 100).toFixed(2)) : 0;

    return {
      totalBudget,
      consumedAmount,
      completionRate,
      remainingBudget,
    };
  }

  /**
   * 获取平台预算消耗对比数据
   */
  async getPlatformComparison(month: string): Promise<GetPlatformComparisonResponse> {
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    // 获取该月最后一天
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

    // 获取各平台预算
    const budgetData = await this.db
      .select({
        platform: budget.platform,
        budget: sql<number>`SUM(${budget.amount})`,
      })
      .from(budget)
      .where(eq(budget.month, month))
      .groupBy(budget.platform);

    // 获取各平台消耗
    const consumptionData = await this.db
      .select({
        platform: consumptionRecord.platform,
        consumed: sql<number>`SUM(${consumptionRecord.amount})`,
      })
      .from(consumptionRecord)
      .where(
        and(
          gte(consumptionRecord.recordDate, startDate),
          lte(consumptionRecord.recordDate, endDate),
        ),
      )
      .groupBy(consumptionRecord.platform);

    // 合并数据
    const platformMap = new Map<string, { platform: string; budget: number; consumed: number }>();

    for (const item of budgetData) {
      platformMap.set(item.platform, {
        platform: item.platform,
        budget: Number(item.budget),
        consumed: 0,
      });
    }

    for (const item of consumptionData) {
      const existing = platformMap.get(item.platform);
      if (existing) {
        existing.consumed = Number(item.consumed);
      } else {
        platformMap.set(item.platform, {
          platform: item.platform,
          budget: 0,
          consumed: Number(item.consumed),
        });
      }
    }

    return Array.from(platformMap.values());
  }

  /**
   * 获取SKU预算占比数据
   */
  async getSkuProportion(month: string): Promise<GetSkuProportionResponse> {
    // 获取总预算用于计算占比
    const totalBudgetResult = await this.db
      .select({
        total: sql<number>`SUM(${budget.amount})`,
      })
      .from(budget)
      .where(eq(budget.month, month));

    const totalBudget = Number(totalBudgetResult[0]?.total || 1); // 避免除以0

    // 获取各SKU预算
    const skuData = await this.db
      .select({
        sku: budget.sku,
        budget: sql<number>`SUM(${budget.amount})`,
      })
      .from(budget)
      .where(eq(budget.month, month))
      .groupBy(budget.sku);

    return skuData.map((item) => ({
      sku: item.sku,
      budget: Number(item.budget),
      proportion: Number(((Number(item.budget) / totalBudget) * 100).toFixed(2)),
    }));
  }

  /**
   * 获取消耗趋势数据
   */
  async getConsumptionTrend(
    days: number,
    platform?: string,
    sku?: string,
  ): Promise<GetConsumptionTrendResponse> {
    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // 构建查询条件
    const conditions = [
      gte(consumptionRecord.recordDate, startDateStr),
      lte(consumptionRecord.recordDate, endDateStr),
    ];

    if (platform) {
      conditions.push(eq(consumptionRecord.platform, platform));
    }

    if (sku) {
      conditions.push(eq(consumptionRecord.sku, sku));
    }

    // 查询每日消耗
    const trendData = await this.db
      .select({
        date: consumptionRecord.recordDate,
        amount: sql<number>`SUM(${consumptionRecord.amount})`,
      })
      .from(consumptionRecord)
      .where(and(...conditions))
      .groupBy(consumptionRecord.recordDate)
      .orderBy(consumptionRecord.recordDate);

    return trendData.map((item) => ({
      date: item.date,
      amount: Number(item.amount),
    }));
  }
}

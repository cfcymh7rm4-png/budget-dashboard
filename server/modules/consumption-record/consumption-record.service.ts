import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { consumptionRecord } from '@server/database/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import type {
  BatchSaveConsumptionRequest,
  BatchSaveConsumptionResponse,
  GetDailyConsumptionResponse,
  ConsumptionDetailItem,
  GetConsumptionDetailsResponse,
} from '@shared/api.interface';

@Injectable()
export class ConsumptionRecordService {
  private readonly logger = new Logger(ConsumptionRecordService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  /**
   * 批量保存消耗记录（插入或更新）
   */
  async batchSave(request: BatchSaveConsumptionRequest): Promise<BatchSaveConsumptionResponse> {
    const { records } = request;
    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        // 使用 ON CONFLICT DO UPDATE 实现插入或更新
        await this.db.execute(sql`
          INSERT INTO consumption_record (record_date, platform, sku, amount, source)
          VALUES (${record.recordDate}, ${record.platform}, ${record.sku}, ${record.amount}, '多维表格导入')
          ON CONFLICT (record_date, platform, sku)
          DO UPDATE SET
            amount = EXCLUDED.amount,
            source = EXCLUDED.source,
            _updated_at = CURRENT_TIMESTAMP
        `);
        successCount++;
      } catch (error) {
        failCount++;
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        errors.push({ row: i + 1, message: errorMessage });
        this.logger.error(`保存记录失败 [row=${i + 1}]:`, errorMessage);
      }
    }

    return {
      successCount,
      failCount,
      errors,
    };
  }

  /**
   * 获取每日消耗明细
   */
  async getDailyConsumption(
    month: string,
    platform?: string,
    sku?: string,
  ): Promise<GetDailyConsumptionResponse> {
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

    const conditions = [
      gte(consumptionRecord.recordDate, startDate),
      lte(consumptionRecord.recordDate, endDate),
    ];

    if (platform) {
      conditions.push(eq(consumptionRecord.platform, platform));
    }

    if (sku) {
      conditions.push(eq(consumptionRecord.sku, sku));
    }

    const data = await this.db
      .select({
        date: consumptionRecord.recordDate,
        amount: consumptionRecord.amount,
      })
      .from(consumptionRecord)
      .where(and(...conditions))
      .orderBy(consumptionRecord.recordDate);

    return data.map((item) => ({
      date: item.date,
      amount: Number(item.amount),
    }));
  }

  /**
   * 获取分平台分SKU消耗进度列表
   */
  async getConsumptionDetails(
    month: string,
    platform?: string,
    sku?: string,
    page = 1,
    pageSize = 20,
  ): Promise<GetConsumptionDetailsResponse> {
    // 获取预算数据
    const budgetData = await this.db.execute(sql`
      SELECT platform, sku, amount as budget
      FROM budget
      WHERE month = ${month}
      ${platform ? sql`AND platform = ${platform}` : sql``}
      ${sku ? sql`AND sku = ${sku}` : sql``}
    `);

    // 获取消耗数据
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

    const consumptionData = await this.db.execute(sql`
      SELECT platform, sku, SUM(amount) as consumed
      FROM consumption_record
      WHERE record_date >= ${startDate} AND record_date <= ${endDate}
      ${platform ? sql`AND platform = ${platform}` : sql``}
      ${sku ? sql`AND sku = ${sku}` : sql``}
      GROUP BY platform, sku
    `);

    // 合并数据
    const detailsMap = new Map<string, ConsumptionDetailItem>();

    for (const item of budgetData as any[]) {
      const key = `${item.platform}-${item.sku}`;
      detailsMap.set(key, {
        platform: item.platform,
        sku: item.sku,
        budget: Number(item.budget),
        consumed: 0,
        completionRate: 0,
        isAbnormal: false,
      });
    }

    for (const item of consumptionData as any[]) {
      const key = `${item.platform}-${item.sku}`;
      const existing = detailsMap.get(key);
      if (existing) {
        existing.consumed = Number(item.consumed);
        existing.completionRate = existing.budget > 0
          ? Number(((existing.consumed / existing.budget) * 100).toFixed(2))
          : 0;
        existing.isAbnormal = existing.completionRate > 90;
      } else {
        detailsMap.set(key, {
          platform: item.platform,
          sku: item.sku,
          budget: 0,
          consumed: Number(item.consumed),
          completionRate: 100,
          isAbnormal: true,
        });
      }
    }

    const items = Array.from(detailsMap.values());
    const total = items.length;

    // 分页
    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return {
      items: paginatedItems,
      total,
    };
  }
}

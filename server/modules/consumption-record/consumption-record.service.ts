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
   * 清空所有消耗记录
   */
  async clearAll(): Promise<void> {
    await this.db.execute(sql`DELETE FROM consumption_record`);
    this.logger.log('已清空所有消耗记录');
  }

  /**
   * 批量保存消耗记录（插入或更新）
   * 使用原始 SQL 批量插入优化性能
   */
  async batchSave(request: BatchSaveConsumptionRequest): Promise<BatchSaveConsumptionResponse> {
    const { records } = request;
    
    if (records.length === 0) {
      return { successCount: 0, failCount: 0, errors: [] };
    }

    try {
      // 分批处理，每批500条
      const BATCH_SIZE = 500;
      let successCount = 0;
      
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        
        // 分离有 bitableRecordId 和没有的记录
        const withId = batch.filter(r => r.bitableRecordId);
        const withoutId = batch.filter(r => !r.bitableRecordId);
        
        // 1. 处理有 bitableRecordId 的记录 - 使用 INSERT ... ON CONFLICT DO UPDATE
        if (withId.length > 0) {
          const valuesClause = withId.map(r => 
            `('${r.recordDate}', '${r.platform.replace(/'/g, "''")}', '${r.sku.replace(/'/g, "''")}', ${r.amount}, '多维表格导入', '${r.bitableRecordId}')`
          ).join(',');
          
          const query = `
            INSERT INTO consumption_record (record_date, platform, sku, amount, source, bitable_record_id)
            VALUES ${valuesClause}
            ON CONFLICT (bitable_record_id) WHERE bitable_record_id IS NOT NULL
            DO UPDATE SET
              record_date = EXCLUDED.record_date,
              platform = EXCLUDED.platform,
              sku = EXCLUDED.sku,
              amount = EXCLUDED.amount,
              source = EXCLUDED.source,
              _updated_at = CURRENT_TIMESTAMP
          `;
          
          await this.db.execute(sql.raw(query));
        }
        
        // 2. 处理没有 bitableRecordId 的记录 - 直接 INSERT
        if (withoutId.length > 0) {
          const valuesClause = withoutId.map(r => 
            `('${r.recordDate}', '${r.platform.replace(/'/g, "''")}', '${r.sku.replace(/'/g, "''")}', ${r.amount}, '多维表格导入', NULL)`
          ).join(',');
          
          const query = `
            INSERT INTO consumption_record (record_date, platform, sku, amount, source, bitable_record_id)
            VALUES ${valuesClause}
          `;
          
          await this.db.execute(sql.raw(query));
        }
        
        successCount += batch.length;
      }

      this.logger.log(`批量保存完成: 成功 ${successCount} 条`);
      
      return {
        successCount,
        failCount: 0,
        errors: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error('批量保存失败:', errorMessage);
      this.logger.error('错误堆栈:', errorStack);
      return {
        successCount: 0,
        failCount: records.length,
        errors: [{ row: 0, message: errorMessage }],
      };
    }
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

    // 使用 SQL 按日期聚合数据
    const aggregationQuery = sql`
      SELECT 
        record_date as date,
        SUM(amount) as amount
      FROM consumption_record
      WHERE record_date >= ${startDate} AND record_date <= ${endDate}
      ${platform ? sql`AND platform = ${platform}` : sql``}
      ${sku ? sql`AND sku = ${sku}` : sql``}
      GROUP BY record_date
      ORDER BY record_date
    `;

    const data = await this.db.execute(aggregationQuery);

    return (data as any[]).map((item) => ({
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

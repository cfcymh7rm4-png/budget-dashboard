import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { budget } from '@server/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import type {
  GetBudgetsResponse,
  SaveBudgetsRequest,
  SaveBudgetsResponse,
  BatchAllocateRequest,
  BatchAllocateResponse,
  Budget,
} from '@shared/api.interface';

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  /**
   * 获取指定月份预算配置列表
   */
  async getBudgets(month: string): Promise<GetBudgetsResponse> {
    // 获取该月总预算用于计算占比
    const totalResult = await this.db
      .select({
        total: sql<number>`SUM(${budget.amount})`,
      })
      .from(budget)
      .where(eq(budget.month, month));

    const total = Number(totalResult[0]?.total || 1);

    // 获取预算列表
    const budgets = await this.db
      .select({
        id: budget.id,
        month: budget.month,
        platform: budget.platform,
        sku: budget.sku,
        amount: budget.amount,
      })
      .from(budget)
      .where(eq(budget.month, month));

    return budgets.map((item) => ({
      id: item.id,
      month: item.month,
      platform: item.platform,
      sku: item.sku,
      amount: Number(item.amount),
      proportion: Number(((Number(item.amount) / total) * 100).toFixed(2)),
    }));
  }

  /**
   * 保存预算配置
   */
  async saveBudgets(request: SaveBudgetsRequest): Promise<SaveBudgetsResponse> {
    const { month, records } = request;

    for (const record of records) {
      await this.db.execute(sql`
        INSERT INTO budget (month, platform, sku, amount)
        VALUES (${month}, ${record.platform}, ${record.sku}, ${record.amount})
        ON CONFLICT (month, platform, sku)
        DO UPDATE SET
          amount = EXCLUDED.amount,
          _updated_at = CURRENT_TIMESTAMP
      `);
    }

    return { success: true };
  }

  /**
   * 按比例批量分配预算
   */
  async batchAllocate(request: BatchAllocateRequest): Promise<BatchAllocateResponse> {
    const { month, platformTotal, skuRatio } = request;
    const results: Budget[] = [];

    // 计算每个平台每个SKU的预算
    for (const [platform, totalAmount] of Object.entries(platformTotal)) {
      for (const [sku, ratio] of Object.entries(skuRatio)) {
        const amount = Math.round((totalAmount * ratio) / 100);

        await this.db.execute(sql`
          INSERT INTO budget (month, platform, sku, amount)
          VALUES (${month}, ${platform}, ${sku}, ${amount})
          ON CONFLICT (month, platform, sku)
          DO UPDATE SET
            amount = EXCLUDED.amount,
            _updated_at = CURRENT_TIMESTAMP
        `);

        results.push({
          month,
          platform,
          sku,
          amount,
        });
      }
    }

    return results;
  }
}

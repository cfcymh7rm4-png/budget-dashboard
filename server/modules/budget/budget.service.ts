import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { budget } from '@server/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import type {
  BudgetWithProportion,
  SaveBudgetsRequest,
  SaveBudgetsResponse,
  BatchAllocateRequest,
  BatchAllocateResponse,
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
  async getBudgets(month: string): Promise<BudgetWithProportion[]> {
    // 获取该月总预算
    const totalResult = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${budget.amount}), 0)`,
      })
      .from(budget)
      .where(eq(budget.month, month));

    const total = Number(totalResult[0]?.total || 1); // 避免除以0

    // 获取各SKU预算
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
      proportion: total > 0 ? Number(((Number(item.amount) / total) * 100).toFixed(2)) : 0,
    }));
  }

  /**
   * 保存预算配置（批量插入或更新）
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
   * 每个SKU单独配置平台分配比例
   */
  async batchAllocate(request: BatchAllocateRequest): Promise<BatchAllocateResponse> {
    const { month, skuTotal, platformRatio } = request;
    const results: Array<{ month: string; platform: string; sku: string; amount: number }> = [];

    // 遍历每个SKU
    for (const [skuName, skuAmount] of Object.entries(skuTotal)) {
      if (skuAmount <= 0) continue;

      // 获取该SKU的平台比例配置
      const skuPlatformRatios = platformRatio[skuName] || {};
      
      // 计算该SKU在各平台的分配
      for (const [platformName, ratio] of Object.entries(skuPlatformRatios)) {
        if (ratio <= 0) continue;

        const amount = Math.round(skuAmount * ratio * 100) / 100;

        await this.db.execute(sql`
          INSERT INTO budget (month, platform, sku, amount)
          VALUES (${month}, ${platformName}, ${skuName}, ${amount})
          ON CONFLICT (month, platform, sku)
          DO UPDATE SET
            amount = EXCLUDED.amount,
            _updated_at = CURRENT_TIMESTAMP
        `);

        results.push({ month, platform: platformName, sku: skuName, amount });
      }
    }

    return results;
  }
}

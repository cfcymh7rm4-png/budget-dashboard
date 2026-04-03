import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { BudgetService } from './budget.service';
import type {
  GetBudgetsRequest,
  GetBudgetsResponse,
  SaveBudgetsRequest,
  SaveBudgetsResponse,
  BatchAllocateRequest,
  BatchAllocateResponse,
} from '@shared/api.interface';

@Controller('api/budgets')
export class BudgetController {
  private readonly logger = new Logger(BudgetController.name);

  constructor(private readonly budgetService: BudgetService) {}

  /**
   * 获取指定月份预算配置
   * GET /api/budgets?month=2026-04
   */
  @Get()
  async getBudgets(
    @Query('month') month: string,
  ): Promise<GetBudgetsResponse> {
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    return this.budgetService.getBudgets(month);
  }

  /**
   * 保存预算配置
   * POST /api/budgets
   */
  @NeedLogin()
  @Post()
  async saveBudgets(
    @Body() request: SaveBudgetsRequest,
  ): Promise<SaveBudgetsResponse> {
    return this.budgetService.saveBudgets(request);
  }

  /**
   * 按比例批量分配预算
   * POST /api/budgets/batch-allocate
   */
  @NeedLogin()
  @Post('batch-allocate')
  async batchAllocate(
    @Body() request: BatchAllocateRequest,
  ): Promise<BatchAllocateResponse> {
    return this.budgetService.batchAllocate(request);
  }
}

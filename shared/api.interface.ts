/* 前后端共享的类型定义 */

// ==================== 基础类型 ====================
export type Platform = '抖音' | 'B站' | '小红书' | '微博' | '微信' | '知乎';
export type Sku = '吹风机' | '剃须刀' | '牙刷' | '化妆镜' | '卷发棒' | '大路灯';

export const PLATFORMS: Platform[] = ['抖音', 'B站', '小红书', '微博', '微信', '知乎'];
export const SKUS: Sku[] = ['吹风机', '剃须刀', '牙刷', '化妆镜', '卷发棒', '大路灯'];

// ==================== 预算配置模块 ====================
export interface Budget {
  id?: string;
  month: string;
  platform: string;
  sku: string;
  amount: number;
}

export interface BudgetWithProportion extends Budget {
  proportion: number;
}

export interface GetBudgetsRequest {
  month: string;
}

export type GetBudgetsResponse = BudgetWithProportion[];

export interface SaveBudgetsRequest {
  month: string;
  records: Array<{
    platform: string;
    sku: string;
    amount: number;
  }>;
}

export interface SaveBudgetsResponse {
  success: boolean;
}

export interface BatchAllocateRequest {
  month: string;
  skuTotal: Record<string, number>;
  platformRatio: Record<string, number>;
}

export type BatchAllocateResponse = Budget[];

// ==================== 消耗记录模块 ====================
export interface ConsumptionRecord {
  id?: string;
  recordDate: string;
  platform: string;
  sku: string;
  amount: number;
  source?: string;
  bitableRecordId?: string;
}

export interface BatchSaveConsumptionRequest {
  records: Array<{
    recordDate: string;
    platform: string;
    sku: string;
    amount: number;
    bitableRecordId?: string;
  }>;
}

export interface BatchSaveConsumptionResponse {
  successCount: number;
  failCount: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

export interface GetDailyConsumptionRequest {
  month: string;
  platform?: string;
  sku?: string;
}

export interface DailyConsumption {
  date: string;
  amount: number;
}

export type GetDailyConsumptionResponse = DailyConsumption[];

// ==================== Dashboard 概览模块 ====================
export interface GetOverviewRequest {
  month: string;
}

export interface GetOverviewResponse {
  totalBudget: number;
  consumedAmount: number;
  completionRate: number;
  remainingBudget: number;
}

export interface GetPlatformComparisonRequest {
  month: string;
}

export interface PlatformComparisonItem {
  platform: string;
  budget: number;
  consumed: number;
}

export type GetPlatformComparisonResponse = PlatformComparisonItem[];

export interface GetSkuProportionRequest {
  month: string;
}

export interface SkuProportionItem {
  sku: string;
  budget: number;
  proportion: number;
}

export type GetSkuProportionResponse = SkuProportionItem[];

export interface GetConsumptionTrendRequest {
  days?: number;
  platform?: string;
  sku?: string;
}

export interface ConsumptionTrendItem {
  date: string;
  amount: number;
}

export type GetConsumptionTrendResponse = ConsumptionTrendItem[];

// ==================== 消耗明细列表模块 ====================
export interface GetConsumptionDetailsRequest {
  month: string;
  platform?: string;
  sku?: string;
  page?: number;
  pageSize?: number;
}

export interface ConsumptionDetailItem {
  platform: string;
  sku: string;
  budget: number;
  consumed: number;
  completionRate: number;
  isAbnormal: boolean;
}

export interface GetConsumptionDetailsResponse {
  items: ConsumptionDetailItem[];
  total: number;
}

// ==================== 多维表格导入相关 ====================
export interface FeishuBitableRecord {
  recordId: string;
  fields: Record<string, any>;
}

export interface ImportFromBitableRequest {
  month: string;
}

export interface ImportFromBitableResponse {
  successCount: number;
  failCount: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

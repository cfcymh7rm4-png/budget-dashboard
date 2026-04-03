import { useState, useCallback } from 'react';
import { capabilityClient } from '@lark-apaas/client-toolkit';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  FeishuBitableImportDailyCostData1Output,
  FeishuBitableImportDailyCostData1Input,
} from '@shared/plugin-types';
import type { ConsumptionRecord, BatchSaveConsumptionResponse } from '@shared/api.interface';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { toast } from 'sonner';

const PLUGIN_INSTANCE_ID = 'feishu_bitable_import_daily_cost_data_1';

// 平台工具名称映射表：将具体工具归拢到所属大平台
const PLATFORM_TOOL_MAP: Record<string, string> = {
  // 抖音系工具
  'dou+': '抖音',
  '竞价种草通': '抖音',
  '竞价A3': '抖音',
  '热推': '抖音',
  // 微信系工具
  '二次推广': '微信',
};

/**
 * 将工具名称归拢到所属平台
 * 例如：dou+ → 抖音，二次推广 → 微信
 */
function normalizePlatform(toolName: string): string {
  return PLATFORM_TOOL_MAP[toolName] || toolName;
}

export interface ImportProgress {
  status: 'idle' | 'fetching' | 'saving' | 'completed' | 'error';
  total: number;
  processed: number;
  successCount: number;
  failCount: number;
  errors: Array<{ row: number; message: string }>;
}

export interface UseBitableImportReturn {
  progress: ImportProgress;
  isImporting: boolean;
  importData: (month: string) => Promise<void>;
  reset: () => void;
}

/**
 * 从飞书多维表格导入每日消耗数据
 * Schema 摘录卡:
 * - pluginInstanceId: feishu_bitable_import_daily_cost_data_1
 * - actionKey: searchRecords
 * - outputMode: unary
 * - input.required: []
 * - output.fields: [
 *     records: Array<{
 *       id: string,
 *       record: {
 *         日期: number (Unix时间戳毫秒),
 *         平台: { text: string },
 *         产品: { text: string },  // 对应SKU
 *         消耗: number             // 对应消耗金额
 *       }
 *     }>,
 *     hasMore: boolean,
 *     total: number,
 *     pageToken?: string
 *   ]
 * - 调用侧: Client
 */
export function useBitableImport(): UseBitableImportReturn {
  const [progress, setProgress] = useState<ImportProgress>({
    status: 'idle',
    total: 0,
    processed: 0,
    successCount: 0,
    failCount: 0,
    errors: [],
  });

  const reset = useCallback(() => {
    setProgress({
      status: 'idle',
      total: 0,
      processed: 0,
      successCount: 0,
      failCount: 0,
      errors: [],
    });
  }, []);

  const fetchAllRecords = useCallback(async (): Promise<ConsumptionRecord[]> => {
    const records: ConsumptionRecord[] = [];
    let pageToken: string | undefined;
    let hasMore = true;
    let total = 0;

    while (hasMore) {
      const input: FeishuBitableImportDailyCostData1Input = {
        pageSize: 500,
        pageToken,
        sort: [{ fieldName: '日期', desc: false }],
      };

      const response = await capabilityClient
        .load(PLUGIN_INSTANCE_ID)
        .call<FeishuBitableImportDailyCostData1Output>('searchRecords', input as Record<string, unknown>);

      // 按 outputSchema 解析返回结果
      const { records: pageRecords, hasMore: more, pageToken: nextToken, total: responseTotal } = response;

      if (responseTotal !== undefined) {
        total = responseTotal;
      }

      // 转换数据格式
      for (const item of pageRecords) {
        const record = item.record;
        logger.debug('多维表格原始记录:', JSON.stringify(record));

        // 日期是 Unix 时间戳（毫秒），转换为 YYYY-MM-DD 格式（使用本地时间避免时区偏差）
        const dateValue = record['日期'];
        if (!dateValue) {
          logger.warn('记录缺少日期字段');
          continue;
        }
        const dateObj = new Date(dateValue);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // 平台和 SKU 是 { text: string } 格式
        // 字段映射：平台->平台, 产品->SKU, 消耗->消耗金额
        const platformData = record['平台'] as { text: string } | undefined;
        const skuData = record['产品'] as { text: string } | undefined;
        const amount = record['消耗'] as number | undefined;

        // 将工具名称归拢到所属大平台（如 dou+ → 抖音）
        const rawPlatform = platformData?.text || '';
        const platform = normalizePlatform(rawPlatform);
        const sku = skuData?.text || '';

        logger.debug(`解析结果: 日期=${dateStr}, 平台=${platform}, SKU=${sku}, 金额=${amount}`);

        if (!platform) {
          logger.warn('记录缺少平台字段');
          continue;
        }
        if (!sku) {
          logger.warn('记录缺少产品字段(SKU)');
          continue;
        }
        if (amount === undefined || amount === null) {
          logger.warn('记录缺少消耗字段(消耗金额)');
          continue;
        }

        records.push({
          recordDate: dateStr,
          platform,
          sku,
          amount,
          source: '多维表格导入',
        });
      }

      hasMore = more;
      pageToken = nextToken;

      setProgress((prev) => ({
        ...prev,
        total: total || records.length,
        processed: records.length,
      }));
    }

    return records;
  }, []);

  const saveRecords = useCallback(async (records: ConsumptionRecord[]): Promise<BatchSaveConsumptionResponse> => {
    const response = await axiosForBackend.post<BatchSaveConsumptionResponse>(
      '/api/consumption-records/batch-save',
      { records }
    );
    return response.data;
  }, []);

  const importData = useCallback(async (month: string) => {
    setProgress({
      status: 'fetching',
      total: 0,
      processed: 0,
      successCount: 0,
      failCount: 0,
      errors: [],
    });

    try {
      logger.info('开始从多维表格获取数据...');
      const records = await fetchAllRecords();

      if (records.length === 0) {
        toast.info('多维表格中没有数据');
        setProgress((prev) => ({ ...prev, status: 'completed' }));
        return;
      }

      logger.info(`获取到 ${records.length} 条记录，开始保存...`);
      setProgress((prev) => ({ ...prev, status: 'saving' }));

      const result = await saveRecords(records);

      setProgress({
        status: 'completed',
        total: records.length,
        processed: records.length,
        successCount: result.successCount,
        failCount: result.failCount,
        errors: result.errors,
      });

      if (result.failCount === 0) {
        toast.success(`成功导入 ${result.successCount} 条数据`);
      } else {
        toast.warning(`导入完成：成功 ${result.successCount} 条，失败 ${result.failCount} 条`);
      }

      logger.info(`数据导入完成: 成功${result.successCount}条, 失败${result.failCount}条`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`导入数据失败: ${errorMessage}`);
      setProgress((prev) => ({
        ...prev,
        status: 'error',
        errors: [...prev.errors, { row: 0, message: errorMessage }],
      }));
      toast.error(`导入失败: ${errorMessage}`);
      throw error;
    }
  }, [fetchAllRecords, saveRecords]);

  return {
    progress,
    isImporting: progress.status === 'fetching' || progress.status === 'saving',
    importData,
    reset,
  };
}

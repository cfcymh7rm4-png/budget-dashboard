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
 *         SKU: { text: string },
 *         消耗金额: number
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
        // 日期是 Unix 时间戳（毫秒），转换为 YYYY-MM-DD 格式
        const dateObj = new Date(record['日期']);
        const dateStr = dateObj.toISOString().split('T')[0];

        // 平台和 SKU 是 { text: string } 格式
        const platform = (record['平台'] as { text: string })?.text || '';
        const sku = (record['SKU'] as { text: string })?.text || '';
        const amount = record['消耗金额'] as number;

        if (platform && sku && amount !== undefined) {
          records.push({
            recordDate: dateStr,
            platform,
            sku,
            amount,
            source: '多维表格导入',
          });
        }
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

import { useState, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { ConsumptionRecord, BatchSaveConsumptionResponse } from '@shared/api.interface';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { toast } from 'sonner';

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
 * - 字段映射说明:
 *   | 多维表格字段 | 妙搭字段 | 类型 |
 *   |-------------|---------|------|
 *   | 日期 | recordDate | string (YYYY-MM-DD) |
 *   | 平台 | platform | string |
 *   | SKU | sku | string |
 *   | 消耗金额 | amount | number |
 * - output.fields: [
 *     records: Array<{
 *       id: string,
 *       record: {
 *         日期: number (Unix时间戳毫秒),
 *         平台: { text: string },
 *         SKU: { text: string },
 *         消耗金额: { text: string },  // 金额文本，如 "¥1000" 或 "1000.00"
 *         序号: { text: string },
 *         SourceID: { text: string },
 *         投放目标: { text: string },
 *         运营: { text: string }
 *       }
 *     }>,
 *     hasMore: boolean,
 *     total: number,
 *     pageToken?: string
 *   ]
 * - 调用侧: Server (通过 /api/consumption-records/import-from-bitable)
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
    // 使用新的服务端接口直接导入数据
    const response = await axiosForBackend.post<BatchSaveConsumptionResponse>(
      '/api/consumption-records/import-from-bitable',
      {},
    );
    
    // 服务端接口直接完成导入，返回结果
    setProgress((prev) => ({
      ...prev,
      total: response.data.successCount + response.data.failCount,
      processed: response.data.successCount + response.data.failCount,
    }));
    
    // 返回空数组，因为数据已经在服务端保存
    return [];
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

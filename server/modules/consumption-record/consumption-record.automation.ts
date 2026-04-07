import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase, CapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import { Automation, BindTrigger } from '@lark-apaas/fullstack-nestjs-core';
import { sql } from 'drizzle-orm';

const PLUGIN_INSTANCE_ID = 'feishu_bitable_import_daily_consumption_data_1';

@Automation()
@Injectable()
export class ConsumptionRecordAutomationService {
  private readonly logger = new Logger(ConsumptionRecordAutomationService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly capabilityService: CapabilityService,
  ) {}

  @BindTrigger('sync_bitable_consumption')
  async syncFromBitable() {
    this.logger.log('开始从多维表格同步消耗数据...');
    
    const records: Array<{
      recordDate: string;
      platform: string;
      sku: string;
      amount: number;
      bitableRecordId: string;
    }> = [];

    try {
      // 计算30天前的日期时间戳（毫秒）
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startTimestamp = thirtyDaysAgo.getTime();

      // 调用多维表格插件获取记录，限制最多5页（2500条）
      let pageToken: string | undefined;
      let hasMore = true;
      let pageNum = 0;
      const MAX_PAGES = 5;

      while (hasMore && pageNum < MAX_PAGES) {
        pageNum++;
        const input: Record<string, unknown> = {
          pageSize: 500,
          pageToken,
          sort: [{ fieldName: '日期', desc: true }],
        };

        this.logger.log(`正在获取第 ${pageNum} 页数据...`);

        const response = await this.capabilityService
          .load(PLUGIN_INSTANCE_ID)
          .call('searchRecords', input);

        const result = response as {
          records?: Array<{
            id: string;
            record: Record<string, unknown>;
          }>;
          hasMore?: boolean;
          pageToken?: string;
          total?: number;
        };

        const pageRecords = result.records || [];
        hasMore = result.hasMore || false;
        pageToken = result.pageToken;

        this.logger.log(`第 ${pageNum} 页获取到 ${pageRecords.length} 条记录`);

        // 转换数据格式
        for (const item of pageRecords) {
          const record = item.record;

          // 日期是 Unix 时间戳（毫秒）
          const dateValue = record['日期'] as number;
          if (!dateValue) continue;

          // 只处理30天内的数据
          if (dateValue < startTimestamp) continue;

          const dateObj = new Date(dateValue);
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          // 平台和产品是 { text: string } 格式
          const platformData = record['平台'] as { text: string } | undefined;
          const skuData = record['SKU'] as { text: string } | undefined;

          // 消耗金额是 { text: string } 格式，需要从 text 中解析数字
          let amount: number | undefined;
          const rawAmountData = record['消耗金额'] as { text: string } | undefined;
          if (rawAmountData && typeof rawAmountData === 'object' && 'text' in rawAmountData) {
            const amountText = rawAmountData.text;
            const match = amountText.match(/[\d.]+/);
            amount = match ? Number(match[0]) : undefined;
          }

          const sku = skuData?.text || '';
          const platform = platformData?.text || '';
          const bitableRecordId = item.id;

          if (platform && sku && amount !== undefined && amount !== null && bitableRecordId) {
            records.push({
              recordDate: dateStr,
              platform,
              sku,
              amount,
              bitableRecordId,
            });
          }
        }
      }

      this.logger.log(`共解析到 ${records.length} 条有效记录，开始保存...`);

      // 批量保存数据
      let successCount = 0;
      let failCount = 0;

      for (const record of records) {
        try {
          await this.db.execute(sql`
            INSERT INTO consumption_record (record_date, platform, sku, amount, source, bitable_record_id)
            VALUES (${record.recordDate}, ${record.platform}, ${record.sku}, ${record.amount}, '多维表格同步', ${record.bitableRecordId})
            ON CONFLICT (bitable_record_id)
            DO UPDATE SET
              record_date = EXCLUDED.record_date,
              platform = EXCLUDED.platform,
              sku = EXCLUDED.sku,
              amount = EXCLUDED.amount,
              source = EXCLUDED.source,
              _updated_at = CURRENT_TIMESTAMP
          `);
          successCount++;
        } catch (error) {
          failCount++;
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          this.logger.error(`保存记录失败: ${errorMessage}`);
        }
      }

      this.logger.log(`同步完成: 成功 ${successCount} 条, 失败 ${failCount} 条`);
    } catch (error) {
      this.logger.error('同步多维表格数据失败:', error);
      throw error;
    }
  }

  /**
   * 每天中午12点自动从多维表格导入数据
   */
  @BindTrigger('daily_bitable_import')
  async dailyImportFromBitable() {
    this.logger.log('开始执行每日定时导入任务...');
    await this.syncFromBitable();
    this.logger.log('每日定时导入任务执行完成');
  }
}

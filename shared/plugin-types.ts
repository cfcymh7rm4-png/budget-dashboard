// ---- plugin:feishu_bitable_import_daily_cost_data_1 ----
// ============================================================
// 插件 feishu_bitable_import_daily_cost_data_1 (从飞书多维表格导入每日消耗数据) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface FeishuBitableImportDailyCostData1Input {
  /** 分页标记，第一次请求不填，表示从头开始遍历；分页查询结果还有更多项时会同时返回新的 pageToken */
  pageToken?: string;
  /** 分页大小，最大值为 500 */
  pageSize?: number;
  /** 指定返回的字段名称列表，如果不填默认返回所有字段 */
  fieldNames?: string[];
  /** 排序条件列表，支持多重排序 */
  sort?: {
  fieldName: string;
  desc: boolean;
}[];
  /** 筛选条件,严格参考“筛选条件说明”填写 */
  filter?: {
  conjunction: string;
  conditions: {
  value: string[];
  fieldName: string;
  operator: string;
}[];
};
}

export interface FeishuBitableImportDailyCostData1Output {
  /** 记录列表 */
  records: {
  id: string;
  record: {
  消耗: number;
  日期: number;
  平台: {
  text: string;
};
  产品: {
  text: string;
};
};
}[];
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 下一页的分页标记 */
  pageToken?: string;
  /** 总记录数 */
  total?: number;
}
// ---- end:feishu_bitable_import_daily_cost_data_1 ----
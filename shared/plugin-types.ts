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
  SourceID: {
  text: string;
};
  日期: number;
  平台: unknown;
  SKU: unknown;
  消耗金额: unknown;
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

// ---- plugin:feishu_bitable_connect_sales_cost_data_1 ----
// ============================================================
// 插件 feishu_bitable_connect_sales_cost_data_1 (连接销售消耗数据多维表格) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface FeishuBitableConnectSalesCostData1AggregatequeryInput {
  /** 分页大小，最大值为 5000 */
  pageSize?: number;
  /** 排序条件列表 */
  sort?: {
  fieldName: string;
  desc: boolean;
}[];
  /** 筛选条件,严格参考”筛选条件说明”填写 */
  filter?: {
  conditions: {
  operator: string;
  value: string[];
  fieldName: string;
}[];
  conjunction: string;
};
  /** 是否展开数组维度。开启后，数组类型的维度值（如多选 ["标签1", "标签2"]）会被拆分为独立的行（["标签1"] ["标签2"]） */
  expandArrayDimension?: boolean;
  /** 聚合维度，用于分组的字段 */
  dimensions?: string[];
  /** 用于聚合计算的字段列表 */
  measures?: {
  fieldName: string;
  aggregation: string;
  alias: string;
}[];
  /** 分页标记，第一次请求不填，表示从头开始遍历 */
  pageToken?: string;
}

export interface FeishuBitableConnectSalesCostData1AggregatequeryOutput {
  /** 聚合查询结果,每一个元素都是一个聚合项 */
  result: {

}[];
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 下一页的分页标记 */
  pageToken?: string;
}

export interface FeishuBitableConnectSalesCostData1BatchaddrecordsInput {
  /** 要新增的记录列表，最多 500 条 */
  records: {
  record: {
  SKU: string;
  消耗金额: number;
  日期: number;
  平台: string;
};
}[];
}

export interface FeishuBitableConnectSalesCostData1BatchaddrecordsOutput {
  /** 新增成功的记录列表 */
  records: {
  id: string;
}[];
}

export interface FeishuBitableConnectSalesCostData1BatchupdaterecordsInput {
  /** 要更新的记录列表，最多 500 条 */
  records: {
  id: string;
  record: {
  日期: number;
  平台: string;
  SKU: string;
  消耗金额: number;
};
}[];
}

export interface FeishuBitableConnectSalesCostData1BatchupdaterecordsOutput {
  /** 更新成功的记录列表 */
  records: {
  id: string;
}[];
}

export interface FeishuBitableConnectSalesCostData1DeleterecordsInput {
  /** 要删除的记录ID列表，最多 500 条 */
  recordIDs: string[];
}

export interface FeishuBitableConnectSalesCostData1DeleterecordsOutput {
  /** 是否删除成功 */
  success: boolean;
}

export interface FeishuBitableConnectSalesCostData1GetrecordInput {
  /** 记录ID */
  recordID: string;
}

export interface FeishuBitableConnectSalesCostData1GetrecordOutput {
  /** 记录ID */
  id: string;
  /** 记录内容,如果记录不存在,则为空 */
  record?: {
  日期: number;
  平台: {
  text: string;
};
  SKU: unknown;
  消耗金额: number;
};
}

export interface FeishuBitableConnectSalesCostData1SearchrecordsInput {
  /** 排序条件列表，支持多重排序 */
  sort?: {
  fieldName: string;
  desc: boolean;
}[];
  /** 筛选条件,严格参考“筛选条件说明”填写 */
  filter?: {
  conjunction: string;
  conditions: {
  fieldName: string;
  operator: string;
  value: string[];
}[];
};
  /** 分页标记，第一次请求不填，表示从头开始遍历；分页查询结果还有更多项时会同时返回新的 pageToken */
  pageToken?: string;
  /** 分页大小，最大值为 500 */
  pageSize?: number;
  /** 指定返回的字段名称列表，如果不填默认返回所有字段 */
  fieldNames?: string[];
}

export interface FeishuBitableConnectSalesCostData1SearchrecordsOutput {
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 下一页的分页标记 */
  pageToken?: string;
  /** 总记录数 */
  total?: number;
  /** 记录列表 */
  records: {
  id: string;
  record: {
  日期: number;
  平台: {
  text: string;
};
  SKU: unknown;
  消耗金额: number;
};
}[];
}
// ---- end:feishu_bitable_connect_sales_cost_data_1 ----
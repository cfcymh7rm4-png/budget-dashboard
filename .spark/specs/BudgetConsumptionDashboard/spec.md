# 技术方案

## 开发元信息

- 开发模式: 全栈应用
- 涉及层级: [数据库, 插件, 服务端, 前端]

## 页面路由与导航

### 页面路由

| 页面名称 | 路由路径 | 说明 |
|---------|---------|------|
| 预算消耗概览看板 | / | 首页，默认展示当月数据 |
| 消耗明细列表页 | /consumption-details | 多维度筛选查看消耗明细 |
| 预算配置页 | /budget-config | 月度预算分配与调整 |

### 导航设计

- 导航机制：页面路由
- 导航项：
  - 预算概览
  - 消耗明细
  - 预算配置

## 业务组件

| 组件 | 来源 | 关联页面 | 对应功能点 |
|------|------|---------|-----------|
| Table | `@lark-apaas/client-toolkit/antd-table` | 消耗明细列表页 | 展示分平台分SKU消耗进度列表 |

## 数据模型

### 数据库设计

#### 预算配置表（budget）
用途：存储每个月度各平台各SKU的预算分配金额。
核心字段：
- month: varchar(7) (月度，格式YYYY-MM)
- platform: varchar(32) (平台：抖音/B站/小红书/微博/微信/知乎)
- sku: varchar(32) (SKU：吹风机/剃须刀/牙刷/化妆镜/卷发棒/大路灯)
- amount: numeric(10,2) (预算金额)
- 唯一约束：month + platform + sku 联合唯一

#### 消耗记录表（consumption_record）
用途：存储每日各平台各SKU的实际消耗数据。
核心字段：
- record_date: date (消耗日期)
- platform: varchar(32) (平台)
- sku: varchar(32) (SKU)
- amount: numeric(10,2) (消耗金额)
- source: varchar(32) (数据来源：多维表格导入)
- 唯一约束：record_date + platform + sku 联合唯一

## 插件设计

| 插件名称 | 基础插件 | 用途 | 调用方式 | 关联页面 | 输入参数 | 输出类型 |
|---------|---------|------|---------|---------|---------|---------|
| 每日消耗数据导入 | feishu-bitable | 从指定飞书多维表格拉取每日消耗数据 | 前端 call | 预算消耗概览看板 | {pageSize?: number, pageToken?: string} | {records: Array<{record: object}>, hasMore: boolean, total: number} |

## 业务模型

### API 设计

#### 预算消耗概览看板 相关

**页面路径**: /

**功能全景**：
| 功能 | 实现方式 | 说明 |
|------|----------|------|
| 展示核心指标卡 | API | GET /api/dashboard/overview |
| 展示平台预算消耗对比柱状图 | API | GET /api/dashboard/platform-comparison |
| 展示SKU预算占比饼图 | API | GET /api/dashboard/sku-proportion |
| 展示消耗趋势折线图 | API | GET /api/dashboard/consumption-trend |
| 从多维表格导入消耗数据 | 插件 | feishu-bitable |
| 批量保存导入的消耗数据 | API | POST /api/consumption-records/batch-save |

**所需 API**:
```typescript
// 获取概览核心指标 [领域模型: Budget, ConsumptionRecord] [对应页面功能: 核心指标卡展示]
GET /api/dashboard/overview?month=2026-04
Response: {
  totalBudget: number;
  consumedAmount: number;
  completionRate: number;
  remainingBudget: number;
}

// 获取平台预算消耗对比数据 [领域模型: Budget, ConsumptionRecord] [对应页面功能: 平台对比柱状图]
GET /api/dashboard/platform-comparison?month=2026-04
Response: Array<{
  platform: string;
  budget: number;
  consumed: number;
}>

// 获取SKU预算占比数据 [领域模型: Budget] [对应页面功能: SKU占比饼图]
GET /api/dashboard/sku-proportion?month=2026-04
Response: Array<{
  sku: string;
  budget: number;
  proportion: number;
}>

// 获取消耗趋势数据 [领域模型: ConsumptionRecord] [对应页面功能: 消耗趋势折线图]
GET /api/dashboard/consumption-trend?days=30&platform=&sku=
Response: Array<{
  date: string;
  amount: number;
}>

// 批量保存导入的消耗记录 [领域模型: ConsumptionRecord] [对应页面功能: 数据导入保存]
@NeedLogin()
POST /api/consumption-records/batch-save
Request Body: {
  records: Array<{
    recordDate: string;
    platform: string;
    sku: string;
    amount: number;
  }>
}
Response: {
  successCount: number;
  failCount: number;
  errors: Array<{row: number, message: string}>;
}
```

#### 消耗明细列表页 相关

**页面路径**: /consumption-details

**功能全景**：
| 功能 | 实现方式 | 说明 |
|------|----------|------|
| 多维度筛选消耗明细 | API | GET /api/consumption-details |
| 展示消耗进度列表 | API | GET /api/consumption-details |
| 查看每日消耗明细 | API | GET /api/consumption-records/daily |

**所需 API**:
```typescript
// 获取分平台分SKU消耗进度列表 [领域模型: Budget, ConsumptionRecord] [对应页面功能: 消耗进度列表展示]
GET /api/consumption-details?month=2026-04&platform=&sku=&page=1&pageSize=20
Response: {
  items: Array<{
    platform: string;
    sku: string;
    budget: number;
    consumed: number;
    completionRate: number;
    isAbnormal: boolean;
  }>;
  total: number;
}

// 获取指定维度的每日消耗明细 [领域模型: ConsumptionRecord] [对应页面功能: 明细展开查看]
GET /api/consumption-records/daily?month=2026-04&platform=&sku=
Response: Array<{
  date: string;
  amount: number;
}>
```

#### 预算配置页 相关

**页面路径**: /budget-config

**功能全景**：
| 功能 | 实现方式 | 说明 |
|------|----------|------|
| 获取指定月份预算配置 | API | GET /api/budgets |
| 保存预算配置 | API | POST /api/budgets |
| 按比例批量分配预算 | API | POST /api/budgets/batch-allocate |

**所需 API**:
```typescript
// 获取指定月份预算配置 [领域模型: Budget] [对应页面功能: 预算配置列表展示]
GET /api/budgets?month=2026-04
Response: Array<{
  platform: string;
  sku: string;
  amount: number;
  proportion: number;
}>

// 保存预算配置 [领域模型: Budget] [对应页面功能: 预算修改提交]
@NeedLogin()
POST /api/budgets
Request Body: {
  month: string;
  records: Array<{
    platform: string;
    sku: string;
    amount: number;
  }>
}
Response: {
  success: boolean;
}

// 按比例批量分配预算 [领域模型: Budget] [对应页面功能: 批量比例分配]
@NeedLogin()
POST /api/budgets/batch-allocate
Request Body: {
  month: string;
  platformTotal: Record<string, number>;
  skuRatio: Record<string, number>;
}
Response: Array<{
  platform: string;
  sku: string;
  amount: number;
}>
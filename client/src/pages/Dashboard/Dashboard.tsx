import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { useBitableImport, type ImportProgress } from '@/hooks/useBitableImport';
import type {
  GetOverviewResponse,
  GetPlatformComparisonResponse,
  GetSkuProportionResponse,
  GetConsumptionTrendResponse,
} from '@shared/api.interface';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Download,
  Settings,
  TrendingUp,
  Wallet,
  Target,
  PiggyBank,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { logger } from '@lark-apaas/client-toolkit/logger';

// ==================== 工具函数 ====================
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// ==================== 核心指标卡组件 ====================
interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  trendType = 'neutral',
}) => {
  const trendColorClass = {
    positive: 'text-success',
    negative: 'text-danger',
    neutral: 'text-muted-foreground',
  }[trendType];

  return (
    <Card className="rounded-sm border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
            {trend && (
              <p className={`text-xs ${trendColorClass}`}>{trend}</p>
            )}
          </div>
          <div className="rounded-sm bg-accent p-2 text-accent-foreground">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ==================== 导入进度对话框 ====================
const ImportProgressDialog: React.FC<{
  open: boolean;
  progress: ImportProgress;
  onClose: () => void;
}> = ({ open, progress, onClose }) => {
  const isComplete = progress.status === 'completed' || progress.status === 'error';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-sm">
        <DialogHeader>
          <DialogTitle>数据导入进度</DialogTitle>
          <DialogDescription>
            {progress.status === 'fetching' && '正在从多维表格获取数据...'}
            {progress.status === 'saving' && '正在保存数据到数据库...'}
            {progress.status === 'completed' && '数据导入完成'}
            {progress.status === 'error' && '数据导入出错'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>总进度</span>
              <span>
                {progress.total > 0
                  ? Math.round((progress.processed / progress.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 rounded-sm bg-secondary">
              <div
                className="h-full rounded-sm bg-primary transition-all duration-300"
                style={{
                  width:
                    progress.total > 0
                      ? `${(progress.processed / progress.total) * 100}%`
                      : '0%',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-sm bg-secondary p-3">
              <p className="text-2xl font-bold font-mono">{progress.total}</p>
              <p className="text-xs text-muted-foreground">总记录</p>
            </div>
            <div className="rounded-sm bg-success-bg p-3">
              <p className="text-2xl font-bold font-mono text-success">
                {progress.successCount}
              </p>
              <p className="text-xs text-muted-foreground">成功</p>
            </div>
            <div className="rounded-sm bg-danger-bg p-3">
              <p className="text-2xl font-bold font-mono text-danger">
                {progress.failCount}
              </p>
              <p className="text-xs text-muted-foreground">失败</p>
            </div>
          </div>

          {progress.errors.length > 0 && (
            <div className="max-h-32 overflow-auto rounded-sm bg-danger-bg p-3">
              <p className="mb-2 text-sm font-medium text-danger">错误详情：</p>
              {progress.errors.slice(0, 5).map((error, idx) => (
                <p key={idx} className="text-xs text-danger">
                  行 {error.row}: {error.message}
                </p>
              ))}
              {progress.errors.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  还有 {progress.errors.length - 5} 条错误...
                </p>
              )}
            </div>
          )}

          {isComplete && (
            <Button onClick={onClose} className="w-full">
              确定
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ==================== 平台对比柱状图 ====================
const PlatformComparisonChart: React.FC<{
  data: GetPlatformComparisonResponse;
}> = ({ data }) => {
  const option: EChartsOption = useMemo(() => {
    const platforms = data.map((item) => item.platform);
    const budgets = data.map((item) => item.budget);
    const consumed = data.map((item) => item.consumed);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        data: ['预算', '已消耗'],
        bottom: 0,
        type: 'scroll',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: platforms,
        axisTick: { alignWithLabel: true },
        boundaryGap: true,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => {
            if (value >= 10000) {
              return `${(value / 10000).toFixed(0)}万`;
            }
            return String(value);
          },
        },
      },
      series: [
        {
          name: '预算',
          type: 'bar',
          data: budgets,
          itemStyle: { color: '#0891b2' },
          barGap: '20%',
        },
        {
          name: '已消耗',
          type: 'bar',
          data: consumed,
          itemStyle: { color: '#06b6d4' },
        },
      ],
    };
  }, [data]);

  return (
    <ReactECharts
      option={option}
      theme="ud"
      className="h-[300px]"
      notMerge={true}
    />
  );
};

// ==================== SKU占比饼图 ====================
const SkuProportionChart: React.FC<{
  data: GetSkuProportionResponse;
}> = ({ data }) => {
  const option: EChartsOption = useMemo(() => {
    const chartData = data.map((item) => ({
      name: item.sku,
      value: item.budget,
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        type: 'scroll',
        bottom: 0,
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          data: chartData,
          label: { show: false },
          emphasis: { label: { show: false } },
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2,
          },
          color: ['#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe'],
        },
      ],
    };
  }, [data]);

  return (
    <ReactECharts
      option={option}
      theme="ud"
      className="h-[300px]"
      notMerge={true}
    />
  );
};

// ==================== 消耗趋势折线图 ====================
const ConsumptionTrendChart: React.FC<{
  data: GetConsumptionTrendResponse;
}> = ({ data }) => {
  const option: EChartsOption = useMemo(() => {
    const dates = data.map((item) => item.date);
    const amounts = data.map((item) => item.amount);

    return {
      tooltip: {
        trigger: 'axis',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLabel: {
          formatter: (value: string) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          },
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => {
            if (value >= 10000) {
              return `${(value / 10000).toFixed(0)}万`;
            }
            return String(value);
          },
        },
      },
      series: [
        {
          name: '日消耗',
          type: 'line',
          data: amounts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#0891b2' },
          lineStyle: { width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(8, 145, 178, 0.3)' },
                { offset: 1, color: 'rgba(8, 145, 178, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  }, [data]);

  return (
    <ReactECharts
      option={option}
      theme="ud"
      className="h-[300px]"
      notMerge={true}
    />
  );
};

// ==================== 主页面 ====================
const Dashboard: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonth());
  const [overview, setOverview] = useState<GetOverviewResponse | null>(null);
  const [platformComparison, setPlatformComparison] =
    useState<GetPlatformComparisonResponse>([]);
  const [skuProportion, setSkuProportion] = useState<GetSkuProportionResponse>([]);
  const [consumptionTrend, setConsumptionTrend] =
    useState<GetConsumptionTrendResponse>([]);
  const [loading, setLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { progress, isImporting, importData, reset } = useBitableImport();

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const timestamp = Date.now();
      const [overviewRes, platformRes, skuRes, trendRes] = await Promise.all([
        axiosForBackend.get<GetOverviewResponse>('/api/dashboard/overview', {
          params: { month, _t: timestamp },
        }),
        axiosForBackend.get<GetPlatformComparisonResponse>(
          '/api/dashboard/platform-comparison',
          { params: { month, _t: timestamp } }
        ),
        axiosForBackend.get<GetSkuProportionResponse>(
          '/api/dashboard/sku-proportion',
          { params: { month, _t: timestamp } }
        ),
        axiosForBackend.get<GetConsumptionTrendResponse>(
          '/api/dashboard/consumption-trend',
          { params: { days: 30, _t: timestamp } }
        ),
      ]);

      setOverview(overviewRes.data);
      setPlatformComparison(platformRes.data);
      setSkuProportion(skuRes.data);
      setConsumptionTrend(trendRes.data);
    } catch (error) {
      toast.error('加载数据失败');
      logger.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [month]);

  // 处理导入
  const handleImport = async () => {
    reset();
    setImportDialogOpen(true);
    try {
      await importData(month);
      // 导入成功后刷新数据
      await loadData();
    } catch {
      // 错误已在hook中处理
    }
  };

  const handleCloseImportDialog = () => {
    if (!isImporting) {
      setImportDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* 顶部操作区 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">预算消耗概览</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40 rounded-sm"
          />
          <Button
            variant="outline"
            onClick={handleImport}
            disabled={isImporting}
            className="rounded-sm"
          >
            {isImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            导入数据
          </Button>
          <UniversalLink to="/config">
            <Button className="rounded-sm">
              <Settings className="mr-2 h-4 w-4" />
              预算配置
            </Button>
          </UniversalLink>
        </div>
      </div>

      {/* 核心指标卡 */}
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-ai-section-type="card-stat"
      >
        <StatCard
          title="当月总预算"
          value={overview ? formatAmount(overview.totalBudget) : '-'}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="已消耗金额"
          value={overview ? formatAmount(overview.consumedAmount) : '-'}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={overview ? `${overview.completionRate}%` : undefined}
          trendType={
            overview && overview.completionRate > 90
              ? 'negative'
              : overview && overview.completionRate > 70
              ? 'neutral'
              : 'positive'
          }
        />
        <StatCard
          title="完成率"
          value={overview ? `${overview.completionRate}%` : '-'}
          icon={<Target className="h-5 w-5" />}
          trend={
            overview && overview.completionRate > 90
              ? '已超预警线'
              : '正常范围'
          }
          trendType={
            overview && overview.completionRate > 90 ? 'negative' : 'positive'
          }
        />
        <StatCard
          title="剩余预算"
          value={overview ? formatAmount(overview.remainingBudget) : '-'}
          icon={<PiggyBank className="h-5 w-5" />}
        />
      </div>

      {/* 图表区域 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 平台预算消耗对比 */}
        <Card className="rounded-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              平台预算消耗对比
            </CardTitle>
          </CardHeader>
          <CardContent>
            {platformComparison.length > 0 ? (
              <PlatformComparisonChart data={platformComparison} />
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                {loading ? '加载中...' : '暂无数据'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SKU预算占比 */}
        <Card className="rounded-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              SKU预算占比
            </CardTitle>
          </CardHeader>
          <CardContent>
            {skuProportion.length > 0 ? (
              <SkuProportionChart data={skuProportion} />
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                {loading ? '加载中...' : '暂无数据'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 消耗趋势 - 跨两列 */}
        <Card className="rounded-sm border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              近30天消耗趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {consumptionTrend.length > 0 ? (
              <ConsumptionTrendChart data={consumptionTrend} />
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                {loading ? '加载中...' : '暂无数据'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 导入进度对话框 */}
      <ImportProgressDialog
        open={importDialogOpen}
        progress={progress}
        onClose={handleCloseImportDialog}
      />
    </div>
  );
};

export default Dashboard;

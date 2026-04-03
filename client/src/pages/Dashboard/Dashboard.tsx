import { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Upload,
  Settings,
  TrendingUp,
  Wallet,
  Target,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { toast } from 'sonner';
import { useBitableImport, type ImportProgress } from '@/hooks/useBitableImport';
import type {
  GetOverviewResponse,
  GetPlatformComparisonResponse,
  GetSkuProportionResponse,
  GetConsumptionTrendResponse,
} from '@shared/api.interface';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

// ==================== 核心指标卡组件 ====================
interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  suffix?: string;
}

const StatCard = ({ title, value, icon, trend, trendUp, suffix }: StatCardProps) => (
  <Card className="rounded-sm border-border" data-ai-section-type="card-stat">
    <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <div className="p-1.5 rounded-sm bg-accent">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold font-mono">
        {value}
        {suffix && <span className="text-sm ml-1">{suffix}</span>}
      </div>
      {trend && (
        <p className={`text-xs mt-1 ${trendUp ? 'text-success' : 'text-muted-foreground'}`}>
          {trend}
        </p>
      )}
    </CardContent>
  </Card>
);

// ==================== 柱状图组件 ====================
const PlatformComparisonChart = ({ data }: { data: GetPlatformComparisonResponse }) => {
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
        boundaryGap: true,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => `${(value / 10000).toFixed(0)}万`,
        },
      },
      series: [
        {
          name: '预算',
          type: 'bar',
          data: budgets,
          itemStyle: { color: '#0e7490' },
          barWidth: '30%',
        },
        {
          name: '已消耗',
          type: 'bar',
          data: consumed,
          itemStyle: { color: '#06b6d4' },
          barWidth: '30%',
        },
      ],
    };
  }, [data]);

  return <ReactECharts option={option} theme="ud" className="h-[300px]" />;
};

// ==================== 饼图组件 ====================
const SkuProportionChart = ({ data }: { data: GetSkuProportionResponse }) => {
  const option: EChartsOption = useMemo(() => {
    const chartData = data.map((item) => ({
      name: item.sku,
      value: item.budget,
    }));

    const colors = ['#0e7490', '#06b6d4', '#0891b2', '#155e75', '#67e8f9', '#a5f3fc'];

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `${params.name}<br/>预算: ¥${(params.value / 10000).toFixed(2)}万<br/>占比: ${params.percent}%`;
        },
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
          color: colors,
          label: { show: false },
          emphasis: {
            label: { show: false },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  }, [data]);

  return <ReactECharts option={option} theme="ud" className="h-[300px]" />;
};

// ==================== 折线图组件 ====================
const ConsumptionTrendChart = ({ data }: { data: GetConsumptionTrendResponse }) => {
  const option: EChartsOption = useMemo(() => {
    const dates = data.map((item) => item.date);
    const amounts = data.map((item) => item.amount);

    // 计算平均值作为警戒线
    const avg = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const item = params[0];
          return `${item.axisValue}<br/>消耗: ¥${Number(item.value).toLocaleString()}`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: {
          formatter: (value: string) => value.slice(5),
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => `${(value / 1000).toFixed(0)}k`,
        },
      },
      series: [
        {
          type: 'line',
          data: amounts,
          smooth: true,
          itemStyle: { color: '#0e7490' },
          lineStyle: { width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(14, 116, 144, 0.3)' },
                { offset: 1, color: 'rgba(14, 116, 144, 0.05)' },
              ],
            },
          },
          markLine: {
            silent: true,
            data: [{ yAxis: avg, name: '平均值' }],
            lineStyle: { type: 'dashed', color: '#f97316' },
            label: { formatter: '平均: ¥{c}', position: 'end' },
          },
        },
      ],
    };
  }, [data]);

  return <ReactECharts option={option} theme="ud" className="h-[300px]" />;
};

// ==================== 导入进度弹窗 ====================
const ImportDialog = ({
  open,
  onOpenChange,
  progress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: ImportProgress;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[425px] rounded-sm">
      <DialogHeader>
        <DialogTitle>导入多维表格数据</DialogTitle>
        <DialogDescription>
          {progress.status === 'idle' && '准备导入数据...'}
          {progress.status === 'fetching' && '正在从多维表格获取数据...'}
          {progress.status === 'saving' && '正在保存数据到系统...'}
          {progress.status === 'completed' && '数据导入完成'}
          {progress.status === 'error' && '导入过程出现错误'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {progress.status !== 'idle' && progress.status !== 'error' && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">进度</span>
              <span className="font-mono">
                {progress.processed} / {progress.total}
              </span>
            </div>
            <Progress value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0} />
          </>
        )}

        {(progress.status === 'completed' || progress.status === 'error') && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-success">成功: {progress.successCount}</span>
              {progress.failCount > 0 && (
                <span className="text-destructive">失败: {progress.failCount}</span>
              )}
            </div>
            {progress.errors.length > 0 && (
              <div className="max-h-[150px] overflow-auto rounded-sm border p-2 text-xs">
                {progress.errors.map((error, i) => (
                  <div key={i} className="text-destructive">
                    第 {error.row} 行: {error.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        {(progress.status === 'completed' || progress.status === 'error') && (
          <Button onClick={() => onOpenChange(false)} className="rounded-sm">
            确定
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

// ==================== 主页面组件 ====================
const Dashboard = () => {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // 数据状态
  const [overview, setOverview] = useState<GetOverviewResponse | null>(null);
  const [platformData, setPlatformData] = useState<GetPlatformComparisonResponse>([]);
  const [skuData, setSkuData] = useState<GetSkuProportionResponse>([]);
  const [trendData, setTrendData] = useState<GetConsumptionTrendResponse>([]);
  const [loading, setLoading] = useState(true);

  // 导入功能
  const { progress, isImporting, importData } = useBitableImport();

  // 加载数据
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [overviewRes, platformRes, skuRes, trendRes] = await Promise.all([
          axiosForBackend.get<GetOverviewResponse>(`/api/dashboard/overview?month=${month}`),
          axiosForBackend.get<GetPlatformComparisonResponse>(`/api/dashboard/platform-comparison?month=${month}`),
          axiosForBackend.get<GetSkuProportionResponse>(`/api/dashboard/sku-proportion?month=${month}`),
          axiosForBackend.get<GetConsumptionTrendResponse>(`/api/dashboard/consumption-trend?days=30`),
        ]);

        setOverview(overviewRes.data);
        setPlatformData(platformRes.data);
        setSkuData(skuRes.data);
        setTrendData(trendRes.data);
      } catch (error) {
        toast.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [month]);

  // 处理导入
  const handleImport = async () => {
    setImportDialogOpen(true);
    try {
      await importData(month);
    } catch {
      // 错误已在hook中处理
    }
  };

  // 格式化金额
  const formatAmount = (amount: number) => {
    return `¥${(amount / 10000).toFixed(2)}万`;
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作区 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">预算消耗概览</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px] h-9 rounded-sm">
              <SelectValue placeholder="选择月份" />
            </SelectTrigger>
            <SelectContent className="rounded-sm">
              <SelectItem value="2026-04">2026年4月</SelectItem>
              <SelectItem value="2026-03">2026年3月</SelectItem>
              <SelectItem value="2026-02">2026年2月</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleImport}
            disabled={isImporting}
            className="rounded-sm"
          >
            {isImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            导入数据
          </Button>

          <Button variant="outline" size="sm" className="rounded-sm" asChild>
            <UniversalLink to="/config">
              <Settings className="mr-2 h-4 w-4" />
              预算配置
            </UniversalLink>
          </Button>
        </div>
      </div>

      {/* 核心指标卡 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="当月总预算"
          value={overview ? formatAmount(overview.totalBudget) : '-'}
          icon={<Wallet className="h-4 w-4 text-primary" />}
        />
        <StatCard
          title="已消耗金额"
          value={overview ? formatAmount(overview.consumedAmount) : '-'}
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          trend={`${overview ? overview.completionRate : 0}% 完成率`}
        />
        <StatCard
          title="整体完成率"
          value={overview ? `${overview.completionRate}%` : '-'}
          icon={<Target className="h-4 w-4 text-primary" />}
          suffix=""
        />
        <StatCard
          title="剩余预算"
          value={overview ? formatAmount(overview.remainingBudget) : '-'}
          icon={<AlertCircle className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 平台预算消耗对比 */}
        <Card className="lg:col-span-2 rounded-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">各平台预算消耗对比</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <PlatformComparisonChart data={platformData} />
            )}
          </CardContent>
        </Card>

        {/* SKU预算占比 */}
        <Card className="rounded-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">SKU预算占比</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SkuProportionChart data={skuData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 消耗趋势 */}
      <Card className="rounded-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">最近30天消耗趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ConsumptionTrendChart data={trendData} />
          )}
        </CardContent>
      </Card>

      {/* 导入进度弹窗 */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        progress={progress}
      />
    </div>
  );
};

export default Dashboard;

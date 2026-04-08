import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { toast } from 'sonner';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { CanRole } from '@lark-apaas/client-toolkit/auth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/lightweight-ui';
import type {
  GetOverviewResponse,
  GetPlatformComparisonResponse,
  GetSkuProportionResponse,
  GetConsumptionTrendResponse,
} from '@shared/api.interface';
import {
  Download,
  Settings,
  TrendingUp,
  Wallet,
  Target,
  PiggyBank,
  Loader2,
} from 'lucide-react';
import './dashboard.css';

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
    neutral: 'text-muted',
  }[trendType];

  return (
    <Card className="dashboard-card">
      <CardContent className="card-content">
        <div className="stat-card-inner">
          <div className="stat-info">
            <p className="stat-title">{title}</p>
            <p className="stat-value">{value}</p>
            {trend && <p className={`stat-trend ${trendColorClass}`}>{trend}</p>}
          </div>
          <div className="stat-icon">{icon}</div>
        </div>
      </CardContent>
    </Card>
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
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['预算', '已消耗'], bottom: 0, type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: platforms, axisTick: { alignWithLabel: true } },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: (value: number) => value >= 10000 ? `${(value / 10000).toFixed(0)}万` : String(value) },
      },
      series: [
        { name: '预算', type: 'bar', data: budgets, itemStyle: { color: '#0891b2' }, barGap: '20%' },
        { name: '已消耗', type: 'bar', data: consumed, itemStyle: { color: '#06b6d4' } },
      ],
    };
  }, [data]);

  return <ReactECharts option={option} className="chart-container" notMerge={true} />;
};

// ==================== SKU占比饼图 ====================
const SkuProportionChart: React.FC<{ data: GetSkuProportionResponse }> = ({ data }) => {
  const option: EChartsOption = useMemo(() => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { type: 'scroll', bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      data: data.map((item) => ({ name: item.sku, value: item.budget })),
      label: { show: false },
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      color: ['#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe'],
    }],
  }), [data]);

  return <ReactECharts option={option} className="chart-container" notMerge={true} />;
};

// ==================== 消耗趋势折线图 ====================
const ConsumptionTrendChart: React.FC<{ data: GetConsumptionTrendResponse }> = ({ data }) => {
  const option: EChartsOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map((item) => item.date),
      axisLabel: { formatter: (value: string) => {
        const date = new Date(value);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }},
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (value: number) => value >= 10000 ? `${(value / 10000).toFixed(0)}万` : String(value) },
    },
    series: [{
      name: '日消耗',
      type: 'line',
      data: data.map((item) => item.amount),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      itemStyle: { color: '#0891b2' },
      lineStyle: { width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(8, 145, 178, 0.3)' },
            { offset: 1, color: 'rgba(8, 145, 178, 0.05)' },
          ],
        },
      },
    }],
  }), [data]);

  return <ReactECharts option={option} className="chart-container" notMerge={true} />;
};

// ==================== 导入对话框 ====================
const ImportDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    setLoading(true);
    try {
      const response = await axiosForBackend.post('/api/consumption-records/import-from-bitable');
      const result = response.data as { successCount: number; failCount: number; errors: Array<{ row: number; message: string }> };
      if (result.failCount > 0) {
        toast.warning(`导入完成: 成功 ${result.successCount} 条, 失败 ${result.failCount} 条`);
      } else {
        toast.success(`导入成功: 共 ${result.successCount} 条数据`);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('导入失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content">
        <DialogHeader>
          <DialogTitle>数据导入</DialogTitle>
          <DialogDescription>从飞书多维表格导入最新消耗数据</DialogDescription>
        </DialogHeader>
        <div className="dialog-body">
          <p className="dialog-text">点击"开始导入"从飞书多维表格拉取最新数据。</p>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={handleImport} isLoading={loading}>开始导入</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ==================== 主页面 ====================
const Dashboard: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonth());
  const [overview, setOverview] = useState<GetOverviewResponse | null>(null);
  const [platformComparison, setPlatformComparison] = useState<GetPlatformComparisonResponse>([]);
  const [skuProportion, setSkuProportion] = useState<GetSkuProportionResponse>([]);
  const [consumptionTrend, setConsumptionTrend] = useState<GetConsumptionTrendResponse>([]);
  const [loading, setLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewRes, platformRes, skuRes, trendRes] = await Promise.all([
        axiosForBackend.get(`/api/dashboard/overview?month=${month}`),
        axiosForBackend.get(`/api/dashboard/platform-comparison?month=${month}`),
        axiosForBackend.get(`/api/dashboard/sku-proportion?month=${month}`),
        axiosForBackend.get(`/api/dashboard/consumption-trend?month=${month}`),
      ]);
      setOverview(overviewRes.data);
      setPlatformComparison(platformRes.data);
      setSkuProportion(skuRes.data);
      setConsumptionTrend(trendRes.data);
    } catch (error) {
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [month]);

  return (
    <div className="dashboard-container">
      {/* 顶部操作栏 */}
      <div className="dashboard-header">
        <div className="header-left">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="month-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026-04">2026年4月</SelectItem>
              <SelectItem value="2026-03">2026年3月</SelectItem>
              <SelectItem value="2026-02">2026年2月</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="header-actions">
          <CanRole roles={['admin']}>
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Download className="btn-icon" />
              数据导入
            </Button>
          </CanRole>
          <UniversalLink to="/config">
            <Button variant="outline">
              <Settings className="btn-icon" />
              预算配置
            </Button>
          </UniversalLink>
        </div>
      </div>

      {/* 核心指标卡 */}
      {loading ? (
        <div className="loading-container"><Loader2 className="animate-spin" /></div>
      ) : overview ? (
        <div className="stats-grid">
          <StatCard
            title="当月总预算"
            value={formatAmount(overview.totalBudget)}
            icon={<Wallet className="icon" />}
            trend="预算已锁定"
          />
          <StatCard
            title="已消耗金额"
            value={formatAmount(overview.consumedAmount)}
            icon={<TrendingUp className="icon" />}
            trend={`${((overview.consumedAmount / overview.totalBudget) * 100).toFixed(1)}%`}
          />
          <StatCard
            title="完成率"
            value={`${overview.completionRate.toFixed(1)}%`}
            icon={<Target className="icon" />}
            trend={overview.completionRate > 100 ? '已超额' : '正常'}
            trendType={overview.completionRate > 100 ? 'negative' : 'positive'}
          />
          <StatCard
            title="剩余预算"
            value={formatAmount(overview.remainingBudget)}
            icon={<PiggyBank className="icon" />}
            trend={overview.remainingBudget < 0 ? '已超支' : '可用'}
            trendType={overview.remainingBudget < 0 ? 'negative' : 'positive'}
          />
        </div>
      ) : null}

      {/* 图表区域 */}
      <div className="charts-grid">
        <Card className="chart-card">
          <CardHeader><CardTitle>平台对比</CardTitle></CardHeader>
          <CardContent><PlatformComparisonChart data={platformComparison} /></CardContent>
        </Card>
        <Card className="chart-card">
          <CardHeader><CardTitle>SKU占比</CardTitle></CardHeader>
          <CardContent><SkuProportionChart data={skuProportion} /></CardContent>
        </Card>
        <Card className="chart-card full-width">
          <CardHeader><CardTitle>消耗趋势</CardTitle></CardHeader>
          <CardContent><ConsumptionTrendChart data={consumptionTrend} /></CardContent>
        </Card>
      </div>

      {/* 导入对话框 */}
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
};

export default Dashboard;

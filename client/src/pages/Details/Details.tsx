import { useState, useEffect, useMemo } from 'react';
import { Table, TableProps } from '@lark-apaas/client-toolkit/antd-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  List,
  Filter,
  TrendingUp,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { toast } from 'sonner';
import type {
  ConsumptionDetailItem,
  GetConsumptionDetailsResponse,
  DailyConsumption,
} from '@shared/api.interface';
import { PLATFORMS, SKUS } from '@shared/api.interface';

// ==================== 筛选区组件 ====================
interface FilterBarProps {
  month: string;
  platform?: string;
  sku?: string;
  onMonthChange: (month: string) => void;
  onPlatformChange: (platform: string) => void;
  onSkuChange: (sku: string) => void;
  onReset: () => void;
}

const FilterBar = ({
  month,
  platform,
  sku,
  onMonthChange,
  onPlatformChange,
  onSkuChange,
  onReset,
}: FilterBarProps) => (
  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
    <div className="flex flex-wrap gap-3">
      <Select value={month} onValueChange={onMonthChange}>
        <SelectTrigger className="w-[140px] h-9 rounded-sm">
          <SelectValue placeholder="选择月份" />
        </SelectTrigger>
        <SelectContent className="rounded-sm">
          <SelectItem value="2026-04">2026年4月</SelectItem>
          <SelectItem value="2026-03">2026年3月</SelectItem>
          <SelectItem value="2026-02">2026年2月</SelectItem>
        </SelectContent>
      </Select>

      <Select value={platform} onValueChange={onPlatformChange}>
        <SelectTrigger className="w-[120px] h-9 rounded-sm">
          <SelectValue placeholder="全部平台" />
        </SelectTrigger>
        <SelectContent className="rounded-sm">
          <SelectItem value="">全部平台</SelectItem>
          {PLATFORMS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sku} onValueChange={onSkuChange}>
        <SelectTrigger className="w-[120px] h-9 rounded-sm">
          <SelectValue placeholder="全部SKU" />
        </SelectTrigger>
        <SelectContent className="rounded-sm">
          <SelectItem value="">全部SKU</SelectItem>
          {SKUS.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <Button variant="outline" size="sm" onClick={onReset} className="rounded-sm">
      <Filter className="mr-2 h-4 w-4" />
      重置
    </Button>
  </div>
);

// ==================== 每日明细弹窗 ====================
interface DailyDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: string;
  sku: string;
  month: string;
}

const DailyDetailDialog = ({
  open,
  onOpenChange,
  platform,
  sku,
  month,
}: DailyDetailDialogProps) => {
  const [data, setData] = useState<DailyConsumption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && platform && sku && month) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const response = await axiosForBackend.get<DailyConsumption[]>(
            `/api/consumption-records/daily?month=${month}&platform=${platform}&sku=${sku}`
          );
          setData(response.data);
        } catch (error) {
          toast.error('加载明细失败');
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [open, platform, sku, month]);

  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-sm">
        <DialogHeader>
          <DialogTitle>
            {platform} - {sku} 每日消耗明细
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">总消耗金额</span>
            <span className="font-mono font-semibold text-primary">
              ¥{(totalAmount / 10000).toFixed(2)}万
            </span>
          </div>

          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">暂无数据</div>
          ) : (
            <div className="max-h-[400px] overflow-auto rounded-sm border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">日期</th>
                    <th className="px-4 py-2 text-right font-medium">消耗金额</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, i) => (
                    <tr
                      key={item.date}
                      className={`border-t hover:bg-muted/30 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                    >
                      <td className="px-4 py-2">{item.date}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        ¥{Number(item.amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ==================== 主页面组件 ====================
const Details = () => {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [platform, setPlatform] = useState('');
  const [sku, setSku] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [data, setData] = useState<ConsumptionDetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<{ platform: string; sku: string } | null>(null);

  // 加载数据
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          month,
          page: String(page),
          pageSize: String(pageSize),
        });
        if (platform) params.append('platform', platform);
        if (sku) params.append('sku', sku);

        const response = await axiosForBackend.get<GetConsumptionDetailsResponse>(
          `/api/consumption-records/details?${params.toString()}`
        );

        setData(response.data.items);
        setTotal(response.data.total);
      } catch (error) {
        toast.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [month, platform, sku, page, pageSize]);

  // 重置筛选
  const handleReset = () => {
    setPlatform('');
    setSku('');
    setPage(1);
  };

  // 查看明细
  const handleViewDetail = (record: ConsumptionDetailItem) => {
    setSelectedRecord({ platform: record.platform, sku: record.sku });
    setDetailDialogOpen(true);
  };

  // 完成率状态
  const getCompletionRateStatus = (rate: number): 'default' | 'destructive' | 'secondary' => {
    if (rate > 100) return 'destructive';
    if (rate > 90) return 'secondary';
    return 'default';
  };

  // 表格列定义
  const columns: TableProps<ConsumptionDetailItem>['columns'] = useMemo(() => [
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      fixed: 'left',
      width: 100,
      sorter: (a, b) => a.platform.localeCompare(b.platform),
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      sorter: (a, b) => a.sku.localeCompare(b.sku),
    },
    {
      title: '预算金额',
      dataIndex: 'budget',
      key: 'budget',
      width: 120,
      render: (value: number) => (
        <span className="font-mono">¥{(value / 10000).toFixed(2)}万</span>
      ),
      sorter: (a, b) => a.budget - b.budget,
    },
    {
      title: '已消耗',
      dataIndex: 'consumed',
      key: 'consumed',
      width: 120,
      render: (value: number) => (
        <span className="font-mono text-primary">¥{(value / 10000).toFixed(2)}万</span>
      ),
      sorter: (a, b) => a.consumed - b.consumed,
    },
    {
      title: '完成率',
      dataIndex: 'completionRate',
      key: 'completionRate',
      width: 120,
      render: (value: number, record: ConsumptionDetailItem) => (
        <div className="flex items-center gap-2">
          <Badge variant={getCompletionRateStatus(value)} className="rounded-sm">
            {value.toFixed(1)}%
          </Badge>
          {value > 90 && <AlertCircle className="h-4 w-4 text-warning" />}
        </div>
      ),
      sorter: (a, b) => a.completionRate - b.completionRate,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_: any, record: ConsumptionDetailItem) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewDetail(record)}
          className="rounded-sm"
        >
          查看明细
        </Button>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-2">
        <List className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">消耗明细列表</h1>
      </div>

      {/* 筛选区 */}
      <Card className="rounded-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">数据筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterBar
            month={month}
            platform={platform}
            sku={sku}
            onMonthChange={setMonth}
            onPlatformChange={setPlatform}
            onSkuChange={setSku}
            onReset={handleReset}
          />
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card className="rounded-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">消耗进度列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey={(record) => `${record.platform}-${record.sku}`}
            scroll={{ x: 800, y: 500 }}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (newPage) => setPage(newPage),
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </CardContent>
      </Card>

      {/* 每日明细弹窗 */}
      {selectedRecord && (
        <DailyDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          platform={selectedRecord.platform}
          sku={selectedRecord.sku}
          month={month}
        />
      )}
    </div>
  );
};

export default Details;

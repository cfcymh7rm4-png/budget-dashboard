import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { BudgetWithProportion } from '@shared/api.interface';
import { PLATFORMS, SKUS } from '@shared/api.interface';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Settings,
  Save,
  Calculator,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ==================== 类型和Schema ====================
const budgetItemSchema = z.object({
  platform: z.string(),
  sku: z.string(),
  amount: z.coerce.number().min(0, '金额不能为负数'),
});

const batchConfigSchema = z.object({
  skuBudgets: z.record(z.coerce.number().min(0)),
  platformRatios: z.record(z.coerce.number().min(0).max(1)),
});

type BudgetItemFormData = z.infer<typeof budgetItemSchema>;
type BatchConfigFormData = z.infer<typeof batchConfigSchema>;

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

// ==================== 批量配置区组件 ====================
interface BatchConfigSectionProps {
  month: string;
  onBatchAllocate: (data: BatchConfigFormData) => Promise<void>;
  loading: boolean;
}

const BatchConfigSection: React.FC<BatchConfigSectionProps> = ({
  month,
  onBatchAllocate,
  loading,
}) => {
  const form = useForm<BatchConfigFormData>({
    resolver: zodResolver(batchConfigSchema),
    defaultValues: {
      skuBudgets: Object.fromEntries(SKUS.map((s) => [s, 0])),
      platformRatios: Object.fromEntries(PLATFORMS.map((p) => [p, 0])),
    },
  });

  const handleSubmit = async (data: BatchConfigFormData) => {
    // 验证比例总和是否为1
    const totalRatio = Object.values(data.platformRatios).reduce((a, b) => a + b, 0);
    if (Math.abs(totalRatio - 1) > 0.001) {
      toast.error('平台比例总和必须等于1（100%）');
      return;
    }
    await onBatchAllocate(data);
  };

  const handleReset = () => {
    form.reset({
      skuBudgets: Object.fromEntries(SKUS.map((s) => [s, 0])),
      platformRatios: Object.fromEntries(PLATFORMS.map((p) => [p, 0])),
    });
  };

  return (
    <Card className="rounded-sm border-border">
      <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          批量预算配置
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* SKU总预算 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">各SKU总预算</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {SKUS.map((sku) => (
                  <FormField
                    key={sku}
                    control={form.control}
                    name={`skuBudgets.${sku}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{sku}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            {...field}
                            className="h-9 rounded-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            {/* 平台比例 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">平台分配比例</h4>
                <span className="text-xs text-muted-foreground">
                  总和应为 100%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {PLATFORMS.map((platform) => (
                  <FormField
                    key={platform}
                    control={form.control}
                    name={`platformRatios.${platform}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{platform}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            placeholder="0.00"
                            {...field}
                            className="h-9 rounded-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="rounded-sm"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="mr-2 h-4 w-4" />
                )}
                按比例分配
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="rounded-sm"
              >
                重置
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

// ==================== 明细配置列表组件 ====================
interface BudgetConfigTableProps {
  data: BudgetWithProportion[];
  onDataChange: (data: BudgetWithProportion[]) => void;
  loading: boolean;
  onSave: () => Promise<void>;
  saving: boolean;
  totalBudget: number;
}

const BudgetConfigTable: React.FC<BudgetConfigTableProps> = ({
  data,
  onDataChange,
  loading,
  onSave,
  saving,
  totalBudget,
}) => {
  const handleAmountChange = (index: number, value: string) => {
    const newData = [...data];
    const amount = parseFloat(value) || 0;
    newData[index] = {
      ...newData[index],
      amount,
      proportion: totalBudget > 0 ? Number(((amount / totalBudget) * 100).toFixed(2)) : 0,
    };
    onDataChange(newData);
  };

  // 按SKU分组展示
  const groupedData = useMemo(() => {
    const groups: Record<string, BudgetWithProportion[]> = {};
    for (const item of data) {
      if (!groups[item.sku]) {
        groups[item.sku] = [];
      }
      groups[item.sku].push(item);
    }
    return groups;
  }, [data]);

  return (
    <Card className="rounded-sm border-border">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">明细配置</CardTitle>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            总预算: <strong className="text-foreground font-mono">{formatAmount(totalBudget)}</strong>
          </span>
          <Button
            onClick={onSave}
            disabled={saving || loading}
            size="sm"
            className="rounded-sm"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存配置
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            <AlertCircle className="mr-2 h-5 w-5" />
            暂无预算配置数据
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedData).map(([sku, items]) => (
              <div key={sku} className="space-y-2">
                <h4 className="text-sm font-medium text-primary">{sku}</h4>
                <div className="rounded-sm border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[120px]">平台</TableHead>
                        <TableHead className="w-[160px]">预算金额</TableHead>
                        <TableHead className="w-[100px]">占比</TableHead>
                        <TableHead>进度</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const globalIndex = data.findIndex(
                          (d) => d.platform === item.platform && d.sku === item.sku
                        );
                        return (
                          <TableRow key={`${item.platform}-${item.sku}`}>
                            <TableCell className="font-medium">{item.platform}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                value={item.amount}
                                onChange={(e) =>
                                  handleAmountChange(globalIndex, e.target.value)
                                }
                                className="h-8 w-32 rounded-sm font-mono"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {item.proportion.toFixed(2)}%
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 rounded-sm bg-secondary overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${Math.min(item.proportion, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== 主页面组件 ====================
const Config: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonth());
  const [budgets, setBudgets] = useState<BudgetWithProportion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  // 计算总预算
  const totalBudget = useMemo(() => {
    return budgets.reduce((sum, item) => sum + item.amount, 0);
  }, [budgets]);

  // 加载预算数据
  const loadBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axiosForBackend.get<BudgetWithProportion[]>(
        '/api/budgets',
        { params: { month } }
      );
      // 如果没有数据，初始化空数据
      if (response.data.length === 0) {
        const emptyBudgets: BudgetWithProportion[] = [];
        for (const platform of PLATFORMS) {
          for (const sku of SKUS) {
            emptyBudgets.push({
              month,
              platform,
              sku,
              amount: 0,
              proportion: 0,
            });
          }
        }
        setBudgets(emptyBudgets);
      } else {
        setBudgets(response.data);
      }
    } catch (error) {
      toast.error('加载预算数据失败');
      logger.error('加载预算数据失败:', String(error));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  // 保存预算配置
  const handleSave = async () => {
    setSaving(true);
    try {
      const records = budgets.map((item) => ({
        platform: item.platform,
        sku: item.sku,
        amount: item.amount,
      }));

      await axiosForBackend.post('/api/budgets', {
        month,
        records,
      });

      toast.success('预算配置保存成功');
      await loadBudgets();
    } catch (error) {
      toast.error('保存预算配置失败');
      logger.error('保存预算配置失败:', String(error));
    } finally {
      setSaving(false);
    }
  };

  // 批量分配
  const handleBatchAllocate = async (data: BatchConfigFormData) => {
    setBatchLoading(true);
    try {
      const response = await axiosForBackend.post('/api/budgets/batch-allocate', {
        month,
        skuTotal: data.skuBudgets,
        platformRatio: data.platformRatios,
      });

      toast.success('批量分配成功');
      await loadBudgets();
    } catch (error) {
      toast.error('批量分配失败');
      logger.error('批量分配失败:', String(error));
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">预算配置</h1>
        </div>

        {/* 月份选择 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">配置月份:</span>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40 rounded-sm"
          />
        </div>
      </div>

      {/* 批量配置区 */}
      <BatchConfigSection
        month={month}
        onBatchAllocate={handleBatchAllocate}
        loading={batchLoading}
      />

      {/* 明细配置列表 */}
      <BudgetConfigTable
        data={budgets}
        onDataChange={setBudgets}
        loading={loading}
        onSave={handleSave}
        saving={saving}
        totalBudget={totalBudget}
      />
    </div>
  );
};

export default Config;

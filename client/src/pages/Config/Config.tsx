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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

// ==================== 类型和Schema ====================
const budgetItemSchema = z.object({
  platform: z.string(),
  sku: z.string(),
  amount: z.coerce.number().min(0, '金额不能为负数'),
});

// 每个SKU的配置
const skuConfigSchema = z.object({
  sku: z.string(),
  budget: z.coerce.number().min(0, '预算不能为负数'),
  platformRatios: z.record(z.coerce.number().min(0).max(100)),
});

const batchConfigSchema = z.object({
  skuConfigs: z.array(skuConfigSchema),
});

type BudgetItemFormData = z.infer<typeof budgetItemSchema>;
type SkuConfigFormData = z.infer<typeof skuConfigSchema>;
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

// 计算平台比例总和
const calculateTotalRatio = (ratios: Record<string, number | string>): number => {
  return Object.values(ratios).reduce<number>((sum, val) => sum + Number(val || 0), 0);
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
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());

  const form = useForm<BatchConfigFormData>({
    resolver: zodResolver(batchConfigSchema),
    defaultValues: {
      skuConfigs: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'skuConfigs',
  });

  // 添加SKU配置
  const handleAddSku = () => {
    if (!selectedSku) {
      toast.error('请选择一个SKU');
      return;
    }
    
    // 检查是否已存在
    const exists = fields.some(f => f.sku === selectedSku);
    if (exists) {
      toast.error('该SKU已添加');
      return;
    }

    append({
      sku: selectedSku,
      budget: 0,
      platformRatios: Object.fromEntries(PLATFORMS.map(p => [p, 0])),
    });
    
    // 自动展开
    setExpandedSkus(prev => new Set([...prev, selectedSku]));
    setSelectedSku('');
  };

  // 删除SKU配置
  const handleRemoveSku = (index: number) => {
    const sku = fields[index]?.sku;
    remove(index);
    if (sku) {
      setExpandedSkus(prev => {
        const next = new Set(prev);
        next.delete(sku);
        return next;
      });
    }
  };

  // 切换展开/收起
  const toggleExpand = (sku: string) => {
    setExpandedSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  };

  const handleSubmit = async (data: BatchConfigFormData) => {
    // 验证每个SKU的平台比例总和是否为100%
    for (const config of data.skuConfigs) {
      const totalRatio = calculateTotalRatio(config.platformRatios);
      if (Math.abs(totalRatio - 100) > 0.1) {
        toast.error(`${config.sku} 的平台比例总和必须等于100%，当前为 ${totalRatio.toFixed(1)}%`);
        return;
      }
    }
    await onBatchAllocate(data);
  };

  const handleReset = () => {
    form.reset({
      skuConfigs: [],
    });
    setExpandedSkus(new Set());
    toast.info('已重置为默认值');
  };

  // 获取未添加的SKU列表
  const availableSkus = useMemo(() => {
    const addedSkus = new Set(fields.map(f => f.sku));
    return SKUS.filter(s => !addedSkus.has(s));
  }, [fields]);

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
            {/* 添加SKU */}
            <div className="flex items-center gap-3">
              <Select value={selectedSku} onValueChange={setSelectedSku}>
                <SelectTrigger className="w-[200px] rounded-sm">
                  <SelectValue placeholder="选择SKU" />
                </SelectTrigger>
                <SelectContent>
                  {availableSkus.map((sku) => (
                    <SelectItem key={sku} value={sku}>
                      {sku}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddSku}
                disabled={!selectedSku}
                className="rounded-sm gap-1"
              >
                <Plus className="h-4 w-4" />
                添加
              </Button>
            </div>

            {/* SKU配置列表 */}
            {fields.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">SKU配置</h4>
                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const isExpanded = expandedSkus.has(field.sku);
                    const totalRatio = calculateTotalRatio(form.watch(`skuConfigs.${index}.platformRatios`) || {});
                    const isValid = Math.abs(totalRatio - 100) < 0.1;

                    return (
                      <div
                        key={field.id}
                        className="border border-border rounded-sm overflow-hidden"
                      >
                        {/* SKU头部 */}
                        <div
                          className="flex items-center justify-between px-4 py-3 bg-accent/30 cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => toggleExpand(field.sku)}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">{field.sku}</span>
                            <span className={`text-xs ${isValid ? 'text-success' : 'text-warning'}`}>
                              比例: {totalRatio.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              预算: {form.watch(`skuConfigs.${index}.budget`) || 0} 万
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSku(index);
                              }}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* SKU详细配置 */}
                        {isExpanded && (
                          <div className="p-4 space-y-4">
                            {/* 预算输入 */}
                            <FormField
                              control={form.control}
                              name={`skuConfigs.${index}.budget`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">总预算 (万元)</FormLabel>
                                  <FormControl>
                                    <div className="relative w-[200px]">
                                      <Input
                                        type="number"
                                        min={0}
                                        step={0.1}
                                        placeholder="0"
                                        {...field}
                                        className="h-9 rounded-sm pr-8"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                        万
                                      </span>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* 平台比例 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-xs">平台分配比例 (%)</FormLabel>
                                <span className={`text-xs ${isValid ? 'text-success' : 'text-warning'}`}>
                                  总和: {totalRatio.toFixed(0)}%
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {PLATFORMS.map((platform) => (
                                  <FormField
                                    key={platform}
                                    control={form.control}
                                    name={`skuConfigs.${index}.platformRatios.${platform}`}
                                    render={({ field }) => (
                                      <FormItem className="mb-0">
                                        <FormLabel className="text-xs text-muted-foreground">{platform}</FormLabel>
                                        <FormControl>
                                          <div className="relative">
                                            <Input
                                              type="number"
                                              min={0}
                                              max={100}
                                              step={1}
                                              placeholder="0"
                                              {...field}
                                              className="h-8 rounded-sm pr-7 text-sm"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                              %
                                            </span>
                                          </div>
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading || fields.length === 0}
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

// ==================== 预算明细列表组件 ====================
interface BudgetListSectionProps {
  month: string;
  budgets: BudgetWithProportion[];
  loading: boolean;
  onSave: () => Promise<void>;
  saving: boolean;
}

const BudgetListSection: React.FC<BudgetListSectionProps> = ({
  month,
  budgets,
  loading,
  onSave,
  saving,
}) => {
  // 按SKU分组
  const groupedBudgets = useMemo(() => {
    const groups: Record<string, BudgetWithProportion[]> = {};
    budgets.forEach((item) => {
      if (!groups[item.sku]) {
        groups[item.sku] = [];
      }
      groups[item.sku].push(item);
    });
    return groups;
  }, [budgets]);

  // 计算SKU总计
  const skuTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(groupedBudgets).forEach(([sku, items]) => {
      totals[sku] = items.reduce((sum, item) => sum + item.amount, 0);
    });
    return totals;
  }, [groupedBudgets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>暂无预算配置</p>
        <p className="text-sm">请使用上方批量配置功能或手动添加</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 汇总统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-ai-section-type="card-stat">
        <Card className="rounded-sm border-border">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">预算总配置数</p>
            <p className="text-2xl font-bold mt-1">{budgets.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm border-border">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">SKU数量</p>
            <p className="text-2xl font-bold mt-1">{Object.keys(groupedBudgets).length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm border-border">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">平台数量</p>
            <p className="text-2xl font-bold mt-1">{PLATFORMS.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm border-border">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">总预算金额</p>
            <p className="text-2xl font-bold mt-1">
              {formatAmount(budgets.reduce((sum, item) => sum + item.amount, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 按SKU分组的预算列表 */}
      <div className="space-y-4">
        {Object.entries(groupedBudgets).map(([sku, items]) => (
          <Card key={sku} className="rounded-sm border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{sku}</CardTitle>
                <span className="text-sm text-muted-foreground">
                  总计: {formatAmount(skuTotals[sku] || 0)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[120px]">平台</TableHead>
                      <TableHead className="text-right">预算金额</TableHead>
                      <TableHead className="text-right">占比</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={`${item.platform}-${item.sku}`}>
                        <TableCell className="font-medium">{item.platform}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(item.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm ${
                            item.proportion > 30 ? 'text-warning font-medium' : ''
                          }`}>
                            {item.proportion.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ==================== 主页面组件 ====================
const ConfigPage: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonth());
  const [budgets, setBudgets] = useState<BudgetWithProportion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

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
      await axiosForBackend.post('/api/budgets', {
        month,
        records: budgets.map((item) => ({
          platform: item.platform,
          sku: item.sku,
          amount: item.amount,
        })),
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
      // 转换数据结构
      const skuTotal: Record<string, number> = {};
      const platformRatio: Record<string, Record<string, number>> = {};

      for (const config of data.skuConfigs) {
        // 万元转元
        skuTotal[config.sku] = config.budget * 10000;
        // 百分比转小数
        platformRatio[config.sku] = Object.fromEntries(
          Object.entries(config.platformRatios).map(([k, v]) => [k, v / 100])
        );
      }

      await axiosForBackend.post('/api/budgets/batch-allocate', {
        month,
        skuTotal,
        platformRatio,
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">预算明细</h2>
          <Button
            onClick={handleSave}
            disabled={saving}
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

        <BudgetListSection
          month={month}
          budgets={budgets}
          loading={loading}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </div>
  );
};

export default ConfigPage;

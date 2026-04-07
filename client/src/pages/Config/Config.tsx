import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { PLATFORMS, SKUS, type BudgetWithProportion } from '@shared/api.interface';
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
  Settings,
  Calculator,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Eye,
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

// localStorage key
const getStorageKey = (month: string) => `budget_config_${month}`;

const BatchConfigSection: React.FC<BatchConfigSectionProps> = ({
  month,
  onBatchAllocate,
  loading,
}) => {
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  const form = useForm<BatchConfigFormData>({
    resolver: zodResolver(batchConfigSchema),
    defaultValues: {
      skuConfigs: [],
    },
  });

  // 加载预算数据：优先从 localStorage 加载，如果不存在则从后端加载
  useEffect(() => {
    const loadBudgetData = async () => {
      try {
        // 优先尝试从 localStorage 加载
        const saved = localStorage.getItem(getStorageKey(month));
        if (saved) {
          const parsed = JSON.parse(saved) as BatchConfigFormData;
          form.reset(parsed);
          if (parsed.skuConfigs?.length > 0) {
            setExpandedSkus(new Set(parsed.skuConfigs.map(c => c.sku)));
          }
          setIsLoaded(true);
          return;
        }

        // localStorage 没有数据，从后端加载
        const response = await axiosForBackend.get<BudgetWithProportion[]>(`/api/budgets?month=${month}`);
        const budgets = response.data;

        if (budgets && budgets.length > 0) {
          // 按SKU分组，计算总预算和平台比例
          const skuMap = new Map<string, { budget: number; platforms: Map<string, number> }>();

          for (const budget of budgets) {
            if (!skuMap.has(budget.sku)) {
              skuMap.set(budget.sku, { budget: 0, platforms: new Map() });
            }
            const skuData = skuMap.get(budget.sku)!;
            skuData.budget += budget.amount;
            skuData.platforms.set(budget.platform, budget.amount);
          }

          // 转换为表单格式
          const skuConfigs: SkuConfigFormData[] = [];
          for (const [sku, data] of skuMap) {
            const platformRatios: Record<string, number> = {};
            for (const platform of PLATFORMS) {
              const platformAmount = data.platforms.get(platform) || 0;
              platformRatios[platform] = data.budget > 0 ? (platformAmount / data.budget) * 100 : 0;
            }

            skuConfigs.push({
              sku,
              budget: data.budget / 10000, // 元转万元
              platformRatios,
            });
          }

          form.reset({ skuConfigs });
          setExpandedSkus(new Set(skuConfigs.map(c => c.sku)));
          
          // 同时保存到 localStorage
          localStorage.setItem(getStorageKey(month), JSON.stringify({ skuConfigs }));
        } else {
          form.reset({ skuConfigs: [] });
          setExpandedSkus(new Set());
        }
      } catch (error) {
        logger.error('加载预算数据失败:', String(error));
        // 出错时尝试从 localStorage 加载
        try {
          const saved = localStorage.getItem(getStorageKey(month));
          if (saved) {
            const parsed = JSON.parse(saved) as BatchConfigFormData;
            form.reset(parsed);
            if (parsed.skuConfigs?.length > 0) {
              setExpandedSkus(new Set(parsed.skuConfigs.map(c => c.sku)));
            }
          }
        } catch (e) {
          logger.error('加载本地配置失败:', String(e));
        }
      }
      setIsLoaded(true);
    };

    loadBudgetData();
  }, [month, form]);

  // 监听表单变化并保存到 localStorage
  const watchedValues = useWatch({ control: form.control, name: 'skuConfigs' });
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const data = form.getValues();
      localStorage.setItem(getStorageKey(month), JSON.stringify(data));
    } catch (error) {
      logger.error('保存本地配置失败:', String(error));
    }
  }, [watchedValues, month, isLoaded, form]);

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
    // 清除本地缓存
    localStorage.removeItem(getStorageKey(month));
    toast.info('已重置为默认值');
  };

  // 获取未添加的SKU列表
  const availableSkus = useMemo(() => {
    const addedSkus = new Set(fields.map(f => f.sku));
    return SKUS.filter(s => !addedSkus.has(s));
  }, [fields]);

  // 监听表单数据变化，用于预算明细预览
  const skuConfigs = useWatch({
    control: form.control,
    name: 'skuConfigs',
  });

  // 计算预算明细
  const budgetDetails = useMemo(() => {
    if (!skuConfigs || skuConfigs.length === 0) return [];
    
    const details: { sku: string; platform: string; budget: number; ratio: number; amount: number }[] = [];
    
    for (const config of skuConfigs) {
      if (!config) continue;
      const skuBudget = Number(config.budget || 0) * 10000; // 万元转元
      
      for (const platform of PLATFORMS) {
        const ratio = Number(config.platformRatios?.[platform] || 0);
        // 如果SKU预算为0或平台比例为0，则预算金额为0
        const amount = skuBudget === 0 || ratio === 0 ? 0 : (skuBudget * ratio) / 100;
        
        details.push({
          sku: config.sku,
          platform,
          budget: skuBudget,
          ratio,
          amount,
        });
      }
    }
    
    return details;
  }, [skuConfigs]);

  // 按SKU分组显示
  const groupedDetails = useMemo(() => {
    const groups: Record<string, typeof budgetDetails> = {};
    for (const item of budgetDetails) {
      if (!groups[item.sku]) {
        groups[item.sku] = [];
      }
      groups[item.sku].push(item);
    }
    return groups;
  }, [budgetDetails]);

  // 计算总预算
  const totalBudget = useMemo(() => {
    return budgetDetails.reduce((sum, item) => sum + item.amount, 0);
  }, [budgetDetails]);

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

        {/* 预算明细预览 */}
        {budgetDetails.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">预算明细预览</h3>
              <span className="text-xs text-muted-foreground ml-2">
                总预算: {new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(totalBudget / 10000)} 万
              </span>
            </div>
            
            <div className="space-y-3">
              {Object.entries(groupedDetails).map(([sku, items]) => (
                <div key={sku} className="border border-border rounded-sm overflow-hidden">
                  <div className="bg-accent/30 px-3 py-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{sku}</span>
                    <span className="text-xs text-muted-foreground">
                      SKU总预算: {new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format((items[0]?.budget || 0) / 10000)} 万
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {items.map((item) => (
                        <div
                          key={`${item.sku}-${item.platform}`}
                          className={`text-center p-2 rounded-sm ${
                            item.amount > 0 ? 'bg-accent/20' : 'bg-muted/30'
                          }`}
                        >
                          <div className="text-xs text-muted-foreground mb-1">{item.platform}</div>
                          <div className={`text-sm font-mono font-medium ${
                            item.amount > 0 ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(item.amount / 10000)} 万
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.ratio > 0 ? `${item.ratio.toFixed(0)}%` : '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== 主页面组件 ====================
const ConfigPage: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonth());
  const [batchLoading, setBatchLoading] = useState(false);

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

      // 保存当前配置到本地缓存（作为备份，便于刷新后恢复）
      localStorage.setItem(getStorageKey(month), JSON.stringify(data));
      toast.success('批量分配成功');
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


    </div>
  );
};

export default ConfigPage;

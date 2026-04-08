import React, { useState, useEffect, useMemo } from 'react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
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
} from '@/components/lightweight-ui';
import { PLATFORMS, SKUS, type BudgetWithProportion } from '@shared/api.interface';
import { Settings, Store, Package, Loader2, Save, PieChart, Calculator } from 'lucide-react';
import './config.css';

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const ConfigPage: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonth());
  const [selectedPlatform, setSelectedPlatform] = useState<string>(PLATFORMS[0]);
  const [budgets, setBudgets] = useState<BudgetWithProportion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 平台总预算输入
  const [platformBudgetInput, setPlatformBudgetInput] = useState<string>('');
  // SKU百分比输入
  const [skuPercents, setSkuPercents] = useState<Map<string, string>>(new Map());

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const response = await axiosForBackend.get(`/api/budgets?month=${month}`);
      const data = response.data as BudgetWithProportion[];
      setBudgets(data);

      // 初始化平台预算输入
      const platformTotal = data
        .filter((item) => item.platform === selectedPlatform)
        .reduce((sum, item) => sum + item.amount, 0);
      setPlatformBudgetInput(platformTotal > 0 ? String(platformTotal) : '');

      // 初始化SKU百分比
      const newPercents = new Map<string, string>();
      data.forEach((item) => {
        const key = `${item.platform}-${item.sku}`;
        if (platformTotal > 0) {
          const percent = ((item.amount / platformTotal) * 100).toFixed(1);
          newPercents.set(key, percent);
        } else {
          newPercents.set(key, '');
        }
      });
      setSkuPercents(newPercents);
    } catch (error) {
      toast.error('加载预算配置失败');
      logger.error('加载预算配置失败:', String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [month]);

  // 切换平台时更新平台预算输入
  useEffect(() => {
    const platformTotal = budgets
      .filter((item) => item.platform === selectedPlatform)
      .reduce((sum, item) => sum + item.amount, 0);
    setPlatformBudgetInput(platformTotal > 0 ? String(platformTotal) : '');

    // 重新计算百分比
    const newPercents = new Map<string, string>();
    budgets.forEach((item) => {
      const key = `${item.platform}-${item.sku}`;
      if (item.platform === selectedPlatform && platformTotal > 0) {
        const percent = ((item.amount / platformTotal) * 100).toFixed(1);
        newPercents.set(key, percent);
      } else if (item.platform === selectedPlatform) {
        newPercents.set(key, '');
      }
    });
    setSkuPercents((prev) => {
      const merged = new Map(prev);
      newPercents.forEach((value, key) => merged.set(key, value));
      return merged;
    });
  }, [selectedPlatform, budgets]);

  // 当前平台的数据
  const platformBudgets = useMemo(() => {
    return budgets.filter((item) => item.platform === selectedPlatform);
  }, [budgets, selectedPlatform]);

  // 计算平台总预算
  const platformTotal = useMemo(() => {
    return parseFloat(platformBudgetInput) || 0;
  }, [platformBudgetInput]);

  // 全局总预算（包含其他平台的原始值）
  const globalTotal = useMemo(() => {
    const otherPlatformsTotal = budgets
      .filter((item) => item.platform !== selectedPlatform)
      .reduce((sum, item) => sum + item.amount, 0);
    return otherPlatformsTotal + platformTotal;
  }, [budgets, selectedPlatform, platformTotal]);

  // 计算实际分配的百分比总和
  const totalPercent = useMemo(() => {
    return platformBudgets.reduce((sum, item) => {
      const key = `${item.platform}-${item.sku}`;
      const percent = parseFloat(skuPercents.get(key) || '0') || 0;
      return sum + percent;
    }, 0);
  }, [platformBudgets, skuPercents]);

  const handlePlatformBudgetChange = (value: string) => {
    setPlatformBudgetInput(value);
  };

  const handlePercentChange = (key: string, value: string) => {
    // 限制输入范围 0-100
    const numValue = parseFloat(value);
    if (value === '' || (numValue >= 0 && numValue <= 100)) {
      setSkuPercents((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, value);
        return newMap;
      });
    }
  };

  const calculateAmount = (percent: string): number => {
    const p = parseFloat(percent) || 0;
    return Math.round(platformTotal * (p / 100));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 构建保存数据
      const records = budgets.map((item) => {
        const key = `${item.platform}-${item.sku}`;
        if (item.platform === selectedPlatform) {
          const percent = skuPercents.get(key) || '0';
          return {
            platform: item.platform,
            sku: item.sku,
            amount: calculateAmount(percent),
          };
        }
        return {
          platform: item.platform,
          sku: item.sku,
          amount: item.amount,
        };
      });

      await axiosForBackend.post('/api/budgets', {
        month,
        records,
      });

      toast.success('保存成功');
      fetchBudgets();
    } catch (error) {
      toast.error('保存失败: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="config-container">
      {/* 顶部筛选区 */}
      <div className="config-header">
        <div className="header-left">
          {/* 月份选择 */}
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

          {/* 平台选择 */}
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="platform-select">
              <Store className="select-icon" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="header-right">
          <Button onClick={handleSave} isLoading={saving}>
            <Save className="btn-icon" />
            保存配置
          </Button>
        </div>
      </div>

      {/* 预算统计卡片 */}
      <div className="stats-cards">
        <div className="stat-card platform-total">
          <div className="stat-label">{selectedPlatform} 总预算</div>
          <div className="stat-value">
            <Input
              type="number"
              min="0"
              value={platformBudgetInput}
              onChange={(e) => handlePlatformBudgetChange(e.target.value)}
              className="platform-budget-input"
              placeholder="输入金额"
            />
          </div>
        </div>
        <div className="stat-card global-total">
          <div className="stat-label">全平台总预算</div>
          <div className="stat-value">¥{globalTotal.toLocaleString()}</div>
        </div>
        <div className="stat-card proportion">
          <div className="stat-label">{selectedPlatform} 占比</div>
          <div className="stat-value">
            {globalTotal > 0 ? ((platformTotal / globalTotal) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>

      {/* 配置卡片 */}
      {loading ? (
        <div className="loading-container">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <Card className="config-card">
          <CardHeader>
            <CardTitle className="card-title">
              <Calculator className="title-icon" />
              {selectedPlatform} - 预算百分比分配
              <span className={`percent-total ${totalPercent > 100 ? 'exceed' : ''}`}>
                (合计: {totalPercent.toFixed(1)}%)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {platformBudgets.length === 0 ? (
              <div className="empty-state">
                <Package className="empty-icon" />
                <p>该平台暂无SKU配置</p>
              </div>
            ) : (
              <div className="sku-config-list">
                {platformBudgets.map((item) => {
                  const key = `${item.platform}-${item.sku}`;
                  const percent = skuPercents.get(key) || '';
                  const amount = calculateAmount(percent);

                  return (
                    <div key={key} className="sku-config-item">
                      <div className="sku-info">
                        <Package className="sku-icon" />
                        <span className="sku-name">{item.sku}</span>
                      </div>
                      <div className="sku-percent">
                        <div className="percent-input-wrapper">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={percent}
                            onChange={(e) => handlePercentChange(key, e.target.value)}
                            className="percent-input"
                            placeholder="%"
                          />
                          <span className="percent-symbol">%</span>
                        </div>
                      </div>
                      <div className="sku-amount-calculated">
                        <span className="amount-label">=</span>
                        <span className="amount-value">¥{amount.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConfigPage;

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
import { Package, Store, Loader2, Save, PieChart, Calculator } from 'lucide-react';
import './config.css';

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const ConfigPage: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonth());
  const [selectedSku, setSelectedSku] = useState<string>(SKUS[0]);
  const [budgets, setBudgets] = useState<BudgetWithProportion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // SKU 总预算输入
  const [skuBudgetInput, setSkuBudgetInput] = useState<string>('');
  // 平台百分比输入
  const [platformPercents, setPlatformPercents] = useState<Map<string, string>>(new Map());

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const response = await axiosForBackend.get(`/api/budgets?month=${month}`);
      const data = response.data as BudgetWithProportion[];
      setBudgets(data);
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

  // 当前 SKU 的数据
  const skuBudgets = useMemo(() => {
    return budgets.filter((item) => item.sku === selectedSku);
  }, [budgets, selectedSku]);

  // 切换 SKU 时初始化数据
  useEffect(() => {
    const skuTotal = skuBudgets.reduce((sum, item) => sum + item.amount, 0);
    setSkuBudgetInput(skuTotal > 0 ? String(skuTotal) : '');

    // 初始化平台百分比
    const newPercents = new Map<string, string>();
    skuBudgets.forEach((item) => {
      if (skuTotal > 0) {
        const percent = ((item.amount / skuTotal) * 100).toFixed(1);
        newPercents.set(item.platform, percent);
      } else {
        // 默认平均分配
        const defaultPercent = (100 / PLATFORMS.length).toFixed(1);
        newPercents.set(item.platform, defaultPercent);
      }
    });
    setPlatformPercents(newPercents);
  }, [selectedSku, skuBudgets]);

  // 计算 SKU 总预算
  const skuTotal = useMemo(() => {
    return parseFloat(skuBudgetInput) || 0;
  }, [skuBudgetInput]);

  // 计算实际分配的百分比总和
  const totalPercent = useMemo(() => {
    return skuBudgets.reduce((sum, item) => {
      const percent = parseFloat(platformPercents.get(item.platform) || '0') || 0;
      return sum + percent;
    }, 0);
  }, [skuBudgets, platformPercents]);

  const handleSkuBudgetChange = (value: string) => {
    setSkuBudgetInput(value);
  };

  const handlePercentChange = (platform: string, value: string) => {
    // 限制输入范围 0-100
    const numValue = parseFloat(value);
    if (value === '' || (numValue >= 0 && numValue <= 100)) {
      setPlatformPercents((prev) => {
        const newMap = new Map(prev);
        newMap.set(platform, value);
        return newMap;
      });
    }
  };

  const calculateAmount = (percent: string): number => {
    const p = parseFloat(percent) || 0;
    return Math.round(skuTotal * (p / 100));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 构建保存数据
      const records = budgets.map((item) => {
        if (item.sku === selectedSku) {
          const percent = platformPercents.get(item.platform) || '0';
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

          {/* SKU 选择 */}
          <Select value={selectedSku} onValueChange={setSelectedSku}>
            <SelectTrigger className="sku-select">
              <Package className="select-icon" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SKUS.map((sku) => (
                <SelectItem key={sku} value={sku}>
                  {sku}
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
        <div className="stat-card sku-total">
          <div className="stat-label">{selectedSku} 总预算</div>
          <div className="stat-value">
            <Input
              type="number"
              min="0"
              value={skuBudgetInput}
              onChange={(e) => handleSkuBudgetChange(e.target.value)}
              className="sku-budget-input"
              placeholder="输入金额"
            />
          </div>
        </div>
        <div className="stat-card platform-count">
          <div className="stat-label">分配平台数</div>
          <div className="stat-value">{PLATFORMS.length} 个</div>
        </div>
        <div className="stat-card proportion">
          <div className="stat-label">已分配占比</div>
          <div className={`stat-value ${totalPercent > 100 ? 'exceed' : ''}`}>
            {totalPercent.toFixed(1)}%
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
              {selectedSku} - 平台预算分配
              <span className={`percent-total ${totalPercent !== 100 ? 'warning' : ''}`}>
                目标: 100%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {skuBudgets.length === 0 ? (
              <div className="empty-state">
                <Store className="empty-icon" />
                <p>该SKU暂无平台配置</p>
              </div>
            ) : (
              <div className="platform-config-list">
                {PLATFORMS.map((platform) => {
                  const percent = platformPercents.get(platform) || '';
                  const amount = calculateAmount(percent);

                  return (
                    <div key={platform} className="platform-config-item">
                      <div className="platform-info">
                        <Store className="platform-icon" />
                        <span className="platform-name">{platform}</span>
                      </div>
                      <div className="platform-percent">
                        <div className="percent-input-wrapper">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={percent}
                            onChange={(e) => handlePercentChange(platform, e.target.value)}
                            className="percent-input"
                            placeholder="%"
                          />
                          <span className="percent-symbol">%</span>
                        </div>
                      </div>
                      <div className="platform-amount-calculated">
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

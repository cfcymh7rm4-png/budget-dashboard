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
import { Settings, Store, Package, Loader2, Save, PieChart } from 'lucide-react';
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
  const [editingRows, setEditingRows] = useState<Map<string, { amount: string }>>(new Map());

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const response = await axiosForBackend.get(`/api/budgets?month=${month}`);
      const data = response.data as BudgetWithProportion[];
      setBudgets(data);
      const newEditing = new Map<string, { amount: string }>();
      data.forEach((item) => {
        newEditing.set(`${item.platform}-${item.sku}`, { amount: String(item.amount) });
      });
      setEditingRows(newEditing);
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

  // 当前平台的数据
  const platformBudgets = useMemo(() => {
    return budgets.filter((item) => item.platform === selectedPlatform);
  }, [budgets, selectedPlatform]);

  // 当前平台的总预算
  const platformTotal = useMemo(() => {
    return platformBudgets.reduce((sum, item) => {
      const key = `${item.platform}-${item.sku}`;
      const editData = editingRows.get(key);
      return sum + (editData ? parseFloat(editData.amount) || 0 : item.amount);
    }, 0);
  }, [platformBudgets, editingRows]);

  // 全局总预算
  const globalTotal = useMemo(() => {
    return budgets.reduce((sum, item) => {
      const key = `${item.platform}-${item.sku}`;
      const editData = editingRows.get(key);
      return sum + (editData ? parseFloat(editData.amount) || 0 : item.amount);
    }, 0);
  }, [budgets, editingRows]);

  const handleInputChange = (key: string, value: string) => {
    setEditingRows((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, { amount: value });
      return newMap;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const records = budgets.map((item) => {
        const key = `${item.platform}-${item.sku}`;
        const editData = editingRows.get(key);
        return {
          platform: item.platform,
          sku: item.sku,
          amount: editData ? parseFloat(editData.amount) || 0 : item.amount,
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
          <div className="stat-label">{selectedPlatform} 预算</div>
          <div className="stat-value">¥{platformTotal.toLocaleString()}</div>
        </div>
        <div className="stat-card global-total">
          <div className="stat-label">全平台总预算</div>
          <div className="stat-value">¥{globalTotal.toLocaleString()}</div>
        </div>
        <div className="stat-card proportion">
          <div className="stat-label">占比</div>
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
              <Settings className="title-icon" />
              {selectedPlatform} - SKU 预算配置
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
                  const editData = editingRows.get(key);
                  const amount = editData ? parseFloat(editData.amount) || 0 : item.amount;
                  const proportion = platformTotal > 0 ? (amount / platformTotal) * 100 : 0;

                  return (
                    <div key={key} className="sku-config-item">
                      <div className="sku-info">
                        <Package className="sku-icon" />
                        <span className="sku-name">{item.sku}</span>
                      </div>
                      <div className="sku-amount">
                        <Input
                          type="number"
                          min="0"
                          value={editData?.amount ?? String(item.amount)}
                          onChange={(e) => handleInputChange(key, e.target.value)}
                          className="amount-input"
                          placeholder="输入预算金额"
                        />
                      </div>
                      <div className="sku-proportion">
                        <PieChart className="proportion-icon" />
                        <span className="proportion-value">{proportion.toFixed(1)}%</span>
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

import React, { useState, useEffect } from 'react';
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
import { Settings, Calculator, Loader2, Save } from 'lucide-react';
import './config.css';

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const ConfigPage: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonth());
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

  const handleInputChange = (key: string, field: 'amount', value: string) => {
    setEditingRows((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(key) || { amount: '' };
      newMap.set(key, { ...current, [field]: value });
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

  const totalBudget = budgets.reduce((sum, item) => {
    const key = `${item.platform}-${item.sku}`;
    const editData = editingRows.get(key);
    return sum + (editData ? parseFloat(editData.amount) || 0 : item.amount);
  }, 0);

  return (
    <div className="config-container">
      <div className="config-header">
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
        <div className="header-right">
          <div className="total-info">
            <span className="total-label">总预算:</span>
            <span className="total-value">¥{totalBudget.toLocaleString()}</span>
          </div>
          <Button onClick={handleSave} isLoading={saving}>
            <Save className="btn-icon" />
            保存配置
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <Card className="config-card">
          <CardHeader>
            <CardTitle className="card-title">
              <Settings className="title-icon" />
              预算配置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="table-wrapper">
              <table className="config-table">
                <thead>
                  <tr>
                    <th>平台</th>
                    <th>SKU</th>
                    <th>预算金额</th>
                    <th>占比</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((item) => {
                    const key = `${item.platform}-${item.sku}`;
                    const editData = editingRows.get(key);
                    const amount = editData ? parseFloat(editData.amount) || 0 : item.amount;
                    const proportion = totalBudget > 0 ? (amount / totalBudget) * 100 : 0;

                    return (
                      <tr key={key}>
                        <td className="platform-cell">{item.platform}</td>
                        <td className="sku-cell">{item.sku}</td>
                        <td className="amount-cell">
                          <Input
                            type="number"
                            min="0"
                            value={editData?.amount ?? String(item.amount)}
                            onChange={(e) => handleInputChange(key, 'amount', e.target.value)}
                            className="amount-input"
                          />
                        </td>
                        <td className="proportion-cell">{proportion.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConfigPage;

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AppForm } from '@/components/apps/app-form';
import { AppCard } from '@/components/apps/app-card';
import { App } from '@/types';
import { Plus, RefreshCw, BarChart3, Settings } from 'lucide-react';

export default function Home() {
  const [apps, setApps] = useState<App[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<App | undefined>();
  const [loading, setLoading] = useState({
    apps: true,
    form: false,
    fetchAll: false,
    analyzeAll: false,
  });
  const [appLoading, setAppLoading] = useState<Record<string, { fetch?: boolean; analyze?: boolean }>>({});
  const [appStats, setAppStats] = useState<Record<string, any>>({});

  // 加载应用列表
  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      setLoading(prev => ({ ...prev, apps: true }));
      const response = await fetch('/api/apps');
      if (response.ok) {
        const data = await response.json();
        setApps(data.data.apps || []);

        // 加载统计信息
        loadAppStats(data.data.apps || []);
      }
    } catch (error) {
      console.error('Failed to load apps:', error);
    } finally {
      setLoading(prev => ({ ...prev, apps: false }));
    }
  };

  const loadAppStats = async (appList: App[]) => {
    const stats: Record<string, any> = {};

    for (const app of appList) {
      try {
        const response = await fetch(`/api/apps/${app.id}/stats`);
        if (response.ok) {
          const data = await response.json();
          stats[app.id] = data.data;
        }
      } catch (error) {
        console.error(`Failed to load stats for app ${app.id}:`, error);
      }
    }

    setAppStats(stats);
  };

  const handleAddApp = () => {
    setEditingApp(undefined);
    setShowForm(true);
  };

  const handleEditApp = (app: App) => {
    setEditingApp(app);
    setShowForm(true);
  };

  const handleFormSubmit = async (appData: Omit<App, 'lastFetched'>) => {
    try {
      setLoading(prev => ({ ...prev, form: true }));

      const url = editingApp ? `/api/apps/${editingApp.id}` : '/api/apps';
      const method = editingApp ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appData),
      });

      if (response.ok) {
        await loadApps();
        setShowForm(false);
        setEditingApp(undefined);
      } else {
        const error = await response.json();
        alert(error.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to save app:', error);
      alert('操作失败');
    } finally {
      setLoading(prev => ({ ...prev, form: false }));
    }
  };

  const handleDeleteApp = async (app: App) => {
    try {
      const response = await fetch(`/api/apps/${app.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadApps();
      } else {
        const error = await response.json();
        alert(error.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete app:', error);
      alert('删除失败');
    }
  };

  const handleFetchApp = async (app: App) => {
    try {
      setAppLoading(prev => ({ ...prev, [app.id]: { ...prev[app.id], fetch: true } }));

      const response = await fetch(`/api/apps/${app.id}/fetch`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`成功抓取 ${data.data.reviewCount} 条评论`);
        await loadApps();
      } else {
        const error = await response.json();
        alert(error.error || '抓取失败');
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      alert('抓取失败');
    } finally {
      setAppLoading(prev => ({ ...prev, [app.id]: { ...prev[app.id], fetch: false } }));
    }
  };

  const handleAnalyzeApp = async (app: App) => {
    try {
      setAppLoading(prev => ({ ...prev, [app.id]: { ...prev[app.id], analyze: true } }));

      const response = await fetch(`/api/apps/${app.id}/analyze`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        // 分析完成后直接跳转到报告页面
        window.location.href = `/analysis/${app.id}`;
      } else {
        const error = await response.json();
        alert(error.error || '分析失败');
      }
    } catch (error) {
      console.error('Failed to analyze reviews:', error);
      alert('分析失败');
    } finally {
      setAppLoading(prev => ({ ...prev, [app.id]: { ...prev[app.id], analyze: false } }));
    }
  };

  const handleViewReviews = (app: App) => {
    window.location.href = `/reviews/${app.id}`;
  };

  const handleViewAnalysis = (app: App) => {
    window.location.href = `/analysis/${app.id}`;
  };

  const handleFetchAll = async () => {
    try {
      setLoading(prev => ({ ...prev, fetchAll: true }));

      const response = await fetch('/api/fetch-all', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`批量抓取完成，共获取 ${data.data.totalReviews} 条评论`);
        await loadApps();
      } else {
        const error = await response.json();
        alert(error.error || '批量抓取失败');
      }
    } catch (error) {
      console.error('Failed to fetch all reviews:', error);
      alert('批量抓取失败');
    } finally {
      setLoading(prev => ({ ...prev, fetchAll: false }));
    }
  };

  const handleAnalyzeAll = async () => {
    try {
      setLoading(prev => ({ ...prev, analyzeAll: true }));

      const response = await fetch('/api/analyze-all', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`批量分析完成，共分析 ${data.data.totalAnalyzed} 条评论`);
        await loadApps();
      } else {
        const error = await response.json();
        alert(error.error || '批量分析失败');
      }
    } catch (error) {
      console.error('Failed to analyze all reviews:', error);
      alert('批量分析失败');
    } finally {
      setLoading(prev => ({ ...prev, analyzeAll: false }));
    }
  };

  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <AppForm
            app={editingApp}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingApp(undefined);
            }}
            isLoading={loading.form}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                AppStore 评论分析系统
              </h1>
              <p className="text-gray-600 mt-1">
                管理应用，抓取评论，智能分析用户反馈
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleFetchAll}
                disabled={loading.fetchAll || apps.length === 0}
                className="flex items-center gap-2"
              >
                {loading.fetchAll ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                批量抓取
              </Button>
              <Button
                variant="outline"
                onClick={handleAnalyzeAll}
                disabled={loading.analyzeAll || apps.length === 0}
                className="flex items-center gap-2"
              >
                {loading.analyzeAll ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                批量分析
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/settings'}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                配置
              </Button>
              <Button onClick={handleAddApp} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                添加应用
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="container mx-auto px-4 py-8">
        {loading.apps ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            加载中...
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">还没有添加任何应用</p>
            <Button onClick={handleAddApp} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              添加第一个应用
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                stats={appStats[app.id]}
                onEdit={handleEditApp}
                onDelete={handleDeleteApp}
                onFetch={handleFetchApp}
                onAnalyze={handleAnalyzeApp}
                onViewReviews={handleViewReviews}
                onViewAnalysis={handleViewAnalysis}
                isLoading={appLoading[app.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

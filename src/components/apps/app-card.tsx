'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { App } from '@/types';
import { getCountryFlag, getCountryName, formatRelativeTime } from '@/lib/utils';
import { Download, Edit, Trash2, BarChart3, RefreshCw } from 'lucide-react';

interface AppCardProps {
  app: App;
  stats?: {
    totalReviews: number;
    averageRating: number;
    lastAnalyzed?: string;
  };
  onEdit: (app: App) => void;
  onDelete: (app: App) => void;
  onFetch: (app: App) => void;
  onAnalyze: (app: App) => void;
  onViewReviews: (app: App) => void;
  onViewAnalysis?: (app: App) => void;
  isLoading?: {
    fetch?: boolean;
    analyze?: boolean;
  };
}

export function AppCard({
  app,
  stats,
  onEdit,
  onDelete,
  onFetch,
  onAnalyze,
  onViewReviews,
  onViewAnalysis,
  isLoading = {},
}: AppCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(app);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      // 3秒后自动取消确认状态
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {getCountryFlag(app.country)}
              {app.name}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              ID: {app.id} • {getCountryName(app.country)}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(app)}
              title="编辑应用"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              title={showDeleteConfirm ? "确认删除" : "删除应用"}
              className={showDeleteConfirm ? "text-red-600 hover:text-red-700" : ""}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 统计信息 */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-500">评论数量</p>
              <p className="text-lg font-semibold">{stats.totalReviews}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">平均评分</p>
              <p className="text-lg font-semibold">
                {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '-'}
              </p>
            </div>
          </div>
        )}

        {/* 最后更新时间 */}
        <div className="text-xs text-gray-500">
          {app.lastFetched ? (
            <>最后抓取: {formatRelativeTime(app.lastFetched)}</>
          ) : (
            <>尚未抓取评论</>
          )}
          {stats?.lastAnalyzed && (
            <> • 最后分析: {formatRelativeTime(stats.lastAnalyzed)}</>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFetch(app)}
            disabled={isLoading.fetch}
            className="flex items-center gap-2"
          >
            {isLoading.fetch ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isLoading.fetch ? '抓取中...' : '立即抓取'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onAnalyze(app)}
            disabled={isLoading.analyze || !stats?.totalReviews}
            className="flex items-center gap-2"
          >
            {isLoading.analyze ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
            {isLoading.analyze ? '分析中...' : '生成分析'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onViewReviews(app)}
            disabled={!stats?.totalReviews}
          >
            查看评论 {stats?.totalReviews ? `(${stats.totalReviews})` : ''}
          </Button>

          {onViewAnalysis && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewAnalysis(app)}
              disabled={!stats?.totalReviews}
            >
              查看分析
            </Button>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            再次点击删除按钮确认删除此应用
          </div>
        )}
      </CardContent>
    </Card>
  );
}

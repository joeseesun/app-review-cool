'use client';

import { useState, useEffect } from 'react';
import { AggregatedAnalysis, App } from '@/types';
import { SentimentChart } from './sentiment-chart';
import { ClusteredIssues } from './clustered-issues';
import { SuggestionsList } from './suggestions-list';
import { VersionAnalysis } from './version-analysis';
import { ReportPreview } from '@/components/report/report-preview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, BarChart3, FileText } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface AnalysisDashboardProps {
  app: App;
}

export function AnalysisDashboard({ app }: AnalysisDashboardProps) {
  const [analysis, setAnalysis] = useState<AggregatedAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);

  useEffect(() => {
    loadAnalysis();
  }, [app.id]);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/apps/${app.id}/analysis`);
      if (response.ok) {
        const data = await response.json();
        console.log('Analysis API response:', data); // 调试日志
        // 修复数据路径：data.data.analysis
        setAnalysis(data.data?.analysis || null);
      } else {
        console.error('Analysis API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to load analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAnalysis = async () => {
    try {
      setGenerating(true);
      const response = await fetch(`/api/apps/${app.id}/generate-analysis`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadAnalysis();
      } else {
        const error = await response.json();
        alert(error.error || '生成分析失败');
      }
    } catch (error) {
      console.error('Failed to generate analysis:', error);
      alert('生成分析失败');
    } finally {
      setGenerating(false);
    }
  };

  const exportReport = async () => {
    try {
      const response = await fetch(`/api/apps/${app.id}/export-report`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${app.name}-分析报告-${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const error = await response.json();
        alert(error.error || '导出报告失败');
      }
    } catch (error) {
      console.error('Failed to export report:', error);
      alert('导出报告失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        加载分析数据中...
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">暂无分析数据</h3>
        <p className="text-gray-500 mb-4">
          请先抓取评论并进行分析，然后生成聚合分析报告
        </p>
        <Button onClick={generateAnalysis} disabled={generating}>
          {generating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              生成中...
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4 mr-2" />
              生成分析报告
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{app.name} 分析报告</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>总评论数: {analysis.totalReviews}</span>
            <span>生成时间: {formatRelativeTime(analysis.generatedAt)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAnalysis}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button variant="outline" onClick={generateAnalysis} disabled={generating}>
            {generating ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <BarChart3 className="h-4 w-4 mr-2" />
            )}
            重新生成
          </Button>
          <Button variant="outline" onClick={() => setShowReportPreview(!showReportPreview)}>
            <FileText className="h-4 w-4 mr-2" />
            {showReportPreview ? '隐藏' : '显示'}报告预览
          </Button>
          <Button onClick={exportReport}>
            <Download className="h-4 w-4 mr-2" />
            快速导出
          </Button>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{analysis.totalReviews}</div>
            <p className="text-xs text-muted-foreground">总评论数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-green-600">
              {analysis.sentimentDistribution.positive}
            </div>
            <p className="text-xs text-muted-foreground">正面评论</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-red-600">
              {analysis.sentimentDistribution.negative}
            </div>
            <p className="text-xs text-muted-foreground">负面评论</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-gray-600">
              {analysis.sentimentDistribution.neutral}
            </div>
            <p className="text-xs text-muted-foreground">中性评论</p>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SentimentChart data={analysis.sentimentDistribution} />
        {analysis.clusteredIssues && analysis.clusteredIssues.length > 0 ? (
          <ClusteredIssues data={analysis.clusteredIssues} />
        ) : (
          <ClusteredIssues data={[]} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SuggestionsList data={analysis.suggestions} />
        <Card>
          <CardHeader>
            <CardTitle>快速洞察</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">情感分析</h4>
                <div className="text-sm text-gray-600">
                  {analysis.sentimentDistribution.positive > analysis.sentimentDistribution.negative 
                    ? `用户整体反馈较为正面，正面评论占比 ${((analysis.sentimentDistribution.positive / analysis.totalReviews) * 100).toFixed(1)}%`
                    : `用户反馈存在较多负面意见，负面评论占比 ${((analysis.sentimentDistribution.negative / analysis.totalReviews) * 100).toFixed(1)}%`
                  }
                </div>
              </div>
              
              {analysis.commonIssues.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">主要问题</h4>
                  <div className="text-sm text-gray-600">
                    最常见的问题是"{analysis.commonIssues[0].issue}"，
                    出现了 {analysis.commonIssues[0].count} 次
                  </div>
                </div>
              )}

              {analysis.suggestions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">用户建议</h4>
                  <div className="text-sm text-gray-600">
                    用户最希望的改进是"{analysis.suggestions[0].suggestion}"，
                    被提及 {analysis.suggestions[0].count} 次
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 版本分析 */}
      {analysis.versionAnalysis.length > 0 && (
        <VersionAnalysis data={analysis.versionAnalysis} />
      )}

      {/* 报告预览 */}
      {showReportPreview && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">报告预览与导出</h3>
          <ReportPreview app={app} analysis={analysis} />
        </div>
      )}
    </div>
  );
}

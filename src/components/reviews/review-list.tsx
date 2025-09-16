'use client';

import { useState, useMemo } from 'react';
import { AppStoreReview, AnalysisResult } from '@/types';
import { ReviewCard } from './review-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, SortAsc, SortDesc } from 'lucide-react';

interface ReviewListProps {
  reviews: AppStoreReview[];
  analysisResults: AnalysisResult[];
  showAnalysis?: boolean;
}

type SortOption = 'date' | 'rating' | 'sentiment';
type FilterOption = 'all' | 'positive' | 'negative' | 'neutral' | '5' | '4' | '3' | '2' | '1';

export function ReviewList({ reviews, analysisResults, showAnalysis = true }: ReviewListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  
  const itemsPerPage = 10;

  // 创建评论ID到分析结果的映射
  const analysisMap = useMemo(() => {
    const map = new Map<string, AnalysisResult>();
    analysisResults.forEach(analysis => {
      map.set(analysis.reviewId, analysis);
    });
    return map;
  }, [analysisResults]);

  // 过滤和排序评论
  const filteredAndSortedReviews = useMemo(() => {
    let filtered = reviews;

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(review => 
        review.title.toLowerCase().includes(term) ||
        review.content.toLowerCase().includes(term) ||
        review.authorName.toLowerCase().includes(term)
      );
    }

    // 条件过滤
    if (filter !== 'all') {
      if (['positive', 'negative', 'neutral'].includes(filter)) {
        filtered = filtered.filter(review => {
          const analysis = analysisMap.get(review.id);
          return analysis?.sentiment === filter;
        });
      } else if (['1', '2', '3', '4', '5'].includes(filter)) {
        filtered = filtered.filter(review => review.rating === filter);
      }
    }

    // 排序
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.updated).getTime() - new Date(b.updated).getTime();
          break;
        case 'rating':
          comparison = parseInt(a.rating) - parseInt(b.rating);
          break;
        case 'sentiment':
          const aAnalysis = analysisMap.get(a.id);
          const bAnalysis = analysisMap.get(b.id);
          const sentimentOrder = { positive: 3, neutral: 2, negative: 1 };
          comparison = (sentimentOrder[aAnalysis?.sentiment || 'neutral'] || 2) - 
                      (sentimentOrder[bAnalysis?.sentiment || 'neutral'] || 2);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [reviews, analysisMap, searchTerm, filter, sortBy, sortOrder]);

  // 分页
  const totalPages = Math.ceil(filteredAndSortedReviews.length / itemsPerPage);
  const paginatedReviews = filteredAndSortedReviews.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSortChange = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // 获取基于搜索过滤的评论统计（不包括情感和评分过滤）
  const getBaseFilteredReviews = () => {
    let filtered = reviews;

    // 只应用搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(review =>
        review.title.toLowerCase().includes(term) ||
        review.content.toLowerCase().includes(term) ||
        review.authorName.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const getSentimentStats = () => {
    const stats = { positive: 0, negative: 0, neutral: 0, total: 0 };
    const baseFiltered = getBaseFilteredReviews();

    baseFiltered.forEach(review => {
      const analysis = analysisMap.get(review.id);
      if (analysis) {
        stats[analysis.sentiment]++;
      }
      stats.total++;
    });
    return stats;
  };

  const sentimentStats = getSentimentStats();

  return (
    <div className="space-y-6">
      {/* 搜索和过滤器 */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="搜索评论内容、标题或用户名..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            过滤器
          </Button>
        </div>

        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            {/* 排序选项 */}
            <div>
              <label className="block text-sm font-medium mb-2">排序方式</label>
              <div className="flex gap-2">
                {[
                  { key: 'date', label: '时间' },
                  { key: 'rating', label: '评分' },
                  { key: 'sentiment', label: '情感' },
                ].map(option => (
                  <Button
                    key={option.key}
                    variant={sortBy === option.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSortChange(option.key as SortOption)}
                    className="flex items-center gap-1"
                  >
                    {option.label}
                    {sortBy === option.key && (
                      sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* 过滤选项 */}
            <div>
              <label className="block text-sm font-medium mb-2">过滤条件</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  全部 ({getBaseFilteredReviews().length})
                </Button>
                
                {showAnalysis && (
                  <>
                    <Button
                      variant={filter === 'positive' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('positive')}
                      className="text-green-600"
                    >
                      正面 ({sentimentStats.positive})
                    </Button>
                    <Button
                      variant={filter === 'negative' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('negative')}
                      className="text-red-600"
                    >
                      负面 ({sentimentStats.negative})
                    </Button>
                    <Button
                      variant={filter === 'neutral' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('neutral')}
                      className="text-gray-600"
                    >
                      中性 ({sentimentStats.neutral})
                    </Button>
                  </>
                )}

                {['5', '4', '3', '2', '1'].map(rating => {
                  const baseFiltered = getBaseFilteredReviews();
                  const ratingCount = baseFiltered.filter(review => review.rating === rating).length;

                  return (
                    <Button
                      key={rating}
                      variant={filter === rating ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter(rating as FilterOption)}
                    >
                      {rating}星 ({ratingCount})
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          显示 {paginatedReviews.length} / {filteredAndSortedReviews.length} 条评论
        </div>
        {showAnalysis && (
          <div className="flex gap-2">
            <Badge
              variant="secondary"
              className={`cursor-pointer transition-colors ${
                filter === 'positive'
                  ? 'bg-green-200 text-green-800 border-green-300'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
              onClick={() => setFilter(filter === 'positive' ? 'all' : 'positive')}
            >
              正面 {sentimentStats.positive}
            </Badge>
            <Badge
              variant="secondary"
              className={`cursor-pointer transition-colors ${
                filter === 'negative'
                  ? 'bg-red-200 text-red-800 border-red-300'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
              onClick={() => setFilter(filter === 'negative' ? 'all' : 'negative')}
            >
              负面 {sentimentStats.negative}
            </Badge>
            <Badge
              variant="secondary"
              className={`cursor-pointer transition-colors ${
                filter === 'neutral'
                  ? 'bg-gray-200 text-gray-800 border-gray-300'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setFilter(filter === 'neutral' ? 'all' : 'neutral')}
            >
              中性 {sentimentStats.neutral}
            </Badge>
          </div>
        )}
      </div>

      {/* 评论列表 */}
      <div className="space-y-4">
        {paginatedReviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || filter !== 'all' ? '没有找到匹配的评论' : '暂无评论数据'}
          </div>
        ) : (
          paginatedReviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              analysis={analysisMap.get(review.id)}
              showAnalysis={showAnalysis}
            />
          ))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            上一页
          </Button>
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}

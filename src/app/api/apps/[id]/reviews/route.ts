import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { ApiResponse, AppStoreReview, AnalysisResult } from '@/types';

const storage = getStorage();

interface ReviewsResponse {
  reviews: AppStoreReview[];
  analysisResults: AnalysisResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// GET /api/apps/[id]/reviews - 获取应用的评论列表
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<ReviewsResponse>>> {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    
    // 分页参数
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    // 检查应用是否存在
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    
    if (!app) {
      return NextResponse.json(
        {
          success: false,
          error: '应用不存在',
        },
        { status: 404 }
      );
    }

    // 获取评论和分析结果
    const allReviews = await storage.getReviews(id);
    const analysisResults = await storage.getAnalysisResults(id);
    
    // 按时间排序（最新的在前）
    const sortedReviews = allReviews.sort((a, b) => 
      new Date(b.updated).getTime() - new Date(a.updated).getTime()
    );
    
    // 分页
    const paginatedReviews = sortedReviews.slice(offset, offset + limit);
    const totalPages = Math.ceil(allReviews.length / limit);

    const response: ReviewsResponse = {
      reviews: paginatedReviews,
      analysisResults,
      pagination: {
        page,
        limit,
        total: allReviews.length,
        totalPages,
      },
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Failed to get reviews:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取评论列表失败',
      },
      { status: 500 }
    );
  }
}

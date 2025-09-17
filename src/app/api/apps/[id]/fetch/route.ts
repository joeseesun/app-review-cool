import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AppStoreService } from '@/lib/appstore/service';
import { ApiResponse } from '@/types';

const storage = getStorage();
const appStoreService = new AppStoreService();

interface FetchResult {
  reviewCount: number;
  message: string;
}

// POST /api/apps/[id]/fetch - 抓取指定应用的评论
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<FetchResult>>> {
  try {
    const { id } = params;
    
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

    console.log(`Starting to fetch reviews for app: ${app.name} (${app.id})`);

    // 抓取评论
    let reviews;
    try {
      reviews = await appStoreService.fetchAppReviews(id, false); // 先尝试非增量抓取
      console.log(`Successfully fetched ${reviews.length} reviews`);
    } catch (fetchError) {
      console.error('Fetch error details:', fetchError);
      throw new Error(`抓取失败: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }

    const result: FetchResult = {
      reviewCount: reviews.length,
      message: `成功抓取 ${reviews.length} 条新评论`,
    };

    console.log(`Fetch completed for app: ${app.name}, got ${reviews.length} reviews`);

    return NextResponse.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    
    const errorMessage = error instanceof Error ? error.message : '抓取评论失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

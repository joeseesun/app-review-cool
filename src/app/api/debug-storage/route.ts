import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AppStoreFetcher } from '@/lib/appstore/fetcher';

export async function GET(request: NextRequest) {
  try {
    const storage = getStorage();

    // 测试获取应用列表
    const apps = await storage.getApps();

    // 测试获取评论
    const reviews = await storage.getReviews('6448311069');

    // 测试直接抓取评论
    let fetchResult = null;
    try {
      const testReviews = await AppStoreFetcher.fetchReviews({
        appId: '6448311069',
        country: 'us',
        incremental: false
      });
      fetchResult = {
        success: true,
        count: testReviews.length,
        sample: testReviews.slice(0, 2)
      };
    } catch (fetchError) {
      fetchResult = {
        success: false,
        error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        storageType: process.env.STORAGE_TYPE,
        apps: apps,
        reviewsCount: reviews.length,
        supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Not Set',
        supabaseKey: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not Set',
        fetchTest: fetchResult
      }
    });
  } catch (error) {
    console.error('Storage debug error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const storage = getStorage();
    
    // 检查存储类型
    const storageType = process.env.STORAGE_TYPE || 'local';
    
    // 检查环境变量
    const envVars = {
      STORAGE_TYPE: process.env.STORAGE_TYPE,
      SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
    };
    
    // 尝试获取应用列表
    let apps = [];
    let appsError = null;
    try {
      apps = await storage.getApps();
    } catch (error) {
      appsError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // 测试网络连接
    let networkTest = null;
    try {
      const response = await fetch('https://itunes.apple.com/us/rss/customerreviews/id=6448311069/page=1/json', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AppReviewBot/1.0)',
          'Accept': 'application/json',
        },
      });
      networkTest = {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      networkTest = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 测试抓取功能
    let fetchTest = null;
    try {
      const { AppStoreService } = await import('@/lib/appstore/service');
      const appStoreService = new AppStoreService();

      // 尝试抓取少量评论
      const reviews = await appStoreService.fetchAppReviews('6448311069', false);
      fetchTest = {
        success: true,
        reviewCount: reviews.length,
        sampleReview: reviews[0] || null,
      };
    } catch (error) {
      fetchTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
    
    return NextResponse.json({
      success: true,
      data: {
        storageType,
        envVars,
        apps: {
          count: apps.length,
          data: apps.slice(0, 3), // 只返回前3个应用
          error: appsError,
        },
        networkTest,
        fetchTest,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

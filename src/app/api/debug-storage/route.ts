import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const storage = getStorage();
    
    // 测试获取应用列表
    const apps = await storage.getApps();
    
    // 测试获取评论
    const reviews = await storage.getReviews('6448311069');
    
    return NextResponse.json({
      success: true,
      data: {
        storageType: process.env.STORAGE_TYPE,
        apps: apps,
        reviewsCount: reviews.length,
        supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Not Set',
        supabaseKey: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not Set'
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

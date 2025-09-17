import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const storage = getStorage();
    
    // 初始化默认应用数据
    if ('initializeDefaultApps' in storage) {
      await (storage as any).initializeDefaultApps();
    }
    
    // 获取应用数据验证初始化结果
    const apps = await storage.getApps();
    
    return NextResponse.json({
      success: true,
      data: {
        appsCount: apps.length,
        apps: apps.map(app => ({ id: app.id, name: app.name, country: app.country }))
      },
      message: `初始化完成，共加载 ${apps.length} 个应用`
    });
  } catch (error) {
    console.error('Failed to initialize:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

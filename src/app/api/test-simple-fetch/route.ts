import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 测试最简单的网络请求
    const url = 'https://itunes.apple.com/us/rss/customerreviews/id=6448311069/json';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AppReviewBot/1.0)',
      },
      // 添加超时设置
      signal: AbortSignal.timeout(10000), // 10秒超时
    });
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        url
      });
    }
    
    const text = await response.text();
    
    // 尝试解析JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: 'JSON parse failed',
        responseLength: text.length,
        responseStart: text.substring(0, 200)
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        status: response.status,
        hasFeed: !!data.feed,
        hasEntries: !!(data.feed && data.feed.entry),
        entryCount: data.feed && data.feed.entry ? data.feed.entry.length : 0
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name || 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

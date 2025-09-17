import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = 'https://itunes.apple.com/us/rss/customerreviews/id=6448311069/json';
    
    console.log('Fetching from:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('Data structure:', {
      hasFeed: !!data.feed,
      hasEntry: !!(data.feed && data.feed.entry),
      entryCount: data.feed && data.feed.entry ? data.feed.entry.length : 0
    });
    
    return NextResponse.json({
      success: true,
      data: {
        url,
        status: response.status,
        hasFeed: !!data.feed,
        hasEntry: !!(data.feed && data.feed.entry),
        entryCount: data.feed && data.feed.entry ? data.feed.entry.length : 0,
        sampleEntry: data.feed && data.feed.entry && data.feed.entry[0] ? {
          id: data.feed.entry[0].id?.label,
          title: data.feed.entry[0].title?.label,
          rating: data.feed.entry[0]['im:rating']?.label,
          author: data.feed.entry[0].author?.name?.label
        } : null
      }
    });
  } catch (error) {
    console.error('Fetch test error:', error);
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

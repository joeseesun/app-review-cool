import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const envVars = {
      MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY ? 'Set' : 'Not Set',
      MOONSHOT_BASE_URL: process.env.MOONSHOT_BASE_URL || 'Not Set',
      STORAGE_TYPE: process.env.STORAGE_TYPE || 'Not Set',
      CRON_SECRET: process.env.CRON_SECRET ? 'Set' : 'Not Set',
    };

    return NextResponse.json({
      success: true,
      data: envVars
    });
  } catch (error) {
    console.error('Environment test error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check environment variables' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { ApiResponse, AggregatedAnalysis } from '@/types';

const storage = getStorage();
const analysisService = new AnalysisService();

// POST /api/apps/[id]/generate-analysis - 生成聚合分析报告
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<{ analysis: AggregatedAnalysis }>>> {
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

    console.log(`Generating aggregated analysis for app: ${app.name} (${app.id})`);

    // 生成聚合分析
    const analysis = await analysisService.generateAggregatedAnalysis(id);
    
    console.log(`Analysis generated for app: ${app.name}, ${analysis.totalReviews} reviews analyzed`);

    return NextResponse.json({
      success: true,
      data: { analysis },
      message: '分析报告生成成功',
    });
  } catch (error) {
    console.error('Failed to generate analysis:', error);
    
    const errorMessage = error instanceof Error ? error.message : '生成分析报告失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

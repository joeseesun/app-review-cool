import { BaseStorage } from './base';
import { App, AppStoreReview, AnalysisResult, PromptTemplate } from '@/types';

// Supabase 存储实现
export class SupabaseStorage extends BaseStorage {
  private supabase: any;

  constructor() {
    super();
    this.initSupabase();
  }

  private async initSupabase() {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not found');
      }
      
      this.supabase = createClient(supabaseUrl, supabaseKey);
    } catch (error) {
      console.warn('Supabase not available, falling back to local storage');
      throw new Error('Supabase not available');
    }
  }

  private async ensureSupabase() {
    if (!this.supabase) {
      await this.initSupabase();
    }
  }

  async getApps(): Promise<App[]> {
    await this.ensureSupabase();
    const { data, error } = await this.supabase
      .from('apps')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  async saveApps(apps: App[]): Promise<void> {
    await this.ensureSupabase();
    
    // 删除现有数据
    await this.supabase.from('apps').delete().neq('id', '');
    
    // 插入新数据
    if (apps.length > 0) {
      const { error } = await this.supabase.from('apps').insert(apps);
      if (error) throw error;
    }
  }

  async getReviews(appId?: string): Promise<AppStoreReview[]> {
    await this.ensureSupabase();

    let query = this.supabase
      .from('reviews')
      .select('*')
      .order('updated', { ascending: false });

    if (appId) {
      query = query.eq('app_id', appId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // 将 app_id 字段映射回 appId
    return (data || []).map(review => ({
      ...review,
      appId: review.app_id,
      app_id: undefined,
    }));
  }

  async saveReviews(reviews: AppStoreReview[]): Promise<void> {
    await this.ensureSupabase();

    if (reviews.length === 0) return;

    // 将 appId 字段映射为 app_id
    const mappedReviews = reviews.map(review => ({
      ...review,
      app_id: review.appId,
      // 移除原来的 appId 字段，避免数据库错误
      appId: undefined,
    }));

    // 使用 upsert 来处理重复数据
    const { error } = await this.supabase
      .from('reviews')
      .upsert(mappedReviews, { onConflict: 'id' });

    if (error) throw error;
  }

  async getAnalysisResults(appId?: string): Promise<AnalysisResult[]> {
    await this.ensureSupabase();

    let query = this.supabase
      .from('analysis_results')
      .select('*')
      .order('analyzed_at', { ascending: false });

    if (appId) {
      // 通过 reviews 表关联查询
      query = this.supabase
        .from('analysis_results')
        .select(`
          *,
          reviews!inner(app_id)
        `)
        .eq('reviews.app_id', appId)
        .order('analyzed_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;

    // 将数据库字段映射为 TypeScript 类型字段
    return (data || []).map(result => ({
      ...result,
      reviewId: result.review_id,
      appId: result.reviews?.app_id || appId || '',
      analyzedAt: result.analyzed_at,
      review_id: undefined,
      analyzed_at: undefined,
      reviews: undefined,
    }));
  }

  async saveAnalysisResults(results: AnalysisResult[]): Promise<void> {
    await this.ensureSupabase();

    if (results.length === 0) return;

    // 将 TypeScript 字段映射为数据库字段
    const mappedResults = results.map(result => ({
      ...result,
      review_id: result.reviewId,
      analyzed_at: result.analyzedAt,
      // 移除 TypeScript 字段，避免数据库错误
      reviewId: undefined,
      appId: undefined,
      analyzedAt: undefined,
    }));

    const { error } = await this.supabase
      .from('analysis_results')
      .upsert(mappedResults, { onConflict: 'id' });

    if (error) throw error;
  }

  async getPromptTemplates(): Promise<PromptTemplate[]> {
    await this.ensureSupabase();
    
    const { data, error } = await this.supabase
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      // 创建默认模板
      const defaultTemplate: PromptTemplate = {
        id: 'default',
        name: '默认分析模板',
        description: '通用的应用评论分析模板',
        systemPrompt: `你是一个专业的应用评论分析师。请分析用户评论，提取关键信息。`,
        userPromptTemplate: `请分析以下应用评论：\n\n标题：{title}\n内容：{content}\n评分：{rating}星\n版本：{version}`,
        version: '1.0.0',
        created_at: new Date().toISOString(),
        is_active: true
      };
      
      await this.savePromptTemplates([defaultTemplate]);
      return [defaultTemplate];
    }
    
    return data;
  }

  async savePromptTemplates(templates: PromptTemplate[]): Promise<void> {
    await this.ensureSupabase();
    
    if (templates.length === 0) return;
    
    const { error } = await this.supabase
      .from('prompt_templates')
      .upsert(templates, { onConflict: 'id' });
    
    if (error) throw error;
  }
}

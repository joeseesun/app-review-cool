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
      query = query.eq('appId', appId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async saveReviews(reviews: AppStoreReview[]): Promise<void> {
    await this.ensureSupabase();
    
    if (reviews.length === 0) return;
    
    // 使用 upsert 来处理重复数据
    const { error } = await this.supabase
      .from('reviews')
      .upsert(reviews, { onConflict: 'id' });
    
    if (error) throw error;
  }

  async getAnalysisResults(appId?: string): Promise<AnalysisResult[]> {
    await this.ensureSupabase();
    
    let query = this.supabase
      .from('analysis_results')
      .select('*')
      .order('analyzedAt', { ascending: false });
    
    if (appId) {
      // 通过 reviews 表关联查询
      query = this.supabase
        .from('analysis_results')
        .select(`
          *,
          reviews!inner(appId)
        `)
        .eq('reviews.appId', appId)
        .order('analyzedAt', { ascending: false });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async saveAnalysisResults(results: AnalysisResult[]): Promise<void> {
    await this.ensureSupabase();
    
    if (results.length === 0) return;
    
    const { error } = await this.supabase
      .from('analysis_results')
      .upsert(results, { onConflict: 'id' });
    
    if (error) throw error;
  }

  async getPromptTemplates(): Promise<PromptTemplate[]> {
    await this.ensureSupabase();
    
    const { data, error } = await this.supabase
      .from('prompt_templates')
      .select('*')
      .order('createdAt', { ascending: false });
    
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
        createdAt: new Date().toISOString(),
        isActive: true
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

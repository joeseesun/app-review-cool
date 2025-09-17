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

    // 将数据库字段映射回 TypeScript 字段
    return (data || []).map(review => {
      const { app_id, author, ...rest } = review;
      return {
        ...rest,
        appId: app_id,
        authorName: author,
        // 设置默认值给缺失的字段
        contentType: 'text',
        authorUri: '',
        voteCount: '0',
        voteSum: '0',
        link: '',
        contentTypeLabel: '',
        country: 'us',
      };
    });
  }

  async saveReviews(reviews: AppStoreReview[]): Promise<void> {
    await this.ensureSupabase();

    if (reviews.length === 0) return;

    // 将 TypeScript 字段映射为数据库字段
    const mappedReviews = reviews.map(review => {
      const {
        appId,
        authorName,
        contentType,
        authorUri,
        voteCount,
        voteSum,
        link,
        contentTypeLabel,
        country,
        ...rest
      } = review;
      return {
        ...rest,
        app_id: appId,
        author: authorName,
        // 其他字段暂时不存储到数据库，只保留核心字段
      };
    });

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
    return (data || []).map(result => {
      const { review_id, analyzed_at, reviews, ...rest } = result;
      return {
        ...rest,
        reviewId: review_id,
        appId: reviews?.app_id || appId || '',
        analyzedAt: analyzed_at,
      };
    });
  }

  async saveAnalysisResults(results: AnalysisResult[]): Promise<void> {
    await this.ensureSupabase();

    if (results.length === 0) return;

    // 将 TypeScript 字段映射为数据库字段
    const mappedResults = results.map(result => {
      const { reviewId, appId, analyzedAt, ...rest } = result;
      return {
        ...rest,
        review_id: reviewId,
        analyzed_at: analyzedAt,
      };
    });

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

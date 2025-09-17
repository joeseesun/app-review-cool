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

    // 将数据库字段映射为 TypeScript 字段
    return (data || []).map(app => {
      const { last_fetched, ...rest } = app;
      return {
        ...rest,
        lastFetched: last_fetched || undefined, // 如果字段不存在，设为 undefined
      };
    });
  }

  async saveApps(apps: App[]): Promise<void> {
    await this.ensureSupabase();

    // 将 TypeScript 字段映射为数据库字段
    const mappedApps = apps.map(app => {
      const { lastFetched, ...rest } = app;
      const mappedApp: any = { ...rest };

      // 只有当 lastFetched 存在且数据库支持该字段时才添加
      if (lastFetched) {
        mappedApp.last_fetched = lastFetched;
      }

      return mappedApp;
    });

    // 删除现有数据
    await this.supabase.from('apps').delete().neq('id', '');

    // 插入新数据
    if (mappedApps.length > 0) {
      const { error } = await this.supabase.from('apps').insert(mappedApps);
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
      query = query.eq('app_id', appId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // 将数据库字段映射为 TypeScript 类型字段
    return (data || []).map(result => {
      const { review_id, app_id, analyzed_at, version_refs, ...rest } = result;
      return {
        ...rest,
        reviewId: review_id,
        appId: app_id,
        analyzedAt: analyzed_at,
        versionRefs: version_refs || [],
      };
    });
  }

  async saveAnalysisResults(results: AnalysisResult[]): Promise<void> {
    await this.ensureSupabase();

    if (results.length === 0) return;

    // 将 TypeScript 字段映射为数据库字段
    const mappedResults = results.map(result => {
      const { reviewId, appId, analyzedAt, versionRefs, ...rest } = result;
      return {
        ...rest,
        review_id: reviewId,
        app_id: appId,  // 保留 appId 字段映射
        analyzed_at: analyzedAt,
        version_refs: versionRefs || [],  // 处理 versionRefs 字段
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
        userPromptTemplate: `请分析以下应用评论：

标题：{title}
内容：{content}
评分：{rating}星
版本：{version}

请以JSON格式返回分析结果：
{
  "sentiment": "positive|negative|neutral",
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "versionRefs": ["版本相关信息"]
}`,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        isActive: true
      };

      await this.savePromptTemplates([defaultTemplate]);
      return [defaultTemplate];
    }

    // 映射数据库字段到 TypeScript 接口
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      systemPrompt: item.system_prompt,
      userPromptTemplate: item.user_prompt_template,
      content: item.content || `${item.system_prompt || ''}\n\n${item.user_prompt_template || ''}`,
      version: item.version,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      isActive: item.is_active
    }));
  }

  async savePromptTemplates(templates: PromptTemplate[]): Promise<void> {
    await this.ensureSupabase();

    if (templates.length === 0) return;

    // 映射 TypeScript 接口字段到数据库字段
    const mappedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      system_prompt: template.systemPrompt,
      user_prompt_template: template.userPromptTemplate,
      content: template.content,
      version: template.version,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
      is_active: template.isActive
    }));

    const { error } = await this.supabase
      .from('prompt_templates')
      .upsert(mappedTemplates, { onConflict: 'id' });

    if (error) throw error;
  }

  // 初始化默认应用数据
  async initializeDefaultApps(): Promise<void> {
    const apps = await this.getApps();
    if (apps.length === 0) {
      const defaultApps = [
        { id: '6448311069', name: 'ChatGPT', country: 'us' },
        { id: '6477489729', name: 'Gemini', country: 'us' },
        { id: '6459478672', name: '豆包', country: 'cn' },
        { id: '6737597349', name: 'Deepseek', country: 'us' },
        { id: '6474233312', name: 'Kimi', country: 'cn' },
        { id: '6466733523', name: '通义', country: 'cn' },
        { id: '6446882473', name: '文小言', country: 'cn' },
        { id: '6480446430', name: '元宝', country: 'cn' },
        { id: '6503676563', name: '即梦', country: 'cn' },
      ];
      await this.saveApps(defaultApps);
    }
  }
}

import { promises as fs } from 'fs';
import path from 'path';
import { BaseStorage } from './base';
import { App, AppStoreReview, AnalysisResult, PromptTemplate } from '@/types';

export class LocalStorage extends BaseStorage {
  private dataDir: string;

  constructor() {
    super();
    this.dataDir = path.join(process.cwd(), 'src/data');
    this.ensureDataDir();
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  private async readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
    try {
      const filePath = path.join(this.dataDir, filename);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return defaultValue;
    }
  }

  private async writeJsonFile<T>(filename: string, data: T): Promise<void> {
    await this.ensureDataDir();
    const filePath = path.join(this.dataDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async getApps(): Promise<App[]> {
    return this.readJsonFile('apps.json', []);
  }

  async saveApps(apps: App[]): Promise<void> {
    await this.writeJsonFile('apps.json', apps);
  }

  async getReviews(appId?: string): Promise<AppStoreReview[]> {
    const allReviews = await this.readJsonFile<AppStoreReview[]>('reviews.json', []);
    return this.filterByAppId(allReviews, appId);
  }

  async saveReviews(reviews: AppStoreReview[]): Promise<void> {
    const existingReviews = await this.readJsonFile<AppStoreReview[]>('reviews.json', []);
    const mergedReviews = this.mergeArrays(existingReviews, reviews);
    const sortedReviews = this.sortByDate(mergedReviews, 'updated');
    await this.writeJsonFile('reviews.json', sortedReviews);
  }

  async getAnalysisResults(appId?: string): Promise<AnalysisResult[]> {
    const allResults = await this.readJsonFile<AnalysisResult[]>('analysis.json', []);
    return this.filterByAppId(allResults, appId);
  }

  async saveAnalysisResults(results: AnalysisResult[]): Promise<void> {
    const existingResults = await this.readJsonFile<AnalysisResult[]>('analysis.json', []);
    const mergedResults = this.mergeArrays(existingResults, results);
    const sortedResults = this.sortByDate(mergedResults, 'analyzedAt');
    await this.writeJsonFile('analysis.json', sortedResults);
  }

  async getPromptTemplates(): Promise<PromptTemplate[]> {
    const defaultTemplates: PromptTemplate[] = [
      {
        id: 'default',
        name: '默认分析模板',
        description: '通用的应用评论分析模板',
        content: `请分析以下用户评论，提取关键信息：

评论标题：{title}
评论内容：{content}
评分：{rating}
版本：{version}
用户：{authorName}
时间：{updated}

分析要求：
1. 判断情感倾向：positive（正面）、negative（负面）、neutral（中性）
2. 识别主要问题：提取用户反馈的具体问题和bug
3. 提取改进建议：用户提出的功能建议和改进意见
4. 版本相关信息：如果评论提到特定版本的问题

请严格按照以下JSON格式返回结果，不要添加任何其他文字：
{
  "sentiment": "positive|negative|neutral",
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "versionRefs": ["版本号1", "版本号2"]
}`,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      }
    ];

    const templates = await this.readJsonFile<PromptTemplate[]>('prompts.json', defaultTemplates);
    
    // 如果文件不存在或为空，保存默认模板
    if (templates.length === 0) {
      await this.writeJsonFile('prompts.json', defaultTemplates);
      return defaultTemplates;
    }

    return templates;
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

  async savePromptTemplates(templates: PromptTemplate[]): Promise<void> {
    await this.writeJsonFile('prompts.json', templates);
  }

  // 便利方法：保存单个 Prompt 模板
  async savePromptTemplate(template: PromptTemplate): Promise<void> {
    const templates = await this.getPromptTemplates();
    const existingIndex = templates.findIndex(t => t.id === template.id);

    if (existingIndex >= 0) {
      templates[existingIndex] = template;
    } else {
      templates.push(template);
    }

    await this.savePromptTemplates(templates);
  }

  // 便利方法：删除 Prompt 模板
  async deletePromptTemplate(templateId: string): Promise<void> {
    const templates = await this.getPromptTemplates();
    const filteredTemplates = templates.filter(t => t.id !== templateId);
    await this.savePromptTemplates(filteredTemplates);
  }
}

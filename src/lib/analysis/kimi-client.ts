import OpenAI from 'openai';
import { PromptTemplate } from '@/types';

export interface AnalysisRequest {
  title: string;
  content: string;
  rating: string;
  version: string;
  authorName?: string; // 可选，用于分析用户类型
  updated?: string;    // 可选，用于时间分析
}

export interface AnalysisResponse {
  sentiment: 'positive' | 'negative' | 'neutral';
  issues: string[];
  suggestions: string[];
  versionRefs: string[];
}

export interface ThemeItem {
  title: string; // 中文短标题（≤16字）
  summary: string; // 2-3句中文解读
  examples: Array<{ id: string; snippet: string }>; // 证据句，来自原评论
}

export interface IssueItem { title: string; summary: string; category: string; examples: Array<{ id: string; snippet: string }>; }
export interface SuggestionItem { title: string; summary: string; examples: Array<{ id: string; snippet: string }>; }

export class KimiClient {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.MOONSHOT_API_KEY;
    const baseURL = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1';

    if (!apiKey) {
      throw new Error('MOONSHOT_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });

    this.model = 'kimi-k2-0905-preview';
  }

  /**
   * 分析单个评论
   */
  async analyzeReview(
    request: AnalysisRequest,
    promptTemplate: PromptTemplate
  ): Promise<AnalysisResponse> {
    try {
      // 使用新的统一 content 字段，如果不存在则回退到旧格式
      const promptContent = promptTemplate.content ||
        `${promptTemplate.systemPrompt || ''}\n\n${promptTemplate.userPromptTemplate || ''}`;

      const formattedPrompt = this.formatPrompt(request, promptContent);

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: '你是 Kimi，由 Moonshot AI 提供的人工智能助手，你更擅长中文和英文的对话。你会为用户提供安全，有帮助，准确的回答。',
          },
          {
            role: 'user',
            content: formattedPrompt,
          },
        ],
        // 降低随机性，强调结构化输出
        temperature: 0.2,
        max_tokens: 1000,
        // 强制 JSON 模式（若后端不支持会忽略）
        response_format: { type: 'json_object' } as any,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('Empty response from Kimi API');
      }

      return this.parseAnalysisResponse(responseContent);
    } catch (error) {
      console.error('Failed to analyze review with Kimi:', error);
      throw error;
    }
  }

  /**
   * 批量分析评论
   */
  async analyzeReviewsBatch(
    requests: AnalysisRequest[],
    promptTemplate: PromptTemplate,
    batchSize = 5
  ): Promise<AnalysisResponse[]> {
    const results: AnalysisResponse[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      console.log(`Analyzing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(requests.length / batchSize)}`);
      
      const batchPromises = batch.map(request => 
        this.analyzeReview(request, promptTemplate)
          .catch(error => {
            console.error('Failed to analyze review:', error);
            return this.getDefaultAnalysisResponse();
          })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 添加延迟避免API限流
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * 格式化提示词
   */
  private formatPrompt(request: AnalysisRequest, template: string): string {
    return template
      .replace('{title}', request.title || '')
      .replace('{content}', request.content || '')
      .replace('{rating}', request.rating || '')
      .replace('{version}', request.version || '')
      .replace('{authorName}', request.authorName || '')
      .replace('{updated}', request.updated || '');
  }

  /**
   * 计算请求的 token 数量（估算）
   */
  private estimateTokens(request: AnalysisRequest, template: string): number {
    const text = this.formatPrompt(request, template);
    // 粗略估算：中文字符 * 1.5 + 英文单词数 * 1.3
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
  }

  /**
   * 超大规模批量分析 - 支持数千条评论的智能分批处理
   */
  async analyzeReviewsMassive(
    requests: AnalysisRequest[],
    promptTemplate: PromptTemplate,
    options: {
      maxTokensPerBatch?: number;
      maxConcurrentBatches?: number;
      progressCallback?: (processed: number, total: number) => void;
    } = {}
  ): Promise<AnalysisResponse[]> {
    const {
      maxTokensPerBatch = 8000, // 增加到8000 tokens，充分利用Kimi的上下文
      maxConcurrentBatches = 3,  // 并发处理3个批次
      progressCallback
    } = options;

    console.log(`Starting massive analysis of ${requests.length} reviews`);
    console.log(`Batch size: ~${maxTokensPerBatch} tokens, Concurrency: ${maxConcurrentBatches}`);

    const batches = this.createOptimalBatches(requests, promptTemplate, maxTokensPerBatch);
    console.log(`Created ${batches.length} optimal batches`);

    const results: AnalysisResponse[] = [];
    let processedCount = 0;

    // 分组处理批次，控制并发数
    for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
      const batchGroup = batches.slice(i, i + maxConcurrentBatches);

      console.log(`Processing batch group ${Math.floor(i / maxConcurrentBatches) + 1}/${Math.ceil(batches.length / maxConcurrentBatches)}`);

      // 并发处理当前组的批次
      const groupPromises = batchGroup.map(async (batch, index) => {
        const batchIndex = i + index + 1;
        console.log(`Starting batch ${batchIndex}/${batches.length} with ${batch.length} reviews`);

        try {
          const batchResults = await this.processBatch(batch, promptTemplate);
          console.log(`Completed batch ${batchIndex}/${batches.length}`);
          return batchResults;
        } catch (error) {
          console.error(`Failed batch ${batchIndex}:`, error);
          // 返回默认结果而不是失败
          return batch.map(() => this.getDefaultAnalysisResponse());
        }
      });

      const groupResults = await Promise.all(groupPromises);

      // 合并结果
      for (const batchResults of groupResults) {
        results.push(...batchResults);
        processedCount += batchResults.length;

        // 调用进度回调
        if (progressCallback) {
          progressCallback(processedCount, requests.length);
        }
      }

      // 批次组之间添加延迟，避免API限流
      if (i + maxConcurrentBatches < batches.length) {
        console.log('Waiting between batch groups...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`Massive analysis completed: ${results.length} results`);
    return results;
  }

  /**
   * 优化批量分析 - 根据 token 限制动态调整批次大小
   */
  async analyzeReviewsBatchOptimized(
    requests: AnalysisRequest[],
    promptTemplate: PromptTemplate,
    maxTokensPerBatch = 3000 // Moonshot 单次请求建议不超过 4000 tokens
  ): Promise<AnalysisResponse[]> {
    const results: AnalysisResponse[] = [];
    let currentBatch: AnalysisRequest[] = [];
    let currentTokens = 0;

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const requestTokens = this.estimateTokens(request, promptTemplate.content);

      // 如果添加当前请求会超过 token 限制，先处理当前批次
      if (currentTokens + requestTokens > maxTokensPerBatch && currentBatch.length > 0) {
        console.log(`Processing batch with ${currentBatch.length} reviews (~${currentTokens} tokens)`);

        const batchResults = await this.processBatch(currentBatch, promptTemplate);
        results.push(...batchResults);

        // 重置批次
        currentBatch = [];
        currentTokens = 0;

        // 添加延迟避免API限流
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      currentBatch.push(request);
      currentTokens += requestTokens;
    }

    // 处理最后一个批次
    if (currentBatch.length > 0) {
      console.log(`Processing final batch with ${currentBatch.length} reviews (~${currentTokens} tokens)`);
      const batchResults = await this.processBatch(currentBatch, promptTemplate);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 创建最优批次分组
   */
  private createOptimalBatches(
    requests: AnalysisRequest[],
    promptTemplate: PromptTemplate,
    maxTokensPerBatch: number
  ): AnalysisRequest[][] {
    const batches: AnalysisRequest[][] = [];
    let currentBatch: AnalysisRequest[] = [];
    let currentTokens = 0;

    for (const request of requests) {
      const requestTokens = this.estimateTokens(request, promptTemplate.content);

      // 如果添加当前请求会超过token限制，且当前批次不为空，则开始新批次
      if (currentTokens + requestTokens > maxTokensPerBatch && currentBatch.length > 0) {
        batches.push([...currentBatch]);
        currentBatch = [];
        currentTokens = 0;
      }

      currentBatch.push(request);
      currentTokens += requestTokens;
    }

    // 添加最后一个批次
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * 处理单个批次
   */
  private async processBatch(
    batch: AnalysisRequest[],
    promptTemplate: PromptTemplate
  ): Promise<AnalysisResponse[]> {
    const batchPromises = batch.map(request =>
      this.analyzeReview(request, promptTemplate)
        .catch(error => {
          console.error('Failed to analyze review:', error);
          return this.getDefaultAnalysisResponse();
        })
    );

    return Promise.all(batchPromises);
  }

  /**
   * 格式化用户提示词（向后兼容）
   */
  private formatUserPrompt(request: AnalysisRequest, template: string): string {
    return this.formatPrompt(request, template);
  }

  /**
   * 解析分析响应
   */
  private parseAnalysisResponse(responseContent: string): AnalysisResponse {
    try {
      // 尝试直接解析JSON
      const parsed = JSON.parse(responseContent);
      
      return {
        sentiment: this.normalizeSentiment(parsed.sentiment),
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        versionRefs: Array.isArray(parsed.versionRefs) ? parsed.versionRefs : [],
      };
    } catch (error) {
      // 回退：尝试从代码块/花括号中恢复 JSON
      const recovered = this.tryRecoverJson(responseContent);
      if (recovered) {
        return {
          sentiment: this.normalizeSentiment(recovered.sentiment),
          issues: Array.isArray(recovered.issues) ? recovered.issues : [],
          suggestions: Array.isArray(recovered.suggestions) ? recovered.suggestions : [],
          versionRefs: Array.isArray(recovered.versionRefs) ? recovered.versionRefs : [],
        };
      }
      console.warn('Failed to parse JSON response; returning empty analysis');
      return this.getDefaultAnalysisResponse();
    }
  }

  /**
   * 从文本中提取分析结果
   */
  private extractFromText(text: string): AnalysisResponse {
    const result: AnalysisResponse = {
      sentiment: 'neutral',
      issues: [],
      suggestions: [],
      versionRefs: [],
    };

    // 提取情感倾向
    if (text.includes('positive') || text.includes('正面') || text.includes('积极')) {
      result.sentiment = 'positive';
    } else if (text.includes('negative') || text.includes('负面') || text.includes('消极')) {
      result.sentiment = 'negative';
    }

    // 为避免噪声，回退模式不再硬塞“检测到关键词”，保持 issues/suggestions 为空

    return result;
  }

  // 从回复文本中尽量恢复 JSON
  private tryRecoverJson(text: string): any | null {
    try {
      const code = text.match(/```(?:json)?\n([\s\S]*?)\n```/i);
      if (code && code[1]) {
        return JSON.parse(this.relaxJson(code[1]));
      }
      const brace = text.match(/\{[\s\S]*\}/);
      if (brace) {
        return JSON.parse(this.relaxJson(brace[0]));
      }
    } catch {}
    return null;
  }

  private relaxJson(s: string): string {
    let t = s.trim();
    t = t.replace(/,\s*([}\]])/g, '$1');
    t = t.replace(/[“”]/g, '"');
    return t;
  }

  /**
   * 标准化情感倾向
   */
  private normalizeSentiment(sentiment: string): 'positive' | 'negative' | 'neutral' {
    const normalized = sentiment.toLowerCase();
    
    if (normalized.includes('positive') || normalized.includes('正面') || normalized.includes('积极')) {
      return 'positive';
    }
    
    if (normalized.includes('negative') || normalized.includes('负面') || normalized.includes('消极')) {
      return 'negative';
    }
    
    return 'neutral';
  }

  /**
   * 获取默认分析响应（用于错误情况）
   */
  private getDefaultAnalysisResponse(): AnalysisResponse {
    return {
      sentiment: 'neutral',
      issues: [],
      suggestions: [],
      versionRefs: [],
    };
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: '请回复"连接成功"',
          },
        ],
        max_tokens: 10,
      });

      const response = completion.choices[0]?.message?.content;
      return response?.includes('连接成功') || response?.includes('成功') || !!response;
    } catch (error) {
      console.error('Kimi API connection test failed:', error);
      return false;
    }
  }

  /**
   * 获取API使用统计
   */
  async getUsageStats(): Promise<{
    model: string;
    available: boolean;
    lastTest?: Date;
  }> {
    const available = await this.testConnection();
    
    return {
      model: this.model,
      available,
      lastTest: new Date(),
    };
  }

  /**
   * 从一批评论中提取主题（好评/差评）— Map 阶段
   */
  async summarizeThemesMap(
    items: Array<{ id: string; title: string; content: string; rating?: string }>,
    polarity: 'positive' | 'negative',
    limit: number = 5
  ): Promise<ThemeItem[]> {
    const prompt = `你是一名资深产品分析师。请阅读一批用户评论（标题+内容），只输出严格 JSON，不要输出任何其他文字或代码块。\n` +
    `任务：提取${polarity === 'positive' ? '好评核心亮点' : '差评核心问题'}主题，给出中文短标题（≤16字）与2-3句中文解读，并提供来自原文的一条证据句（含评论id）。\n` +
    `严格要求：\n- 所有输出中文；\n- 不要使用“建议/问题/优化/改进”等口水词做标题；\n- 标题必须具备可理解的产品含义；\n- 证据句必须取自提供的原文内容或标题；\n- 最多返回${limit}个主题。\n\n` +
    `输入示例（多条）：[{"id":"r1","title":"...","content":"..."}, ...]\n` +
    `现在的输入：${JSON.stringify(items).slice(0, 12000)}\n\n` +
    `输出JSON：{ "themes": [ { "title":"中文短标题", "summary":"2-3句中文解读", "examples":[{"id":"评论id","snippet":"证据句"}] } ] }`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: '你是严谨的中文产品分析师，只返回严格 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: 'json_object' } as any,
    });

    const content = completion.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      const arr = Array.isArray(parsed.themes) ? parsed.themes : [];
      return arr.map((t: any) => ({
        title: String(t.title || '').slice(0, 30),
        summary: String(t.summary || '').slice(0, 500),
        examples: Array.isArray(t.examples) ? t.examples.filter((e: any) => e && e.id && e.snippet).map((e: any) => ({ id: String(e.id), snippet: String(e.snippet).slice(0, 200) })) : [],
      })).filter((t: ThemeItem) => t.title && t.summary);
    } catch {
      return [];
    }
  }

  /**
   * 从一批评论中提取“问题分类分析 + 改进建议” — Map 阶段
   */
  async summarizeIssuesSuggestionsMap(
    items: Array<{ id: string; title: string; content: string; rating?: string }>,
    limit: number = 10
  ): Promise<{ issues: IssueItem[]; suggestions: SuggestionItem[] }> {
    const prompt = `你是一名资深产品分析师。请阅读一批用户评论（标题+内容），只返回严格 JSON。\n` +
    `任务：\n- 提取“问题分类分析”：用中文短标题（≤16字）+ 1-2句中文解读，按类别归属（性能/功能/体验/内容/账户/价格/其他），并提供来自原文的一条证据句（含评论id）。\n` +
    `- 提取“改进建议”：仅当评论明确提出“希望/需要/增加/修复”等，给出中文短标题（≤16字）+ 1-2句中文解读，并提供证据句。\n` +
    `约束：\n- 所有输出中文；\n- 不要使用“建议/问题/优化/改进”等口水词做标题；\n- 标题必须可行动且具体；\n- 每项提供 1 条证据句，来自输入原文；\n- issues 与 suggestions 各最多返回 ${limit} 项。\n\n` +
    `输入JSON（多条）：${JSON.stringify(items).slice(0, 12000)}\n\n` +
    `输出JSON：{ "issues": [ {"title":"","summary":"","category":"性能|功能|体验|内容|账户|价格|其他","examples":[{"id":"","snippet":""}] } ], "suggestions": [ {"title":"","summary":"","examples":[{"id":"","snippet":""}] } ] }`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: '你是严谨的中文产品分析师，只返回严格 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' } as any,
    });

    const content = completion.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      const issues = (Array.isArray(parsed.issues) ? parsed.issues : []).map((t: any) => ({
        title: String(t.title || '').slice(0, 30),
        summary: String(t.summary || '').slice(0, 500),
        category: String(t.category || '其他'),
        examples: Array.isArray(t.examples) ? t.examples.filter((e: any) => e && e.id && e.snippet).map((e: any) => ({ id: String(e.id), snippet: String(e.snippet).slice(0, 200) })) : [],
      }));
      const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).map((t: any) => ({
        title: String(t.title || '').slice(0, 30),
        summary: String(t.summary || '').slice(0, 500),
        examples: Array.isArray(t.examples) ? t.examples.filter((e: any) => e && e.id && e.snippet).map((e: any) => ({ id: String(e.id), snippet: String(e.snippet).slice(0, 200) })) : [],
      }));
      return { issues, suggestions };
    } catch {
      return { issues: [], suggestions: [] };
    }
  }
}

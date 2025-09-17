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
        temperature: 0.6,
        max_tokens: 1000,
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
      // 如果JSON解析失败，尝试从文本中提取信息
      console.warn('Failed to parse JSON response, attempting text extraction:', error);
      return this.extractFromText(responseContent);
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

    // 提取问题（简单的关键词匹配）
    const issueKeywords = ['问题', '错误', 'bug', '故障', '崩溃', '卡顿', '慢'];
    issueKeywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        result.issues.push(`检测到关键词: ${keyword}`);
      }
    });

    // 提取建议（简单的关键词匹配）
    const suggestionKeywords = ['建议', '希望', '改进', '优化', '增加', '添加'];
    suggestionKeywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        result.suggestions.push(`检测到关键词: ${keyword}`);
      }
    });

    return result;
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
      issues: ['分析失败'],
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
}

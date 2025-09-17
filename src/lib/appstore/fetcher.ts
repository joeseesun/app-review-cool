import { AppStoreReview, FetchConfig } from '@/types';

interface AppStoreEntry {
  id: { label: string };
  updated: { label: string };
  'im:rating': { label: string };
  'im:version': { label: string };
  title: { label: string };
  content: { 
    label: string;
    attributes: { type: string };
  };
  author: {
    name: { label: string };
    uri: { label: string };
  };
  'im:voteCount': { label: string };
  'im:voteSum': { label: string };
  link: {
    attributes: { href: string };
  };
  'im:contentType': {
    attributes: {
      term: string;
      label: string;
    };
  };
}

interface AppStoreResponse {
  feed: {
    entry: AppStoreEntry[];
  };
}

export class AppStoreFetcher {
  private static readonly BASE_URL = 'https://itunes.apple.com';
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second

  /**
   * 抓取指定应用的评论
   */
  static async fetchReviews(config: FetchConfig): Promise<AppStoreReview[]> {
    const { appId, country, incremental, lastFetched } = config;
    const url = `${this.BASE_URL}/${country}/rss/customerreviews/id=${appId}/json`;
    
    console.log(`Fetching reviews for app ${appId} from ${country}...`);
    
    try {
      console.log(`Making request to: ${url}`);
      const response = await this.fetchWithRetry(url);
      console.log(`Response received, status: ${response.status}`);

      const data: AppStoreResponse = await response.json();
      console.log(`JSON parsed successfully`);

      if (!data.feed) {
        console.warn(`No feed found in response for app ${appId}`);
        return [];
      }

      if (!data.feed.entry) {
        console.warn(`No entries found in feed for app ${appId}`);
        return [];
      }

      console.log(`Found ${data.feed.entry.length} entries in feed`);
      const reviews = this.parseReviews(data.feed.entry, appId, country);
      console.log(`Parsed ${reviews.length} reviews`);

      // 如果是增量抓取，过滤出新评论
      if (incremental && lastFetched) {
        const lastFetchedDate = new Date(lastFetched);
        const filteredReviews = reviews.filter(review => new Date(review.updated) > lastFetchedDate);
        console.log(`Filtered to ${filteredReviews.length} new reviews since ${lastFetched}`);
        return filteredReviews;
      }

      return reviews;
    } catch (error) {
      console.error(`Failed to fetch reviews for app ${appId}:`, error);
      if (error instanceof Error) {
        console.error(`Error message: ${error.message}`);
        console.error(`Error stack: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * 带重试机制的网络请求
   */
  private static async fetchWithRetry(url: string, retries = this.MAX_RETRIES): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        console.warn(`Fetch attempt ${i + 1} failed:`, error);
        
        if (i === retries - 1) {
          throw error;
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (i + 1)));
      }
    }
    
    throw new Error('All fetch attempts failed');
  }

  /**
   * 解析 AppStore RSS 响应数据
   */
  private static parseReviews(entries: AppStoreEntry[], appId: string, country: string): AppStoreReview[] {
    return entries
      .filter(entry => this.isValidReview(entry))
      .map(entry => this.parseReviewEntry(entry, appId, country))
      .filter(review => review !== null) as AppStoreReview[];
  }

  /**
   * 检查是否为有效的评论条目
   */
  private static isValidReview(entry: AppStoreEntry): boolean {
    // 过滤掉应用元数据，只保留用户评论
    return !!(
      entry.id?.label &&
      entry.updated?.label &&
      entry.title?.label &&
      entry.content?.label &&
      entry.author?.name?.label &&
      entry['im:rating']?.label
    );
  }

  /**
   * 解析单个评论条目
   */
  private static parseReviewEntry(entry: AppStoreEntry, appId: string, country: string): AppStoreReview | null {
    try {
      return {
        id: entry.id.label,
        updated: entry.updated.label,
        rating: entry['im:rating']?.label || '0',
        version: entry['im:version']?.label || 'Unknown',
        title: entry.title.label,
        content: entry.content.label,
        contentType: entry.content.attributes?.type || 'text',
        authorName: entry.author.name.label,
        authorUri: entry.author.uri?.label || '',
        voteCount: entry['im:voteCount']?.label || '0',
        voteSum: entry['im:voteSum']?.label || '0',
        link: entry.link?.attributes?.href || '',
        contentTypeLabel: entry['im:contentType']?.attributes?.label || '',
        appId,
        country,
      };
    } catch (error) {
      console.warn('Failed to parse review entry:', error);
      return null;
    }
  }

  /**
   * 批量抓取多个应用的评论
   */
  static async fetchMultipleApps(configs: FetchConfig[]): Promise<AppStoreReview[]> {
    const allReviews: AppStoreReview[] = [];
    
    for (const config of configs) {
      try {
        const reviews = await this.fetchReviews(config);
        allReviews.push(...reviews);
        
        // 添加延迟避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to fetch reviews for app ${config.appId}:`, error);
        // 继续处理其他应用，不中断整个流程
      }
    }
    
    return allReviews;
  }

  /**
   * 验证应用ID和国家代码
   */
  static validateConfig(config: FetchConfig): boolean {
    const { appId, country } = config;
    
    if (!appId || !/^\d+$/.test(appId)) {
      console.error('Invalid app ID:', appId);
      return false;
    }
    
    if (!country || !/^[a-z]{2}$/.test(country)) {
      console.error('Invalid country code:', country);
      return false;
    }
    
    return true;
  }
}

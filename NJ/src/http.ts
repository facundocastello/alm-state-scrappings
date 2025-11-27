import got, { Got } from 'got';
import { load, CheerioAPI } from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { config } from './config.js';

export interface ViewStateTokens {
  __VIEWSTATE: string;
  __VIEWSTATEGENERATOR: string;
  __EVENTVALIDATION: string;
}

export class HttpClient {
  private client: Got;
  private cookieJar: CookieJar;

  constructor() {
    this.cookieJar = new CookieJar();

    this.client = got.extend({
      cookieJar: this.cookieJar,
      timeout: {
        request: config.timeout,
        lookup: 5000,     // DNS lookup timeout
        connect: 10000,   // Connection timeout
        secureConnect: 10000, // SSL handshake timeout
        send: 10000,      // Request send timeout
        response: 60000,  // Response timeout
      },
      headers: {
        'User-Agent': config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      retry: {
        limit: 0, // Disable automatic retries - handle at application level
      },
      followRedirect: true,
      http2: false,
      throwHttpErrors: true,
    });
  }

  async get(url: string): Promise<{ html: string; $: CheerioAPI }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.retry.limit; attempt++) {
      try {
        const response = await this.client.get(url);
        const html = response.body;
        const $ = load(html);
        return { html, $ };
      } catch (error) {
        lastError = error as Error;

        if (attempt < config.retry.limit) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), config.retry.backoffLimit);
          console.log(`    ⚠️  GET request failed, retry ${attempt}/${config.retry.limit} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  async post(url: string, formData: Record<string, string>): Promise<{ html: string; $: CheerioAPI }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.retry.limit; attempt++) {
      try {
        const response = await this.client.post(url, {
          form: formData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://healthapps.nj.gov',
            'Referer': url,
          },
        });
        const html = response.body;
        const $ = load(html);
        return { html, $ };
      } catch (error) {
        lastError = error as Error;

        if (attempt < config.retry.limit) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), config.retry.backoffLimit);
          console.log(`    ⚠️  POST request failed, retry ${attempt}/${config.retry.limit} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  extractViewState($: CheerioAPI): ViewStateTokens {
    const viewState = $('input[name="__VIEWSTATE"]').attr('value') || '';
    const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').attr('value') || '';
    const eventValidation = $('input[name="__EVENTVALIDATION"]').attr('value') || '';

    return {
      __VIEWSTATE: viewState,
      __VIEWSTATEGENERATOR: viewStateGenerator,
      __EVENTVALIDATION: eventValidation,
    };
  }

  buildTabPostData(tokens: ViewStateTokens, tabIndex: number): Record<string, string> {
    return {
      __VIEWSTATE: tokens.__VIEWSTATE,
      __VIEWSTATEGENERATOR: tokens.__VIEWSTATEGENERATOR,
      __EVENTVALIDATION: tokens.__EVENTVALIDATION,
      __EVENTTARGET: 'ctl00$middleContent$Menu1',
      __EVENTARGUMENT: tabIndex.toString(),
    };
  }
}

export const httpClient = new HttpClient();

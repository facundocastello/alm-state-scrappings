import got from 'got';
import { CookieJar } from 'tough-cookie';
import { config } from './config.js';

// Cookie jar for session management
const cookieJar = new CookieJar();

// @ts-expect-error - got v11 types may not include extend in ESM, but it exists at runtime
export const httpClient = got.extend({
  cookieJar,
  headers: {
    'User-Agent': config.userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  },
  timeout: {
    request: config.requestTimeoutMs,
  },
  retry: {
    limit: 3,
    methods: ['GET'],
  },
  https: {
    rejectUnauthorized: false,
  },
  followRedirect: true,
});

// Separate client for PDF downloads
// @ts-expect-error - got v11 types may not include extend in ESM, but it exists at runtime
export const downloadClient = got.extend({
  cookieJar,
  headers: {
    'User-Agent': config.userAgent,
    'Accept': 'application/pdf,*/*',
  },
  timeout: {
    request: config.downloadTimeoutMs,
  },
  retry: {
    limit: 2,
    methods: ['GET'],
  },
  https: {
    rejectUnauthorized: false,
  },
  followRedirect: true,
  responseType: 'buffer',
});

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

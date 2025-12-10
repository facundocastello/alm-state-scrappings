import got, { Got } from 'got';
import { config } from './config.js';

// Create a configured HTTP client
export const http: Got = got.extend({
  prefixUrl: config.baseUrl,
  timeout: {
    request: config.request.timeout,
  },
  headers: {
    'User-Agent': config.request.userAgent,
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  retry: {
    limit: config.request.retryLimit,
    methods: ['GET'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
    calculateDelay: ({ attemptCount }) => {
      return attemptCount * config.request.retryDelay;
    },
  },
  responseType: 'json',
});

/**
 * Fetch JSON from an endpoint
 */
export async function fetchJson<T>(endpoint: string): Promise<T> {
  // Remove leading slash if present since prefixUrl handles it
  const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const response = await http.get<T>(path);
  return response.body;
}

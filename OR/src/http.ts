/**
 * HTTP Client for Oregon Healthcare Scraper
 */
import got from "got";
import { REQUEST_HEADERS } from "./config.js";

export const httpClient = got.extend({
  headers: REQUEST_HEADERS,
  retry: {
    limit: 5,
    methods: ["GET", "POST"],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  timeout: {
    request: 30000,
  },
  throwHttpErrors: true,
  hooks: {
    beforeRetry: [
      (options: any) => {
        const url = options?.url?.toString() || "unknown";
        const retryCount = options?.retryCount || 0;
        console.log(`    ⚠ Retry ${retryCount}/5 for ${url}`);
      },
    ],
    beforeError: [
      (error: any) => {
        const url = error?.options?.url?.toString() || error?.request?.requestUrl?.toString() || "unknown";
        const status = error?.response?.statusCode || "N/A";
        const body = typeof error?.response?.body === 'string' ? error.response.body.substring(0, 200) : "";
        console.error(`    ❌ HTTP Error: ${status} for ${url}`);
        if (body) {
          console.error(`    Response body: ${body}`);
        }
        return error;
      },
    ],
  },
});

/**
 * Delay helper for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Custom error to signal that scraping failed and should not be marked complete
 */
export class ScrapingError extends Error {
  constructor(message: string, public readonly facilityId: string) {
    super(message);
    this.name = "ScrapingError";
  }
}

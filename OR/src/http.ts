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

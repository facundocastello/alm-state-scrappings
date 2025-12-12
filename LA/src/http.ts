import got from "got";
import { REQUEST_HEADERS } from "./config.js";

// @ts-expect-error - got v11 types may not include extend in ESM, but it exists at runtime
export const httpClient = got.extend({
  headers: REQUEST_HEADERS,
  timeout: {
    request: 1000 * 30,
  },
  retry: {
    limit: 2,
    methods: ["GET", "POST"],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  https: {
    rejectUnauthorized: false,
  },
});

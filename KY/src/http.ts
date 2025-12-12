import got, { type Got } from "got";
import { config } from "./config.js";

export const http: Got = got.extend({
  headers: {
    "User-Agent": config.userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
  },
  timeout: {
    request: 60000, // 60 second timeout
  },
  retry: {
    limit: 3,
    methods: ["GET"],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
});

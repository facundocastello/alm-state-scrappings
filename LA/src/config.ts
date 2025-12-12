import path from "path";
import "dotenv/config";

// Base URLs
export const BASE_URL = "https://ldh.la.gov";
export const LISTING_URL = `${BASE_URL}/directory/category/161`;
export const DETAIL_URL = `${BASE_URL}/directory/detail`;

// Pagination - Louisiana has 9 pages of listings
export const TOTAL_PAGES = 9;

// Concurrency settings
export const CONCURRENCY_PAGES = Number(process.env.LA_PAGE_CONCURRENCY ?? "3");
export const CONCURRENCY_FACILITIES = Number(process.env.LA_FACILITY_CONCURRENCY ?? "2");

// Request headers
export const REQUEST_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "User-Agent":
    process.env.LA_USER_AGENT ??
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
};

// Directory paths
export const DATA_DIR = path.join(process.cwd(), "data");
export const OUTPUT_DIR = path.join(process.cwd(), "output");

// File paths
export const RAW_FACILITIES_PATH = path.join(DATA_DIR, "facilities.raw.json");
export const CSV_OUTPUT_PATH = path.join(OUTPUT_DIR, "facilities.csv");
export const URLS_IN_PROGRESS_PATH = path.join(DATA_DIR, "url-in-progress.csv");
export const URLS_FINISHED_PATH = path.join(DATA_DIR, "url-finished.csv");

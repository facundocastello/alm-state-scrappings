import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Utah CCL API URLs
export const BASE_URL = "https://ccl.utah.gov/ccl/public";
export const SEARCH_URL = `${BASE_URL}/facilities-search.json`;
export const FACILITY_URL = (id: string | number) => `${BASE_URL}/facilities/${id}.json`;
export const CHECKLIST_URL = (id: number) => `${BASE_URL}/checklist/${id}`;

// Pagination
export const PAGE_SIZE = 100;

// User Agent
export const USER_AGENT =
  process.env.UT_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

// Concurrency settings
export const CONCURRENCY_SEARCH = Number(process.env.UT_SEARCH_CONCURRENCY ?? "3");
export const CONCURRENCY_FACILITIES = Number(process.env.UT_FACILITY_CONCURRENCY ?? "5");

// Request headers for JSON API
export const REQUEST_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  "User-Agent": USER_AGENT,
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

// Directory paths
export const DATA_DIR = path.join(process.cwd(), "data");
export const OUTPUT_DIR = path.join(process.cwd(), "output");
export const REPORTS_DIR = path.join(process.cwd(), "reports");

// File paths
export const RAW_FACILITIES_PATH = path.join(DATA_DIR, "facilities.raw.json");
export const CSV_OUTPUT_PATH = path.join(OUTPUT_DIR, "facilities.csv");
export const URLS_IN_PROGRESS_PATH = path.join(DATA_DIR, "url-in-progress.csv");
export const URLS_FINISHED_PATH = path.join(DATA_DIR, "url-finished.csv");

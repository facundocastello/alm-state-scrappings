import path from "path";
import dotenv from "dotenv";

dotenv.config();

export const BASE_URL = "https://adultfostercare.apps.lara.state.mi.us";
export const PROFILE_URL_BASE = `${BASE_URL}/Home/FacilityProfile`;

export const USER_AGENT =
  process.env.MI_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

export const CONCURRENCY_FACILITIES = Number(
  process.env.MI_FACILITY_CONCURRENCY ?? "2"
);

export const REQUEST_HEADERS: Record<string, string> = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "max-age=0",
  Connection: "keep-alive",
  "User-Agent": USER_AGENT,
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

export const DATA_DIR = path.join(process.cwd(), "data");
export const OUTPUT_DIR = path.join(process.cwd(), "output");
export const REPORTS_DIR = path.join(process.cwd(), "reports");
export const INPUT_DIR = path.join(process.cwd(), "input");

export const INPUT_CSV_PATH = path.join(INPUT_DIR, "AdultFosterCare.csv");
export const CSV_OUTPUT_PATH = path.join(OUTPUT_DIR, "MI.csv");
export const URLS_IN_PROGRESS_PATH = path.join(DATA_DIR, "url-in-progress.csv");
export const URLS_FINISHED_PATH = path.join(DATA_DIR, "url-finished.csv");


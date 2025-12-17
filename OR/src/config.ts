/**
 * Oregon Healthcare Scraper Configuration
 */
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base URLs
export const ARCGIS_BASE_URL =
  "https://services.arcgis.com/uUvqNMGPm7axC2dD/ArcGIS/rest/services/webFACILITY/FeatureServer/0/query";

export const WEB_PORTAL_BASE_URL = "https://ltclicensing.oregon.gov";

// Web portal endpoints
export const ENDPOINTS = {
  facilityDetails: (id: string) => `${WEB_PORTAL_BASE_URL}/Facilities/Details/${id}`,
  surveys: (id: string) => `${WEB_PORTAL_BASE_URL}/Surveys/Index/${id}`,
  violations: (id: string) => `${WEB_PORTAL_BASE_URL}/Violations/Index/${id}`,
  notices: (id: string) => `${WEB_PORTAL_BASE_URL}/Notices/Index/${id}`,
  surveyCites: (reportNum: string) => `${WEB_PORTAL_BASE_URL}/SurveyCites/Index/${reportNum}`,
  /** Citation details page with full rule text, findings, and plan of correction */
  citationDetails: (reportNum: string, tagId: string) =>
    `${WEB_PORTAL_BASE_URL}/SurveyCites/Details/${reportNum}?tag=${tagId}`,
  printReport: (reportNum: string) => `${WEB_PORTAL_BASE_URL}/Facilities/PrintReport/${reportNum}`,
};

// Directories
export const PROJECT_DIR = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(PROJECT_DIR, "data");
export const OUTPUT_DIR = path.join(PROJECT_DIR, "output");
export const REPORTS_DIR = path.join(PROJECT_DIR, "reports");

// Files
export const FACILITIES_JSON = path.join(DATA_DIR, "facilities.json");
export const PROGRESS_CSV = path.join(DATA_DIR, "progress.csv");
export const OUTPUT_CSV = path.join(OUTPUT_DIR, "facilities.csv");

// Concurrency settings
export const CONCURRENCY = parseInt(process.env.OR_CONCURRENCY || "5", 10);

// Request settings
export const USER_AGENT =
  process.env.OR_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

export const REQUEST_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: WEB_PORTAL_BASE_URL,
};

// ArcGIS API settings
export const ARCGIS_PAGE_SIZE = 2000;

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

export interface CategoryConfig {
  name: string;
  entryId: number;
}

// All 13 facility categories from Georgia WebLink portal
export const CATEGORIES: CategoryConfig[] = [
  { name: 'ADULT DAY CENTER', entryId: 175806 },
  { name: 'ADULT DAY HEALTH SERVICES', entryId: 158910 },
  { name: 'ADULT RESIDENTIAL MENTAL HEALTH FACILITY', entryId: 212035 },
  { name: 'ASSISTED LIVING COMMUNITY', entryId: 144536 },
  { name: 'COMMUNITY LIVING ARRANGEMENT', entryId: 144540 },
  { name: 'COMPREHENSIVE OUTPATIENT REHABILITATION FACILITIES', entryId: 137685 },
  { name: 'HOME HEALTH AGENCY', entryId: 158063 },
  { name: 'HOSPICE', entryId: 133021 },
  { name: 'INTERMEDIATE CARE FACILITY FOR INTELLECTUALLY DISABLED', entryId: 133210 },
  { name: 'NURSING HOME', entryId: 132963 },
  { name: 'PERSONAL CARE HOME', entryId: 144512 },
  { name: 'PRIVATE HOME CARE PROVIDER', entryId: 144529 },
  { name: 'PSYCHIATRIC RESIDENTIAL TREATMENT FACILITIES', entryId: 133362 },
];

export const config = {
  // API endpoints
  api: {
    baseUrl: 'https://weblink.dch.georgia.gov/WebLink',
    folderListing: 'https://weblink.dch.georgia.gov/WebLink/FolderListingService.aspx/GetFolderListing2',
    metadata: 'https://weblink.dch.georgia.gov/WebLink/FolderListingService.aspx/GetMetaData',
    // PDF download pattern: {baseUrl}/0/edoc/{entryId}/{filename}.pdf
    pdfDownload: (entryId: number, filename: string) =>
      `https://weblink.dch.georgia.gov/WebLink/0/edoc/${entryId}/${encodeURIComponent(filename)}`,
  },

  // Paths
  paths: {
    root: ROOT_DIR,
    data: join(ROOT_DIR, 'data'),
    json: join(ROOT_DIR, 'data', 'json'),
    reports: join(ROOT_DIR, 'reports'),
    output: join(ROOT_DIR, 'output'),
    facilitiesRaw: join(ROOT_DIR, 'data', 'facilities-raw.json'),
  },

  // Progress tracking files
  progress: {
    categoriesFinished: join(ROOT_DIR, 'data', 'categories-finished.csv'),
    facilitiesFinished: join(ROOT_DIR, 'data', 'facilities-finished.csv'),
    reportsFinished: join(ROOT_DIR, 'data', 'reports-finished.csv'),
    skipCompleted: process.env.GA_SKIP_COMPLETED !== 'false',
  },

  // Concurrency settings (increased for faster processing)
  concurrency: {
    categories: parseInt(process.env.GA_CATEGORY_CONCURRENCY || '5', 10),
    facilities: parseInt(process.env.GA_FACILITY_CONCURRENCY || '10', 10),
    reports: parseInt(process.env.GA_REPORT_CONCURRENCY || '8', 10),
  },

  // HTTP settings
  http: {
    userAgent: process.env.GA_USER_AGENT ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
  },

  // Pagination
  pagination: {
    pageSize: parseInt(process.env.GA_PAGE_SIZE || '100', 10),
  },
};

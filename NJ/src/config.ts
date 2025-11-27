import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  baseUrl: 'https://healthapps.nj.gov/facilities',

  urls: {
    facilityDetails: (id: string) => `https://healthapps.nj.gov/facilities/fsFacilityDetails.aspx?item=${id}`,
    routineReportsPage: (id: string) => `https://healthapps.nj.gov/facilities/fsCertDetails.aspx?item=${id}`,
    complaintReportsPage: (id: string) => `https://healthapps.nj.gov/facilities/fsCompDetails.aspx?item=${id}`,
    // Deprecated: use routineReportsPage or complaintReportsPage instead
    reportsPage: (id: string) => `https://healthapps.nj.gov/facilities/fsCompDetails.aspx?item=${id}`,
  },

  concurrency: {
    facilities: parseInt(process.env.NJ_FACILITY_CONCURRENCY || '2'),
    reports: parseInt(process.env.NJ_REPORT_CONCURRENCY || '2'),
  },

  timeout: parseInt(process.env.NJ_TIMEOUT_MS || '60000'), // 60 seconds default

  retry: {
    limit: parseInt(process.env.NJ_RETRY_LIMIT || '3'), // Max 3 retries per request
    methods: ['GET', 'POST'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504, 522, 524], // Network/server errors
    backoffLimit: parseInt(process.env.NJ_RETRY_BACKOFF_LIMIT || '5000'), // Max 5 seconds between retries
  },

  userAgent: process.env.NJ_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',

  paths: {
    input: './nj.txt',
    output: process.env.NJ_OUTPUT_DIR || './output',
    reports: process.env.NJ_REPORTS_DIR || './reports',
    data: process.env.NJ_DATA_DIR || './data',
  },

  progress: {
    jsonFinishedFile: './data/url-json-finished.csv',        // Phase 1: Facility data scraped
    reportsFinishedFile: './data/url-reports-finished.csv',  // Phase 2: Reports downloaded
    finishedFile: './data/url-finished.csv',                 // Phase 3: Overall completion
    skipCompleted: process.env.NJ_SKIP_COMPLETED !== 'false',
  },

  logging: {
    level: process.env.NJ_LOG_LEVEL || 'info',
    file: process.env.NJ_LOG_FILE || './nj-scraper.log',
  },
};

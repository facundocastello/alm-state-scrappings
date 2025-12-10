import dotenv from 'dotenv';

dotenv.config();

export const config = {
  baseUrl: 'https://www.mass.gov',
  listingUrl: 'https://www.mass.gov/assisted-living-residences/locations',

  // Pagination
  facilitiesPerPage: 8,
  totalPages: parseInt(process.env.MA_TOTAL_PAGES || '34', 10), // pages 0-33

  // Concurrency settings
  listingConcurrency: parseInt(process.env.MA_LISTING_CONCURRENCY || '2', 10),
  profileConcurrency: parseInt(process.env.MA_PROFILE_CONCURRENCY || '3', 10),

  // Rate limiting
  requestDelayMs: parseInt(process.env.MA_REQUEST_DELAY_MS || '500', 10),

  // User agent
  userAgent: process.env.MA_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Paths
  dataDir: './data',
  outputDir: './output',
};

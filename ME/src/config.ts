import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export const config = {
  // Directories
  inputDir: path.join(projectRoot, 'input'),
  dataDir: path.join(projectRoot, 'data'),
  outputDir: path.join(projectRoot, 'output'),
  reportsDir: path.join(projectRoot, 'reports'),

  // Input files
  assistedHousingFile: path.join(projectRoot, 'input', 'assisted-housing.html'),
  nursingHomeFile: path.join(projectRoot, 'input', 'nh.html'),
  hospiceFile: path.join(projectRoot, 'input', 'hospice.html'),

  // URLs
  assistedHousingBaseUrl: 'https://www.pfr.maine.gov/ALMSOnline/ALMSQuery',
  nursingHomeBaseUrl: 'https://gateway.maine.gov/dhhs-apps/aspen',

  // Concurrency
  detailConcurrency: parseInt(process.env.ME_DETAIL_CONCURRENCY || '3', 10),
  downloadConcurrency: parseInt(process.env.ME_DOWNLOAD_CONCURRENCY || '2', 10),
  requestDelayMs: parseInt(process.env.ME_REQUEST_DELAY_MS || '500', 10),

  // HTTP
  userAgent: process.env.ME_USER_AGENT ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Timeouts
  requestTimeoutMs: 30000,
  downloadTimeoutMs: 60000,
};

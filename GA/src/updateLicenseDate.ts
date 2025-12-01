import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import got from 'got';
import { CookieJar } from 'tough-cookie';
import PQueue from 'p-queue';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Configuration
const CSV_PATH = join(ROOT_DIR, 'output', 'GA-updated.csv'); // Use the bed-updated CSV
const JSON_DIR = join(ROOT_DIR, 'data', 'json');
const OUTPUT_PATH = join(ROOT_DIR, 'output', 'GA-updated.csv'); // Overwrite same file
const PROGRESS_PATH = join(ROOT_DIR, 'data', 'license-date-progress.json');

const API_URL = 'https://weblink.dch.georgia.gov/WebLink/DocumentService.aspx/GetBasicDocumentInfo';

// Cookie jar for session handling
const cookieJar = new CookieJar();

const client = got.extend({
  cookieJar,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Origin': 'https://weblink.dch.georgia.gov',
    'x-lf-suppress-login-redirect': '1',
  },
  timeout: { request: 30000 },
  retry: { limit: 3 },
});

interface Report {
  entryId: number;
  name: string;
  createdDate: string;
  modifiedDate: string;
}

interface FacilityJson {
  basic: { entryId: number; name: string };
  reports: Report[];
  reportsTotal: number;
}

interface DocumentInfoResponse {
  data: {
    name: string;
    id: number;
    metadata: {
      fInfo: Array<{ name: string; values: string[] }>;
    };
  };
}

interface Progress {
  processed: Record<string, { licenseDate: string; oldestReportDate: string }>;
  errors: string[];
}

// Parse CSV row handling quoted fields with commas
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Escape field for CSV
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Load progress file
function loadProgress(): Progress {
  if (existsSync(PROGRESS_PATH)) {
    return JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8'));
  }
  return { processed: {}, errors: [] };
}

// Save progress file
function saveProgress(progress: Progress): void {
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

// Parse date string to Date object for comparison
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

// Get oldest report date from facility JSON
function getOldestReportDate(reports: Report[]): string | null {
  if (!reports || reports.length === 0) return null;

  // Extract date from report name (format: "MM/DD/YYYY - ..." or "M/D/YYYY - ...")
  const datesFromNames: { report: Report; date: Date }[] = [];

  for (const report of reports) {
    const match = report.name.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, month, day, year] = match;
      const date = new Date(`${month}/${day}/${year}`);
      if (!isNaN(date.getTime())) {
        datesFromNames.push({ report, date });
      }
    }
  }

  if (datesFromNames.length === 0) return null;

  // Sort by date ascending (oldest first)
  datesFromNames.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Return oldest date in M/D/YYYY format
  const oldest = datesFromNames[0].date;
  return `${oldest.getMonth() + 1}/${oldest.getDate()}/${oldest.getFullYear()}`;
}

// Get newest report from facility JSON (for API call)
function getNewestReport(facnum: string): Report | null {
  const jsonPath = join(JSON_DIR, `${facnum}.json`);
  if (!existsSync(jsonPath)) {
    return null;
  }

  try {
    const data: FacilityJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    if (!data.reports || data.reports.length === 0) {
      return null;
    }

    // Sort by modifiedDate descending to get newest
    const sorted = [...data.reports].sort((a, b) => {
      const dateA = new Date(a.modifiedDate);
      const dateB = new Date(b.modifiedDate);
      return dateB.getTime() - dateA.getTime();
    });

    return sorted[0];
  } catch {
    return null;
  }
}

// Get all reports from facility JSON
function getAllReports(facnum: string): Report[] {
  const jsonPath = join(JSON_DIR, `${facnum}.json`);
  if (!existsSync(jsonPath)) {
    return [];
  }

  try {
    const data: FacilityJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    return data.reports || [];
  } catch {
    return [];
  }
}

// Fetch license date from API
async function fetchLicenseDate(reportEntryId: number): Promise<string | null> {
  try {
    const response = await client.post<DocumentInfoResponse>(API_URL, {
      json: { repoName: 'WEB', entryId: reportEntryId },
      responseType: 'json',
    });

    const fInfo = response.body.data?.metadata?.fInfo;
    if (!fInfo) return null;

    const licenseDateField = fInfo.find(f => f.name === 'License Effective Date');
    if (licenseDateField && licenseDateField.values && licenseDateField.values.length > 0) {
      return licenseDateField.values[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching license date for report ${reportEntryId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function main() {
  console.log('Reading GA-updated.csv...');
  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.split('\n');
  const header = lines[0];
  const headerCols = parseCSVRow(header);
  const dataLines = lines.slice(1).filter(l => l.trim());

  console.log(`Total facilities: ${dataLines.length}`);

  // Check if we need to add "Date Business Started" column
  let dateBusinessStartedIdx = headerCols.findIndex(h => h === 'Date Business Started');
  const needNewColumn = dateBusinessStartedIdx === -1;

  if (needNewColumn) {
    console.log('Adding "Date Business Started" column...');
    dateBusinessStartedIdx = headerCols.length;
  }

  // Find facilities with missing License Effective Date (column 13, 0-indexed)
  const missingLicenseDate: { facnum: string; lineIndex: number; row: string[] }[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const row = parseCSVRow(dataLines[i]);
    const licenseDate = row[13]; // License Effective Date column
    if (!licenseDate || licenseDate.trim() === '') {
      missingLicenseDate.push({ facnum: row[0], lineIndex: i, row });
    }
  }

  console.log(`Facilities with missing License Effective Date: ${missingLicenseDate.length}`);

  // Load progress
  const progress = loadProgress();
  console.log(`Previously processed: ${Object.keys(progress.processed).length}`);

  // Filter out already processed
  const toProcess = missingLicenseDate.filter(f => !progress.processed.hasOwnProperty(f.facnum));
  console.log(`Remaining to process: ${toProcess.length}`);

  // Process with concurrency
  const queue = new PQueue({ concurrency: 5 });
  let processed = 0;
  let foundLicense = 0;
  let usedOldestReport = 0;
  let notFound = 0;

  const tasks = toProcess.map(facility => async () => {
    const { facnum } = facility;

    // Get newest report for API call
    const report = getNewestReport(facnum);
    const allReports = getAllReports(facnum);

    let licenseDate: string | null = null;
    let oldestReportDate: string | null = null;

    if (report) {
      // Fetch license date from API
      licenseDate = await fetchLicenseDate(report.entryId);
    }

    if (!licenseDate) {
      // Fallback: get oldest report date
      oldestReportDate = getOldestReportDate(allReports);
    }

    if (licenseDate) {
      foundLicense++;
    } else if (oldestReportDate) {
      usedOldestReport++;
    } else {
      notFound++;
    }

    progress.processed[facnum] = {
      licenseDate: licenseDate || '',
      oldestReportDate: oldestReportDate || ''
    };

    processed++;
    if (processed % 100 === 0) {
      console.log(`Progress: ${processed}/${toProcess.length} (license: ${foundLicense}, oldest report: ${usedOldestReport}, not found: ${notFound})`);
      saveProgress(progress);
    }
  });

  await queue.addAll(tasks);
  saveProgress(progress);

  console.log(`\nFinal: processed ${processed}, found license: ${foundLicense}, used oldest report: ${usedOldestReport}, not found: ${notFound}`);

  // Generate updated CSV
  console.log('\nGenerating updated GA-updated.csv...');

  // Update header if needed
  let newHeader = header;
  if (needNewColumn) {
    newHeader = header + ',Date Business Started';
  }

  const updatedLines: string[] = [newHeader];
  let updatedLicenseCount = 0;
  let updatedBusinessStartedCount = 0;

  for (const line of dataLines) {
    const row = parseCSVRow(line);
    const facnum = row[0];
    const currentLicenseDate = row[13];

    // Ensure row has enough columns for the new field
    if (needNewColumn) {
      row.push(''); // Add empty Date Business Started column
    }

    // If license date missing and we have data in progress
    if ((!currentLicenseDate || currentLicenseDate.trim() === '') && progress.processed[facnum]) {
      const data = progress.processed[facnum];

      if (data.licenseDate) {
        // Found license date from API - update License Effective Date column
        row[13] = data.licenseDate;
        updatedLicenseCount++;
      } else if (data.oldestReportDate) {
        // No license date, use oldest report date for Date Business Started
        row[dateBusinessStartedIdx] = data.oldestReportDate;
        updatedBusinessStartedCount++;
      }
    }

    // Rebuild CSV line
    updatedLines.push(row.map(escapeCSV).join(','));
  }

  writeFileSync(OUTPUT_PATH, updatedLines.join('\n'));
  console.log(`Updated ${updatedLicenseCount} facilities with License Effective Date`);
  console.log(`Updated ${updatedBusinessStartedCount} facilities with Date Business Started (from oldest report)`);
  console.log(`Output saved to: ${OUTPUT_PATH}`);
}

main().catch(console.error);

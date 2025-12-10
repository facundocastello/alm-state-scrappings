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
const CSV_PATH = join(ROOT_DIR, 'output', 'GA-updated.csv');
const JSON_DIR = join(ROOT_DIR, 'data', 'json');
const OUTPUT_PATH = join(ROOT_DIR, 'output', 'GA-updated.csv');
const PROGRESS_PATH = join(ROOT_DIR, 'data', 'all-fields-progress.json');

const API_URL = 'https://weblink.dch.georgia.gov/WebLink/DocumentService.aspx/GetBasicDocumentInfo';

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
  modifiedDate: string;
}

interface FacilityJson {
  basic: { entryId: number; name: string };
  reports: Report[];
}

interface ReportFields {
  facilityType: string;
  violationFound: string;
  administrator: string;
  licensedBeds: string;
  licenseEffectiveDate: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
}

interface Progress {
  processed: Record<string, ReportFields>;
  errors: string[];
}

// CSV column indices (0-based)
const COL = {
  FACNUM: 0,
  CATEGORY: 1,
  FACILITY_TYPE: 2,
  FACILITY_NAME: 3,
  VIOLATION_FOUND: 4,
  PHONE: 5,
  EMAIL: 6,
  ADDRESS: 7,
  CITY: 8,
  STATE: 9,
  ZIP: 10,
  COUNTY: 11,
  LICENSED_BEDS: 12,
  LICENSE_EFFECTIVE_DATE: 13,
  ADMINISTRATOR: 14,
  LICENSE_STATUS: 15,
  REPORTS_TOTAL: 16,
  PATH: 17,
  CREATED: 18,
  MODIFIED: 19,
  SCRAPED_AT: 20,
  DATE_BUSINESS_STARTED: 21,
};

// Parse CSV row handling quoted fields
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

// Load/save progress
function loadProgress(): Progress {
  if (existsSync(PROGRESS_PATH)) {
    return JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8'));
  }
  return { processed: {}, errors: [] };
}

function saveProgress(progress: Progress): void {
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

// Get newest report from facility JSON
function getNewestReport(facnum: string): Report | null {
  const jsonPath = join(JSON_DIR, `${facnum}.json`);
  if (!existsSync(jsonPath)) return null;

  try {
    const data: FacilityJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    if (!data.reports || data.reports.length === 0) return null;

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

// Fetch all fields from API
async function fetchReportFields(reportEntryId: number): Promise<ReportFields | null> {
  try {
    const response = await client.post(API_URL, {
      json: { repoName: 'WEB', entryId: reportEntryId },
      responseType: 'json',
    });

    const data = response.body as any;
    const fInfo = data.data?.metadata?.fInfo;
    if (!fInfo) return null;

    const getField = (name: string): string => {
      const field = fInfo.find((f: any) => f.name === name);
      return field?.values?.[0] || '';
    };

    return {
      facilityType: getField('Facility Type'),
      violationFound: getField('Violation Found?') || getField('Violation Found'),
      administrator: getField('Administrator'),
      licensedBeds: getField('Licensed Beds #') || getField('Licensed Beds'),
      licenseEffectiveDate: getField('License Effective Date'),
      phone: getField('Phone #') || getField('Phone') || getField('Phone Number') || getField('Telephone'),
      email: getField('Email') || getField('E-mail') || getField('Email Address'),
      address: getField('Address'),
      city: getField('City'),
      state: getField('State') || 'GA',
      zip: getField('Zip') || getField('Zip Code'),
      county: getField('County'),
    };
  } catch (error) {
    console.error(`Error fetching fields for report ${reportEntryId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// Check if a row needs updates (has missing fields)
function rowNeedsUpdate(row: string[]): boolean {
  // Check if any of the key fields are missing
  return (
    !row[COL.FACILITY_TYPE]?.trim() ||
    !row[COL.VIOLATION_FOUND]?.trim() ||
    !row[COL.ADMINISTRATOR]?.trim() ||
    !row[COL.LICENSED_BEDS]?.trim() ||
    !row[COL.LICENSE_EFFECTIVE_DATE]?.trim() ||
    !row[COL.PHONE]?.trim() ||
    !row[COL.ADDRESS]?.trim() ||
    !row[COL.COUNTY]?.trim()
  );
}

async function main() {
  console.log('Reading GA-updated.csv...');
  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.split('\n');
  const header = lines[0];
  const dataLines = lines.slice(1).filter(l => l.trim());

  console.log(`Total facilities: ${dataLines.length}`);

  // Find facilities with missing fields
  const needsUpdate: { facnum: string; lineIndex: number; row: string[] }[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const row = parseCSVRow(dataLines[i]);
    if (rowNeedsUpdate(row)) {
      needsUpdate.push({ facnum: row[0], lineIndex: i, row });
    }
  }

  console.log(`Facilities with missing fields: ${needsUpdate.length}`);

  // Load progress
  const progress = loadProgress();
  console.log(`Previously processed: ${Object.keys(progress.processed).length}`);

  // Filter out already processed
  const toProcess = needsUpdate.filter(f => !progress.processed.hasOwnProperty(f.facnum));
  console.log(`Remaining to process: ${toProcess.length}`);

  if (toProcess.length === 0) {
    console.log('All facilities already processed. Regenerating CSV...');
  } else {
    // Process with concurrency
    const queue = new PQueue({ concurrency: 5 });
    let processed = 0;
    let found = 0;
    let notFound = 0;

    const tasks = toProcess.map(facility => async () => {
      const { facnum } = facility;

      const report = getNewestReport(facnum);
      if (!report) {
        progress.processed[facnum] = {
          facilityType: '', violationFound: '', administrator: '',
          licensedBeds: '', licenseEffectiveDate: '', phone: '',
          email: '', address: '', city: '', state: '', zip: '', county: ''
        };
        notFound++;
        processed++;
        if (processed % 100 === 0) {
          console.log(`Progress: ${processed}/${toProcess.length} (found: ${found}, not found: ${notFound})`);
          saveProgress(progress);
        }
        return;
      }

      const fields = await fetchReportFields(report.entryId);

      if (fields) {
        progress.processed[facnum] = fields;
        found++;
      } else {
        progress.processed[facnum] = {
          facilityType: '', violationFound: '', administrator: '',
          licensedBeds: '', licenseEffectiveDate: '', phone: '',
          email: '', address: '', city: '', state: '', zip: '', county: ''
        };
        notFound++;
      }

      processed++;
      if (processed % 100 === 0) {
        console.log(`Progress: ${processed}/${toProcess.length} (found: ${found}, not found: ${notFound})`);
        saveProgress(progress);
      }
    });

    await queue.addAll(tasks);
    saveProgress(progress);

    console.log(`\nFinal: processed ${processed}, found: ${found}, not found: ${notFound}`);
  }

  // Generate updated CSV
  console.log('\nGenerating updated GA-updated.csv...');

  const updatedLines: string[] = [header];
  let updatedCount = 0;

  for (const line of dataLines) {
    const row = parseCSVRow(line);
    const facnum = row[0];

    // Ensure row has all columns
    while (row.length < 22) {
      row.push('');
    }

    const fields = progress.processed[facnum];
    if (fields) {
      let updated = false;

      // Update missing fields only (don't overwrite existing data)
      if (!row[COL.FACILITY_TYPE]?.trim() && fields.facilityType) {
        row[COL.FACILITY_TYPE] = fields.facilityType;
        updated = true;
      }
      if (!row[COL.VIOLATION_FOUND]?.trim() && fields.violationFound) {
        row[COL.VIOLATION_FOUND] = fields.violationFound;
        updated = true;
      }
      if (!row[COL.ADMINISTRATOR]?.trim() && fields.administrator) {
        row[COL.ADMINISTRATOR] = fields.administrator;
        updated = true;
      }
      if (!row[COL.LICENSED_BEDS]?.trim() && fields.licensedBeds) {
        row[COL.LICENSED_BEDS] = fields.licensedBeds;
        updated = true;
      }
      if (!row[COL.LICENSE_EFFECTIVE_DATE]?.trim() && fields.licenseEffectiveDate) {
        row[COL.LICENSE_EFFECTIVE_DATE] = fields.licenseEffectiveDate;
        updated = true;
      }
      if (!row[COL.PHONE]?.trim() && fields.phone) {
        row[COL.PHONE] = fields.phone;
        updated = true;
      }
      if (!row[COL.EMAIL]?.trim() && fields.email) {
        row[COL.EMAIL] = fields.email;
        updated = true;
      }
      if (!row[COL.ADDRESS]?.trim() && fields.address) {
        row[COL.ADDRESS] = fields.address;
        updated = true;
      }
      if (!row[COL.CITY]?.trim() && fields.city) {
        row[COL.CITY] = fields.city;
        updated = true;
      }
      if (!row[COL.STATE]?.trim() && fields.state) {
        row[COL.STATE] = fields.state;
        updated = true;
      }
      if (!row[COL.ZIP]?.trim() && fields.zip) {
        row[COL.ZIP] = fields.zip;
        updated = true;
      }
      if (!row[COL.COUNTY]?.trim() && fields.county) {
        row[COL.COUNTY] = fields.county;
        updated = true;
      }

      if (updated) updatedCount++;
    }

    updatedLines.push(row.map(escapeCSV).join(','));
  }

  writeFileSync(OUTPUT_PATH, updatedLines.join('\n'));
  console.log(`Updated ${updatedCount} facilities with missing fields`);
  console.log(`Output saved to: ${OUTPUT_PATH}`);
}

main().catch(console.error);

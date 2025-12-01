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
const CSV_PATH = join(ROOT_DIR, 'output', 'GA.csv');
const JSON_DIR = join(ROOT_DIR, 'data', 'json');
const OUTPUT_PATH = join(ROOT_DIR, 'output', 'GA-updated.csv');
const PROGRESS_PATH = join(ROOT_DIR, 'data', 'beds-progress.json');

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
  processed: Record<string, string>; // facnum -> beds
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

// Get newest report from facility JSON
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

// Fetch bed count from API
async function fetchBedCount(reportEntryId: number): Promise<string | null> {
  try {
    const response = await client.post<DocumentInfoResponse>(API_URL, {
      json: { repoName: 'WEB', entryId: reportEntryId },
      responseType: 'json',
    });

    const fInfo = response.body.data?.metadata?.fInfo;
    if (!fInfo) return null;

    const bedsField = fInfo.find(f => f.name === 'Licensed Beds #');
    if (bedsField && bedsField.values && bedsField.values.length > 0) {
      return bedsField.values[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching bed count for report ${reportEntryId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function main() {
  console.log('Reading GA.csv...');
  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.split('\n');
  const header = lines[0];
  const dataLines = lines.slice(1).filter(l => l.trim());

  console.log(`Total facilities: ${dataLines.length}`);

  // Find facilities with missing beds (column 12, 0-indexed)
  const missingBeds: { facnum: string; lineIndex: number; row: string[] }[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const row = parseCSVRow(dataLines[i]);
    const beds = row[12]; // Licensed Beds column
    if (!beds || beds.trim() === '') {
      missingBeds.push({ facnum: row[0], lineIndex: i, row });
    }
  }

  console.log(`Facilities with missing beds: ${missingBeds.length}`);

  // Load progress
  const progress = loadProgress();
  console.log(`Previously processed: ${Object.keys(progress.processed).length}`);

  // Filter out already processed
  const toProcess = missingBeds.filter(f => !progress.processed.hasOwnProperty(f.facnum));
  console.log(`Remaining to process: ${toProcess.length}`);

  // Process with concurrency
  const queue = new PQueue({ concurrency: 5 });
  let processed = 0;
  let found = 0;
  let notFound = 0;

  const tasks = toProcess.map(facility => async () => {
    const { facnum } = facility;

    // Get newest report
    const report = getNewestReport(facnum);
    if (!report) {
      progress.processed[facnum] = ''; // No report available
      notFound++;
      processed++;
      if (processed % 100 === 0) {
        console.log(`Progress: ${processed}/${toProcess.length} (found: ${found}, not found: ${notFound})`);
        saveProgress(progress);
      }
      return;
    }

    // Fetch bed count from API
    const beds = await fetchBedCount(report.entryId);

    if (beds) {
      progress.processed[facnum] = beds;
      found++;
    } else {
      progress.processed[facnum] = '';
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

  console.log(`\nFinal: processed ${processed}, found beds: ${found}, not found: ${notFound}`);

  // Generate updated CSV
  console.log('\nGenerating GA-updated.csv...');

  const updatedLines: string[] = [header];
  let updatedCount = 0;

  for (const line of dataLines) {
    const row = parseCSVRow(line);
    const facnum = row[0];
    const currentBeds = row[12];

    // If beds missing and we have a value in progress
    if ((!currentBeds || currentBeds.trim() === '') && progress.processed[facnum]) {
      row[12] = progress.processed[facnum];
      updatedCount++;
    }

    // Rebuild CSV line
    updatedLines.push(row.map(escapeCSV).join(','));
  }

  writeFileSync(OUTPUT_PATH, updatedLines.join('\n'));
  console.log(`Updated ${updatedCount} facilities with bed counts`);
  console.log(`Output saved to: ${OUTPUT_PATH}`);
}

main().catch(console.error);

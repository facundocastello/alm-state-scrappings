import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const CSV_PATH = join(ROOT_DIR, 'output', 'GA-updated.csv');
const JSON_DIR = join(ROOT_DIR, 'data', 'json');
const OUTPUT_PATH = join(ROOT_DIR, 'output', 'GA-updated.csv');

interface Report {
  entryId: number;
  name: string;
}

interface FacilityJson {
  reports: Report[];
}

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

// Extract date from report name like "1/6/2017 - INITIAL HEALTH SURVEY - ..."
// or "03/10/2022 - ROUTINE HEALTH SURVEY- ..."
function extractDateFromReportName(name: string): Date | null {
  const match = name.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    const date = new Date(`${month}/${day}/${year}`);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

// Get oldest report date from facility JSON
function getOldestReportDate(facnum: string): string | null {
  const jsonPath = join(JSON_DIR, `${facnum}.json`);
  if (!existsSync(jsonPath)) return null;

  try {
    const data: FacilityJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    if (!data.reports || data.reports.length === 0) return null;

    const datesFromNames: { date: Date }[] = [];

    for (const report of data.reports) {
      const date = extractDateFromReportName(report.name);
      if (date) {
        datesFromNames.push({ date });
      }
    }

    if (datesFromNames.length === 0) return null;

    // Sort by date ascending (oldest first)
    datesFromNames.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Return oldest date in M/D/YYYY format
    const oldest = datesFromNames[0].date;
    return `${oldest.getMonth() + 1}/${oldest.getDate()}/${oldest.getFullYear()}`;
  } catch {
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

  // Find Date Business Started column index
  let dateBusinessStartedIdx = headerCols.findIndex(h => h === 'Date Business Started');
  const needNewColumn = dateBusinessStartedIdx === -1;

  if (needNewColumn) {
    console.log('Adding "Date Business Started" column...');
    dateBusinessStartedIdx = headerCols.length;
  }

  const updatedLines: string[] = [needNewColumn ? header + ',Date Business Started' : header];
  let updatedCount = 0;
  let alreadyHasDate = 0;
  let noReports = 0;

  for (const line of dataLines) {
    const row = parseCSVRow(line);
    const facnum = row[0];

    // Ensure row has all columns
    if (needNewColumn) {
      row.push('');
    }
    while (row.length <= dateBusinessStartedIdx) {
      row.push('');
    }

    // Only update if Date Business Started is empty
    if (!row[dateBusinessStartedIdx]?.trim()) {
      const oldestDate = getOldestReportDate(facnum);
      if (oldestDate) {
        row[dateBusinessStartedIdx] = oldestDate;
        updatedCount++;
      } else {
        noReports++;
      }
    } else {
      alreadyHasDate++;
    }

    updatedLines.push(row.map(escapeCSV).join(','));
  }

  writeFileSync(OUTPUT_PATH, updatedLines.join('\n'));

  console.log(`\n=== Results ===`);
  console.log(`Already had Date Business Started: ${alreadyHasDate}`);
  console.log(`Updated with oldest report date: ${updatedCount}`);
  console.log(`No reports found: ${noReports}`);
  console.log(`\nOutput saved to: ${OUTPUT_PATH}`);
}

main().catch(console.error);

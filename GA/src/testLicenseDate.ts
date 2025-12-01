import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const JSON_DIR = join(ROOT_DIR, 'data', 'json');
const CSV_PATH = join(ROOT_DIR, 'output', 'GA.csv');

interface FacilityJson {
  basic: { entryId: number; name: string };
  metadata: { licenseEffectiveDate: string } | null;
  reports: Array<{ entryId: number; name: string }>;
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

async function main() {
  console.log('Analyzing License Effective Date coverage...\n');

  // Read CSV to find facilities missing License Effective Date
  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.split('\n');
  const dataLines = lines.slice(1).filter(l => l.trim());

  // Column 13 is "License Effective Date" (0-indexed)
  let missingLicenseDate = 0;
  let hasLicenseDate = 0;
  const missingFacnums: string[] = [];

  for (const line of dataLines) {
    const row = parseCSVRow(line);
    const licenseDate = row[13]; // License Effective Date column

    if (!licenseDate || licenseDate.trim() === '') {
      missingLicenseDate++;
      missingFacnums.push(row[0]);
    } else {
      hasLicenseDate++;
    }
  }

  console.log(`Total facilities: ${dataLines.length}`);
  console.log(`Has License Effective Date: ${hasLicenseDate}`);
  console.log(`Missing License Effective Date: ${missingLicenseDate}`);

  // Check how many of the missing ones have reports we could fetch from
  let hasReports = 0;
  let noReports = 0;

  for (const facnum of missingFacnums.slice(0, 100)) { // Sample first 100
    const jsonPath = join(JSON_DIR, `${facnum}.json`);
    try {
      const data: FacilityJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      if (data.reports && data.reports.length > 0) {
        hasReports++;
      } else {
        noReports++;
      }
    } catch {
      noReports++;
    }
  }

  console.log(`\nOf first 100 missing:`);
  console.log(`  Has reports (can fetch): ${hasReports}`);
  console.log(`  No reports: ${noReports}`);

  // Show sample of missing
  console.log(`\nSample facilities missing License Effective Date:`);
  for (const facnum of missingFacnums.slice(0, 10)) {
    const jsonPath = join(JSON_DIR, `${facnum}.json`);
    try {
      const data: FacilityJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      console.log(`  ${facnum}: "${data.basic.name}" - ${data.reports.length} reports`);
    } catch {
      console.log(`  ${facnum}: No JSON file`);
    }
  }
}

main().catch(console.error);

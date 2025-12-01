import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const JSON_DIR = join(ROOT_DIR, 'data', 'json');
const CSV_PATH = join(ROOT_DIR, 'output', 'GA.csv');

interface Report {
  entryId: number;
  name: string;
  createdDate: string;
  modifiedDate: string;
}

interface FacilityJson {
  basic: { entryId: number; name: string };
  metadata: { licenseEffectiveDate: string } | null;
  reports: Report[];
}

// Parse date from report name like "1/6/2017 - INITIAL HEALTH SURVEY - ..."
// or "03/10/2022 - INITIAL HEALTH SURVEY- ..."
function extractDateFromReportName(name: string): string | null {
  // Match patterns like "1/6/2017", "03/10/2022", etc. at the start
  const match = name.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return `${month}/${day}/${year}`;
  }
  return null;
}

// Find INITIAL report (oldest one if multiple)
function findInitialReport(reports: Report[]): Report | null {
  const initialReports = reports.filter(r =>
    r.name.toUpperCase().includes('INITIAL')
  );

  if (initialReports.length === 0) return null;

  // Sort by date extracted from name to get the oldest
  const sorted = [...initialReports].sort((a, b) => {
    const dateA = extractDateFromReportName(a.name);
    const dateB = extractDateFromReportName(b.name);
    if (!dateA || !dateB) return 0;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  return sorted[0];
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
  console.log('Testing Initial Date extraction accuracy...\n');

  // Read all JSON files
  const jsonFiles = readdirSync(JSON_DIR).filter(f => f.endsWith('.json'));
  console.log(`Total JSON files: ${jsonFiles.length}`);

  let hasInitial = 0;
  let matchesLicenseDate = 0;
  let doesNotMatchLicenseDate = 0;
  let noLicenseDate = 0;

  const mismatches: Array<{
    facnum: string;
    name: string;
    initialDate: string;
    licenseDate: string;
    daysDiff: number;
  }> = [];

  const matches: Array<{
    facnum: string;
    name: string;
    initialDate: string;
    licenseDate: string;
  }> = [];

  for (const file of jsonFiles) {
    const facnum = file.replace('.json', '');
    const jsonPath = join(JSON_DIR, file);

    try {
      const data: FacilityJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      const initialReport = findInitialReport(data.reports);

      if (!initialReport) continue;

      hasInitial++;
      const initialDate = extractDateFromReportName(initialReport.name);
      if (!initialDate) continue;

      const licenseDate = data.metadata?.licenseEffectiveDate;

      if (!licenseDate) {
        noLicenseDate++;
        continue;
      }

      // Compare dates
      const initDateObj = new Date(initialDate);
      const licenseDateObj = new Date(licenseDate);
      const daysDiff = Math.abs(initDateObj.getTime() - licenseDateObj.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 30) { // Within 30 days = match
        matchesLicenseDate++;
        matches.push({
          facnum,
          name: data.basic.name,
          initialDate,
          licenseDate
        });
      } else {
        doesNotMatchLicenseDate++;
        mismatches.push({
          facnum,
          name: data.basic.name,
          initialDate,
          licenseDate,
          daysDiff: Math.round(daysDiff)
        });
      }
    } catch (e) {
      // Skip invalid files
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Facilities with INITIAL reports: ${hasInitial}`);
  console.log(`Matches license date (within 30 days): ${matchesLicenseDate}`);
  console.log(`Does NOT match license date: ${doesNotMatchLicenseDate}`);
  console.log(`No license date to compare: ${noLicenseDate}`);

  const accuracy = matchesLicenseDate / (matchesLicenseDate + doesNotMatchLicenseDate) * 100;
  console.log(`\nAccuracy: ${accuracy.toFixed(1)}%`);

  console.log(`\n=== SAMPLE MATCHES (first 10) ===`);
  matches.slice(0, 10).forEach(m => {
    console.log(`${m.facnum}: "${m.name}" | Initial: ${m.initialDate} | License: ${m.licenseDate}`);
  });

  console.log(`\n=== MISMATCHES (first 20) ===`);
  mismatches.slice(0, 20).forEach(m => {
    console.log(`${m.facnum}: "${m.name}" | Initial: ${m.initialDate} | License: ${m.licenseDate} | Diff: ${m.daysDiff} days`);
  });
}

main().catch(console.error);

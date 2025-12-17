import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { parseNursingHomes, parseHospiceFacilities, getNursingHomeStats } from './parseNursingHome.js';
import { scrapeAssistedHousingWithPlaywright } from './scrapeAssistedDetailPlaywright.js';
import { writeAssistedHousingCsv, writeNursingHomeCsv, writeHospiceCsv } from './csv.js';
import type { AssistedHousingFacility } from './types.js';

// Ensure directories exist
function ensureDirs(): void {
  [config.dataDir, config.outputDir, config.reportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Save raw data for debugging/resume
function saveRawData(filename: string, data: unknown): void {
  const filepath = path.join(config.dataDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`Saved ${filepath}`);
}

// Load raw data if exists
function loadRawData<T>(filename: string): T | null {
  const filepath = path.join(config.dataDir, filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as T;
  }
  return null;
}

async function processAssistedHousing(): Promise<AssistedHousingFacility[]> {
  console.log('\n' + '='.repeat(60));
  console.log('Processing Assisted Housing Facilities (Playwright)');
  console.log('='.repeat(60));

  // Use Playwright-based scraper (handles session tokens properly)
  const result = await scrapeAssistedHousingWithPlaywright(
    (completed, total, current) => {
      if (completed % 25 === 0 || completed === total) {
        console.log(`  Progress: ${completed}/${total} - ${current}`);
      }
    },
    true // download reports
  );

  console.log(`\nScraping complete: ${result.facilities.length} succeeded, ${result.failed.length} failed`);
  console.log(`Documents downloaded: ${result.documentsDownloaded}`);

  // Save scraped data
  saveRawData('assisted-housing-scraped.json', result.facilities);

  // Write CSV
  console.log('\nWriting assisted housing CSV...');
  await writeAssistedHousingCsv(result.facilities);

  // Save final data
  saveRawData('assisted-housing-final.json', result.facilities);

  return result.facilities;
}

async function processNursingHomes(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('Processing Nursing Homes');
  console.log('='.repeat(60));

  console.log('\nParsing nh.html...');
  const nursingHomes = parseNursingHomes();
  const stats = getNursingHomeStats(nursingHomes);

  console.log(`\nTotal nursing homes: ${stats.total}`);
  console.log(`Total surveys referenced: ${stats.totalSurveys}`);

  // Save raw data
  saveRawData('nursing-homes.json', nursingHomes);

  // Write CSV
  await writeNursingHomeCsv(nursingHomes, 'nursing-homes.csv');
}

async function processHospice(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('Processing Hospice Facilities');
  console.log('='.repeat(60));

  console.log('\nParsing hospice.html...');
  const hospiceFacilities = parseHospiceFacilities();
  const stats = getNursingHomeStats(hospiceFacilities);

  console.log(`\nTotal hospice facilities: ${stats.total}`);
  console.log(`Total surveys referenced: ${stats.totalSurveys}`);

  // Save raw data
  saveRawData('hospice.json', hospiceFacilities);

  // Write CSV
  await writeHospiceCsv(hospiceFacilities);
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Maine Healthcare Facility Scraper (Playwright)');
  console.log('='.repeat(60));
  console.log();
  console.log(`Output directory: ${config.outputDir}`);
  console.log(`Reports directory: ${config.reportsDir}`);
  console.log();

  // Ensure directories exist
  ensureDirs();

  // Check NH/hospice input files exist (assisted housing is now scraped via Playwright)
  const inputFiles = [config.nursingHomeFile, config.hospiceFile];
  for (const file of inputFiles) {
    if (!fs.existsSync(file)) {
      console.warn(`Warning: Input file not found: ${file}`);
    }
  }

  // Process assisted housing (via Playwright - no input file needed)
  await processAssistedHousing();

  // Skip nursing homes and hospice if already processed
  if (!fs.existsSync(path.join(config.outputDir, 'nursing-homes.csv'))) {
    if (fs.existsSync(config.nursingHomeFile)) {
      await processNursingHomes();
    } else {
      console.log('\nSkipping nursing homes (input file not found)');
    }
  } else {
    console.log('\nSkipping nursing homes (already processed)');
  }

  if (!fs.existsSync(path.join(config.outputDir, 'hospice.csv'))) {
    if (fs.existsSync(config.hospiceFile)) {
      await processHospice();
    } else {
      console.log('\nSkipping hospice (input file not found)');
    }
  } else {
    console.log('Skipping hospice (already processed)');
  }

  console.log('\n' + '='.repeat(60));
  console.log('Scraping Complete!');
  console.log('='.repeat(60));
  console.log('\nOutput files:');
  console.log(`  - ${path.join(config.outputDir, 'assisted-housing.csv')}`);
  console.log(`  - ${path.join(config.outputDir, 'nursing-homes.csv')}`);
  console.log(`  - ${path.join(config.outputDir, 'hospice.csv')}`);
  console.log(`\nReports saved to: ${config.reportsDir}`);
  console.log('\nNote: Nursing home and hospice survey reports require additional step.');
  console.log('Run surveyFetcher.ts separately to download those.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

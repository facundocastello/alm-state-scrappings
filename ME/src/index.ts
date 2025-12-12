import fs from 'fs';
import path from 'path';
import PQueue from 'p-queue';
import { config } from './config.js';
import { delay } from './http.js';
import {
  parseAssistedHousingListing,
  getListingStats,
} from './parseAssistedHousing.js';
import { parseNursingHomes, parseHospiceFacilities, getNursingHomeStats } from './parseNursingHome.js';
import { scrapeAssistedHousingDetail } from './scrapeAssistedDetail.js';
import { downloadAllReports, getDownloadStats } from './reportDownloader.js';
import { writeAssistedHousingCsv, writeNursingHomeCsv, writeHospiceCsv } from './csv.js';
import {
  getAssistedHousingCompletedSet,
  markAssistedHousingCompleted,
  markAssistedHousingFailed,
} from './progressTracker.js';
import type { AssistedHousingListing, AssistedHousingFacility } from './types.js';

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
  console.log('Processing Assisted Housing Facilities');
  console.log('='.repeat(60));

  // Step 1: Parse listings
  console.log('\nParsing assisted-housing.html...');
  const allListings = parseAssistedHousingListing();
  const stats = getListingStats(allListings);

  console.log(`\nTotal listings: ${stats.total}`);
  console.log('By status:');
  Object.entries(stats.byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // Include ALL facilities (not just active) as requested
  console.log(`\nTotal facilities to scrape: ${allListings.length}`);

  // Check what's already done
  const completedSet = getAssistedHousingCompletedSet();
  const pendingListings = allListings.filter(l => !completedSet.has(l.licenseNumber));

  console.log(`Already completed: ${completedSet.size}`);
  console.log(`Pending: ${pendingListings.length}`);

  if (pendingListings.length === 0) {
    console.log('\nAll assisted housing facilities already scraped!');

    // Load from saved data
    const savedFacilities = loadRawData<AssistedHousingFacility[]>('assisted-housing-scraped.json');
    if (savedFacilities) {
      return savedFacilities;
    }
    return [];
  }

  // Step 2: Scrape detail pages
  console.log(`\nScraping detail pages (concurrency: ${config.detailConcurrency})...`);
  console.log('-'.repeat(60));

  const queue = new PQueue({ concurrency: config.detailConcurrency });
  const scrapedFacilities: AssistedHousingFacility[] = [];
  const failedListings: AssistedHousingListing[] = [];

  let processed = 0;

  const tasks = pendingListings.map(listing =>
    queue.add(async () => {
      try {
        const facility = await scrapeAssistedHousingDetail(listing);
        scrapedFacilities.push(facility);
        markAssistedHousingCompleted(listing.licenseNumber);
        processed++;

        if (processed % 25 === 0) {
          console.log(`  Progress: ${processed}/${pendingListings.length} scraped`);
        }
      } catch (error) {
        console.error(`  Error scraping ${listing.licenseNumber}: ${error instanceof Error ? error.message : error}`);
        failedListings.push(listing);
        markAssistedHousingFailed(listing.licenseNumber);
      }

      await delay(config.requestDelayMs);
    })
  );

  await Promise.all(tasks);

  console.log(`\nScraping complete: ${scrapedFacilities.length} succeeded, ${failedListings.length} failed`);

  // Save scraped data
  saveRawData('assisted-housing-scraped.json', scrapedFacilities);

  // Step 3: Write CSV BEFORE downloading reports (so we have data even if downloads fail)
  console.log('\nWriting assisted housing CSV...');
  await writeAssistedHousingCsv(scrapedFacilities);

  // Step 4: Download reports ONLY for ACTIVE facilities
  const activeFacilities = scrapedFacilities.filter(f => f.status === 'ACTIVE');
  console.log(`\nDownloading inspection reports for ${activeFacilities.length} ACTIVE facilities...`);
  const facilitiesWithReports = await downloadAllReports(
    activeFacilities,
    (completed, total, current) => {
      if (completed % 50 === 0) {
        console.log(`  Downloading: ${completed}/${total} - ${current.licenseNumber}`);
      }
    }
  );

  const downloadStats = getDownloadStats(facilitiesWithReports);
  console.log(`\nDownload stats:`);
  console.log(`  Facilities with documents: ${downloadStats.facilitiesWithDocs}`);
  console.log(`  Total documents: ${downloadStats.totalDocuments}`);
  console.log(`  Downloaded: ${downloadStats.downloadedDocuments}`);

  // Save final data with report paths (active facilities only)
  saveRawData('assisted-housing-final.json', facilitiesWithReports);

  // Return all scraped facilities (including inactive)
  return scrapedFacilities;
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
  console.log('Maine Healthcare Facility Scraper');
  console.log('='.repeat(60));
  console.log();
  console.log(`Input directory: ${config.inputDir}`);
  console.log(`Output directory: ${config.outputDir}`);
  console.log(`Reports directory: ${config.reportsDir}`);
  console.log();

  // Ensure directories exist
  ensureDirs();

  // Check input files exist
  const inputFiles = [config.assistedHousingFile, config.nursingHomeFile, config.hospiceFile];
  for (const file of inputFiles) {
    if (!fs.existsSync(file)) {
      console.error(`ERROR: Input file not found: ${file}`);
      process.exit(1);
    }
  }
  console.log('All input files found.');

  // Process each type (CSV is written inside processAssistedHousing before report downloads)
  await processAssistedHousing();

  // Skip nursing homes and hospice if already processed
  if (!fs.existsSync(path.join(config.outputDir, 'nursing-homes.csv'))) {
    await processNursingHomes();
  } else {
    console.log('\nSkipping nursing homes (already processed)');
  }

  if (!fs.existsSync(path.join(config.outputDir, 'hospice.csv'))) {
    await processHospice();
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
  console.log('\nNote: Nursing home and hospice survey reports require Playwright.');
  console.log('Run surveyFetcher.ts separately to download those.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

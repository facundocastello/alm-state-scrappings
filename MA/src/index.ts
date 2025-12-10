import PQueue from 'p-queue';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { crawlAllListings } from './crawlListings.js';
import { scrapeProfile } from './scrapeProfile.js';
import { writeFacilityToCsv, resetCsvWriter } from './csv.js';
import { delay } from './http.js';
import { loadProgress, markCompleted, markFailed, getCompletedUrls } from './progressTracker.js';
import type { FacilityFromListing, FacilityRecord } from './types.js';

const RAW_DATA_FILE = path.join(config.dataDir, 'facilities.raw.json');

function ensureDataDir(): void {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

async function loadOrCrawlListings(): Promise<FacilityFromListing[]> {
  ensureDataDir();

  // Check if we have cached listings
  if (fs.existsSync(RAW_DATA_FILE)) {
    console.log('Loading cached facility listings...');
    const data = fs.readFileSync(RAW_DATA_FILE, 'utf-8');
    const facilities = JSON.parse(data) as FacilityFromListing[];
    console.log(`Loaded ${facilities.length} facilities from cache`);
    return facilities;
  }

  // Crawl all listing pages
  console.log('Crawling facility listings from mass.gov...\n');
  const facilities = await crawlAllListings();

  // Save raw data
  fs.writeFileSync(RAW_DATA_FILE, JSON.stringify(facilities, null, 2));
  console.log(`\nSaved raw data to ${RAW_DATA_FILE}`);

  return facilities;
}

async function processFacility(facility: FacilityFromListing): Promise<FacilityRecord | null> {
  try {
    const profile = await scrapeProfile(facility.profileUrl);

    const record: FacilityRecord = {
      ...facility,
      ...profile,
      scrapedAt: new Date().toISOString(),
    };

    await writeFacilityToCsv(record);
    markCompleted(facility.profileUrl);

    return record;
  } catch (error) {
    console.error(`  Error scraping ${facility.profileUrl}:`, error instanceof Error ? error.message : error);
    markFailed(facility.profileUrl);
    return null;
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Massachusetts Assisted Living Residences Scraper');
  console.log('='.repeat(60));
  console.log();

  // Load or crawl listings
  const allFacilities = await loadOrCrawlListings();

  // Filter out already completed facilities
  const completedUrls = new Set(getCompletedUrls());
  const pendingFacilities = allFacilities.filter(f => !completedUrls.has(f.profileUrl));

  console.log(`\nTotal facilities: ${allFacilities.length}`);
  console.log(`Already completed: ${completedUrls.size}`);
  console.log(`Pending: ${pendingFacilities.length}`);

  if (pendingFacilities.length === 0) {
    console.log('\nAll facilities have been scraped!');
    return;
  }

  // Reset CSV writer if starting fresh
  if (completedUrls.size === 0) {
    resetCsvWriter();
  }

  // Process facilities with concurrency control
  console.log(`\nScraping profiles with concurrency: ${config.profileConcurrency}`);
  console.log('-'.repeat(60));

  const queue = new PQueue({ concurrency: config.profileConcurrency });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  const tasks = pendingFacilities.map(facility =>
    queue.add(async () => {
      const result = await processFacility(facility);
      processed++;

      if (result) {
        succeeded++;
      } else {
        failed++;
      }

      if (processed % 10 === 0) {
        console.log(`\nProgress: ${processed}/${pendingFacilities.length} (${succeeded} succeeded, ${failed} failed)`);
      }

      await delay(config.requestDelayMs);
    })
  );

  await Promise.all(tasks);

  console.log('\n' + '='.repeat(60));
  console.log('Scraping Complete!');
  console.log('='.repeat(60));
  console.log(`Total processed: ${processed}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Output: ${path.join(config.outputDir, 'facilities.csv')}`);
}

main().catch(console.error);

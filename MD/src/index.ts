import PQueue from 'p-queue';
import { config } from './config.js';
import { crawlAllFacilities, saveRawFacilities } from './crawl.js';
import { scrapeFacility } from './scrapeFacility.js';
import { writeFacilitiesCsv, printSummary } from './csv.js';
import { ProgressTracker } from './progressTracker.js';
import { FacilityRecord, FacilitySummary } from './types.js';

async function main() {
  console.log('Maryland Assisted Living Facilities Scraper');
  console.log('============================================\n');

  // Initialize progress tracker
  const tracker = new ProgressTracker();
  await tracker.init();

  // Phase 1: Crawl all facilities from search API
  console.log('Phase 1: Fetching facility list...\n');
  const allFacilities = await crawlAllFacilities();
  await saveRawFacilities(allFacilities);

  // Load finished IDs and filter pending
  const finishedIds = await tracker.loadFinishedIds();
  const pendingFacilities = allFacilities.filter(
    (f) => !finishedIds.has(f.assistedLivingId)
  );

  console.log(`\nTotal facilities: ${allFacilities.length}`);
  console.log(`Already processed: ${finishedIds.size}`);
  console.log(`Pending: ${pendingFacilities.length}\n`);

  if (pendingFacilities.length === 0) {
    console.log('All facilities already processed!');
    return;
  }

  // Phase 2: Scrape each facility's profile data
  console.log('Phase 2: Scraping facility profiles...\n');

  const queue = new PQueue({ concurrency: config.concurrency.facilities });
  const csvWriteQueue = new PQueue({ concurrency: 1 });
  const facilities: FacilityRecord[] = [];

  let processed = 0;
  let errors = 0;

  const processFacility = async (summary: FacilitySummary) => {
    try {
      await tracker.markInProgress(summary.assistedLivingId, summary.name);

      const record = await scrapeFacility(summary);
      facilities.push(record);

      await tracker.markFinished(summary.assistedLivingId, summary.name);

      processed++;
      if (processed % 50 === 0 || processed === pendingFacilities.length) {
        console.log(
          `Progress: ${processed}/${pendingFacilities.length} (${errors} errors)`
        );
      }

      // Write CSV incrementally (every 100 facilities)
      if (facilities.length % 100 === 0) {
        await csvWriteQueue.add(async () => {
          await writeFacilitiesCsv(facilities, true);
        });
      }
    } catch (err) {
      errors++;
      console.error(
        `Error scraping ${summary.name} (ID: ${summary.assistedLivingId}):`,
        err instanceof Error ? err.message : err
      );
    }
  };

  // Queue all facilities
  await Promise.all(
    pendingFacilities.map((summary) => queue.add(() => processFacility(summary)))
  );

  // Wait for any remaining CSV writes
  await csvWriteQueue.onIdle();

  // Final CSV write
  console.log('\nWriting final CSV...');
  await writeFacilitiesCsv(facilities);

  // Print summary
  printSummary(facilities);

  console.log(`\n============================================`);
  console.log(`Scraping complete!`);
  console.log(`Successfully processed: ${processed - errors}`);
  console.log(`Errors: ${errors}`);
  console.log(`============================================`);
}

main().catch(console.error);

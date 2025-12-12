import PQueue from "p-queue";

import { crawlAllPages } from "./crawl.js";
import { scrapeFacility } from "./scrapeFacility.js";
import { writeFacilitiesCsv, initCsvFile } from "./csv.js";
import { ProgressTracker } from "./progressTracker.js";
import { CONCURRENCY_FACILITIES } from "./config.js";
import type { FacilityRecord } from "./types.js";

const main = async (): Promise<void> => {
  console.log("=== Louisiana Adult Residential Care Scraper ===\n");

  // Initialize progress tracking
  const tracker = new ProgressTracker();
  await tracker.init();
  const finishedIds = await tracker.loadFinishedIds();
  console.log(`Found ${finishedIds.size} previously completed facilities\n`);

  // Phase 1: Crawl all listing pages
  console.log("Phase 1: Crawling listing pages...\n");
  const summaries = await crawlAllPages();
  console.log(`\nTotal facilities from crawl: ${summaries.length}`);

  // Filter out already processed facilities
  const pendingSummaries = summaries.filter((s) => !finishedIds.has(s.id));
  console.log(`Pending facilities to scrape: ${pendingSummaries.length}\n`);

  if (pendingSummaries.length === 0) {
    console.log("No new facilities to process. Exiting.");
    return;
  }

  // Initialize CSV file if this is a fresh run
  if (finishedIds.size === 0) {
    await initCsvFile();
  }

  // Phase 2: Scrape individual facility profiles
  console.log("Phase 2: Scraping facility profiles...\n");

  const facilities: FacilityRecord[] = [];
  const queue = new PQueue({ concurrency: CONCURRENCY_FACILITIES });
  const csvWriteQueue = new PQueue({ concurrency: 1 }); // Serialize CSV writes

  let processed = 0;
  const total = pendingSummaries.length;

  await Promise.all(
    pendingSummaries.map((summary) =>
      queue.add(async () => {
        try {
          await tracker.markInProgress(summary);

          const record = await scrapeFacility(summary);
          facilities.push(record);

          await tracker.markFinished(summary);

          // Write CSV incrementally
          await csvWriteQueue.add(async () => {
            await writeFacilitiesCsv(facilities, finishedIds.size > 0);
          });

          processed++;
          if (processed % 10 === 0 || processed === total) {
            console.log(`Progress: ${processed}/${total} facilities processed`);
          }
        } catch (error) {
          console.error(`Error scraping facility ${summary.id} (${summary.name}):`, error);
        }
      })
    )
  );

  // Final summary
  console.log("\n=== Scraping Complete ===");
  console.log(`Successfully scraped: ${facilities.length} facilities`);
  console.log(`Failed: ${total - facilities.length} facilities`);

  // Write final CSV with all results
  if (facilities.length > 0) {
    await writeFacilitiesCsv(facilities, false);
    console.log(`\nCSV exported to output/facilities.csv`);
  }
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

import PQueue from "p-queue";

import { crawlAllCounties } from "./crawl.js";
import { scrapeFacility } from "./scrapeFacility.js";
import { writeFacilitiesCsv } from "./csv.js";
import type { FacilityRecord, FacilitySummary } from "./types.js";
import { CONCURRENCY_FACILITIES } from "./config.js";
import { ProgressTracker } from "./progressTracker.js";

const run = async (): Promise<void> => {
  const tracker = new ProgressTracker();
  await tracker.init();
  const finishedFids = await tracker.loadFinishedFids();

  const summaries = await crawlAllCounties();
  const pendingSummaries = summaries.filter((summary) => !finishedFids.has(summary.fid));

  console.log(
    `Discovered ${summaries.length} facilities, ${pendingSummaries.length} pending (skipped ${summaries.length - pendingSummaries.length} already finished).`
  );

  if (pendingSummaries.length === 0) {
    console.log("No pending facilities to scrape. Remove url-finished.csv to force a re-run.");
    return;
  }

  console.log("Starting profile scrape...");

  const queue = new PQueue({ concurrency: Math.max(1, CONCURRENCY_FACILITIES) });
  const csvWriteQueue = new PQueue({ concurrency: 1 }); // Serialize CSV writes
  const facilities: FacilityRecord[] = [];

  let processed = 0;

  await Promise.all(
    pendingSummaries.map((summary: FacilitySummary) =>
      queue.add(async () => {
        try {
          await tracker.markInProgress(summary);
          const record = await scrapeFacility(summary);
          facilities.push(record);
          await tracker.markFinished(summary);
          finishedFids.add(summary.fid);
          processed += 1;
          
          // Write CSV incrementally after each facility (serialized to avoid race conditions)
          await csvWriteQueue.add(async () => {
            await writeFacilitiesCsv(facilities, true);
          });
          
          if (processed % 10 === 0 || processed === pendingSummaries.length) {
            console.log(`Processed ${processed}/${pendingSummaries.length} (CSV updated)`);
          }
        } catch (err) {
          console.error(`Failed to scrape ${summary.name} (${summary.profileUrl}): ${(err as Error).message}`);
        }
      })
    )
  );

  await queue.onIdle();
  await csvWriteQueue.onIdle();

  console.log(`Finished scraping ${facilities.length} facilities. Final CSV written.`);
  await writeFacilitiesCsv(facilities, false);
};

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});


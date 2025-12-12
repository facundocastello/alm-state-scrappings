import fs from "fs";
import { readFile } from "fs/promises";
import PQueue from "p-queue";

import { crawlAllFacilities } from "./crawl.js";
import { scrapeFacility } from "./scrapeFacility.js";
import { downloadChecklists } from "./reportDownloader.js";
import { writeFacilitiesCsv } from "./csv.js";
import { ProgressTracker } from "./progressTracker.js";
import { CONCURRENCY_FACILITIES, RAW_FACILITIES_PATH } from "./config.js";
import type { FacilitySummary, FacilityRecord } from "./types.js";

const main = async (): Promise<void> => {
  console.log("=== Utah CCL Facility Scraper ===\n");

  // Initialize progress tracker
  const tracker = new ProgressTracker();
  await tracker.init();

  // Step 1: Get facility list (crawl or load from cache)
  let summaries: FacilitySummary[];
  if (fs.existsSync(RAW_FACILITIES_PATH)) {
    console.log("Loading cached facility list...");
    const raw = await readFile(RAW_FACILITIES_PATH, "utf8");
    summaries = JSON.parse(raw) as FacilitySummary[];
    console.log(`Loaded ${summaries.length} facilities from cache\n`);
  } else {
    summaries = await crawlAllFacilities();
    console.log();
  }

  // Step 2: Filter out already completed facilities
  const finishedFids = await tracker.loadFinishedFids();
  const pendingSummaries = summaries.filter((s) => !finishedFids.has(s.fid));
  console.log(`${finishedFids.size} already completed, ${pendingSummaries.length} remaining\n`);

  if (pendingSummaries.length === 0) {
    console.log("All facilities already processed. Nothing to do.");
    return;
  }

  // Step 3: Process facilities in parallel
  const queue = new PQueue({ concurrency: CONCURRENCY_FACILITIES });
  const csvWriteQueue = new PQueue({ concurrency: 1 });
  const facilities: FacilityRecord[] = [];

  let processed = 0;
  const total = pendingSummaries.length;

  await Promise.all(
    pendingSummaries.map((summary) =>
      queue.add(async () => {
        try {
          await tracker.markInProgress(summary);

          // Fetch facility details
          const record = await scrapeFacility(summary);

          // Download checklists
          if (record.checklists.length > 0) {
            await downloadChecklists(record.idNumber, record.checklists);
          }

          facilities.push(record);
          await tracker.markFinished(summary);

          processed++;
          console.log(
            `[${processed}/${total}] ${record.name} (${record.idNumber}): ${record.inspectionsTotal} inspections, ${record.checklistsTotal} checklists`
          );

          // Update CSV incrementally
          await csvWriteQueue.add(async () => {
            await writeFacilitiesCsv(facilities, true);
          });
        } catch (err) {
          console.error(`Failed to process ${summary.name} (${summary.fid}): ${(err as Error).message}`);
        }
      })
    )
  );

  await queue.onIdle();
  await csvWriteQueue.onIdle();

  // Final CSV write with notification
  await writeFacilitiesCsv(facilities, false);

  console.log("\n=== Scraping Complete ===");
  console.log(`Processed: ${facilities.length} facilities`);
};

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

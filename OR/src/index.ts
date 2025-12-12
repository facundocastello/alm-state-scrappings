/**
 * Oregon Healthcare Facility Scraper
 * Main entry point and orchestrator
 */
import "dotenv/config";
import PQueue from "p-queue";
import { loadFacilities } from "./api.js";
import { scrapeFacility, ScrapingError } from "./scraper.js";
import { saveFacilityReport } from "./report.js";
import { initCSV, appendToCSV } from "./csv.js";
import { ProgressTracker } from "./progress.js";
import { CONCURRENCY } from "./config.js";
import type { FacilityFromAPI } from "./types.js";

/**
 * Process a single facility
 */
async function processFacility(
  facility: FacilityFromAPI,
  progress: ProgressTracker
): Promise<void> {
  const facilityId = facility.FacilityID;

  try {
    // Scrape all data for this facility
    const scraped = await scrapeFacility(facility);

    // Generate and save HTML report
    const reportFile = await saveFacilityReport(scraped);
    console.log(`    Saved report: ${reportFile}`);

    // Append to CSV
    await appendToCSV(scraped, reportFile);

    // Mark as completed
    await progress.markCompleted(facilityId);

    console.log(
      `    ✓ Completed ${facilityId} (${scraped.surveys.length} surveys, ` +
        `${scraped.violations.length} violations, ${scraped.notices.length} notices)`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (error instanceof ScrapingError) {
      // Critical error - don't mark as completed so we can retry later
      console.error(`    ✗ RETRY LATER ${facilityId}: ${errorMsg}`);
      // Don't call markCompleted or markError - leave it pending
    } else {
      // Other errors - mark as error but still track
      console.error(`    ✗ Error processing ${facilityId}: ${errorMsg}`);
      await progress.markError(facilityId, errorMsg);
    }
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║         Oregon Healthcare Facility Scraper               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  // Initialize progress tracker
  const progress = new ProgressTracker();
  await progress.init();

  // Initialize CSV
  await initCSV();

  // Load facilities from API (or cache)
  const allFacilities = await loadFacilities();
  console.log(`\nTotal facilities: ${allFacilities.length}`);

  // Filter out already completed facilities
  const completedIds = progress.getCompletedIds();
  const pendingFacilities = allFacilities.filter(
    (f) => !completedIds.has(f.FacilityID)
  );

  console.log(`Already completed: ${completedIds.size}`);
  console.log(`Pending: ${pendingFacilities.length}`);
  console.log(`Concurrency: ${CONCURRENCY}\n`);

  if (pendingFacilities.length === 0) {
    console.log("All facilities have been processed!");
    return;
  }

  // Create queue for concurrent processing
  const queue = new PQueue({ concurrency: CONCURRENCY });

  // Track progress
  let processed = 0;
  const total = pendingFacilities.length;
  const startTime = Date.now();

  // Queue all facilities
  for (const facility of pendingFacilities) {
    queue.add(async () => {
      await processFacility(facility, progress);
      processed++;

      // Progress update every 10 facilities
      if (processed % 10 === 0 || processed === total) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (total - processed) / rate;
        console.log(
          `\n[Progress] ${processed}/${total} ` +
            `(${((processed / total) * 100).toFixed(1)}%) - ` +
            `${rate.toFixed(1)}/sec - ` +
            `ETA: ${Math.ceil(remaining / 60)} min\n`
        );
      }
    });
  }

  // Wait for all to complete
  await queue.onIdle();

  // Final summary
  const totalTime = (Date.now() - startTime) / 1000;
  const stats = progress.getStats();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                     Scraping Complete                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Total processed: ${stats.completed}`);
  console.log(`  Time elapsed: ${(totalTime / 60).toFixed(1)} minutes`);
  console.log(`  Rate: ${(processed / totalTime).toFixed(2)} facilities/sec`);
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

/**
 * Arizona Healthcare Facility Scraper
 * Main entry point
 *
 * Usage:
 *   npm start                    # Run full scrape
 *   npm run dev                  # Run with tsx (faster iteration)
 *   npm run dev -- --sample 10   # Test with 10 facilities
 */
import fs from "fs/promises";
import { existsSync } from "fs";
import PQueue from "p-queue";
import { scrapeFacility, saveFacilityJSON, ScrapeOptions } from "./scraper.js";
import { writeCSVHeader, appendToCSV } from "./csv.js";
import { saveFacilityReport } from "./report.js";
import { loadProgress, markCompleted, markFailed, initProgress, getProgressStats } from "./progress.js";
import type { FacilityInput } from "./types.js";

// Configuration
const CONCURRENCY = parseInt(process.env.AZ_CONCURRENCY || "3", 10);
const OUTPUT_CSV = "output/facilities.csv";
const INPUT_FILE = "input/facilities.json";

// Parse command line arguments
const args = process.argv.slice(2);
const sampleSize = args.includes("--sample")
  ? parseInt(args[args.indexOf("--sample") + 1] || "10", 10)
  : null;
const skipReports = args.includes("--no-reports");
const skipInspectionDetails = args.includes("--no-details");

async function loadFacilities(): Promise<FacilityInput[]> {
  const data = await fs.readFile(INPUT_FILE, "utf-8");
  const json = JSON.parse(data);
  return json.actions[0].returnValue.returnValue;
}

async function main() {
  console.log("=".repeat(60));
  console.log("Arizona Healthcare Facility Scraper");
  console.log("=".repeat(60));

  // Load facilities
  const allFacilities = await loadFacilities();
  console.log(`\nLoaded ${allFacilities.length} facilities from input`);

  // Apply sample limit if specified
  let facilities = sampleSize ? allFacilities.slice(0, sampleSize) : allFacilities;
  console.log(`Processing ${facilities.length} facilities${sampleSize ? ` (sample)` : ""}`);

  // Load progress
  await initProgress();
  const completed = await loadProgress();
  const stats = await getProgressStats();
  console.log(`\nProgress: ${stats.completed} completed, ${stats.failed} failed`);

  // Filter out already completed facilities
  const pending = facilities.filter((f) => !completed.has(f["5"]));
  console.log(`Pending: ${pending.length} facilities to process\n`);

  if (pending.length === 0) {
    console.log("All facilities already processed!");
    return;
  }

  // Initialize CSV output
  if (!existsSync(OUTPUT_CSV)) {
    await fs.mkdir("output", { recursive: true });
    await writeCSVHeader(OUTPUT_CSV);
  }

  // Scrape options
  const scrapeOptions: ScrapeOptions = {
    downloadAttachments: false, // We generate HTML reports instead
    fetchInspectionDetails: !skipInspectionDetails,
    maxInspections: 20, // Get more inspections for comprehensive reports
  };

  console.log("Options:");
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Generate HTML reports: ${!skipReports}`);
  console.log(`  Fetch inspection details: ${scrapeOptions.fetchInspectionDetails}`);
  console.log(`  Max inspections per facility: ${scrapeOptions.maxInspections}`);
  console.log("");

  // Create queue
  const queue = new PQueue({ concurrency: CONCURRENCY });

  // Track progress
  let processed = 0;
  const startTime = Date.now();

  // Process facilities
  for (const facility of pending) {
    queue.add(async () => {
      const facilityId = facility["5"];

      try {
        // Scrape facility
        const scraped = await scrapeFacility(facility, scrapeOptions);

        // Generate HTML report
        let reportFile = "";
        if (!skipReports && scraped.inspections.length > 0) {
          reportFile = await saveFacilityReport(scraped);
        }

        // Save JSON
        await saveFacilityJSON(scraped);

        // Append to CSV
        const reportFiles = reportFile ? [reportFile] : [];
        await appendToCSV(scraped, reportFiles, OUTPUT_CSV);

        // Mark completed
        await markCompleted(facilityId);

        processed++;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (pending.length - processed) / rate;
        console.log(
          `  [${processed}/${pending.length}] Completed ${facility.facilityLegalName} ` +
            `(${rate.toFixed(1)}/s, ETA: ${formatTime(remaining)})`
        );
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error(`  ERROR processing ${facility.facilityLegalName}: ${error}`);
        await markFailed(facilityId, error);
        processed++;
      }
    });
  }

  // Wait for all to complete
  await queue.onIdle();

  // Final stats
  const finalStats = await getProgressStats();
  const elapsed = (Date.now() - startTime) / 1000;
  console.log("\n" + "=".repeat(60));
  console.log("Scraping Complete");
  console.log("=".repeat(60));
  console.log(`Total processed: ${processed}`);
  console.log(`Completed: ${finalStats.completed}`);
  console.log(`Failed: ${finalStats.failed}`);
  console.log(`Time: ${formatTime(elapsed)}`);
  console.log(`Output: ${OUTPUT_CSV}`);
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

main().catch(console.error);

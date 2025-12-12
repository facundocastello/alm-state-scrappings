import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import PQueue from "p-queue";
import { config } from "./config.js";
import { http } from "./http.js";
import { ProgressTracker } from "./progressTracker.js";
import { getFacilityMappings } from "./parseReportsList.js";
import type { FacilityMapping, ReportInfo } from "./types.js";

// p-queue v6 exports default differently
const Queue = (PQueue as unknown as { default: typeof PQueue }).default || PQueue;

/**
 * Fetch report image IDs for a facility from ImageUpload page
 */
async function fetchReportIds(itemId: string): Promise<ReportInfo[]> {
  const url = config.urls.imageUpload(itemId);
  const response = await http.get(url);
  const $ = cheerio.load(response.body);

  const reports: ReportInfo[] = [];

  // Find all data rows with TKImage links
  $("table tr").each((_, row) => {
    const $row = $(row);

    // Look for header1 cell with TKImage link
    const imageCell = $row.find('td[headers="header1"]');
    const imageLink = imageCell.find("a");

    if (imageLink.length === 0) return;

    const href = imageLink.attr("href") || "";
    const imageIdMatch = href.match(/IM=(\d+)/);
    if (!imageIdMatch) return;

    const imageId = imageIdMatch[1];
    const dateUploaded = $row.find('td[headers="header2"]').text().trim();
    const description = $row.find('td[headers="header3"]').text().trim();
    const imageType = $row.find('td[headers="header4"]').text().trim();

    reports.push({
      imageId,
      dateUploaded,
      description,
      imageType,
    });
  });

  return reports;
}

/**
 * Download a single report PDF
 */
async function downloadReport(
  imageId: string,
  outputDir: string
): Promise<string | null> {
  const url = config.urls.tkImage(imageId);

  try {
    const response = await http.get(url, { responseType: "buffer" });

    // Get filename from Content-Disposition header or use imageId
    const contentDisposition = response.headers["content-disposition"] || "";
    let filename = `${imageId}.pdf`;

    const filenameMatch = contentDisposition.match(/filename=["']?([^"';\n]+)/i);
    if (filenameMatch) {
      // Sanitize filename
      filename = filenameMatch[1]
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/\s+/g, "_")
        .trim();
    }

    const outputPath = path.join(outputDir, filename);

    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      return outputPath;
    }

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(outputPath, response.rawBody);
    return outputPath;
  } catch (error) {
    console.error(`Failed to download report ${imageId}:`, error);
    return null;
  }
}

/**
 * Download all reports for a single facility
 */
async function downloadFacilityReports(
  facility: FacilityMapping,
  queue: PQueue
): Promise<number> {
  const { licenseId, itemId, facilityName } = facility;
  const outputDir = path.join(config.paths.reports, licenseId);

  // Fetch report IDs
  const reports = await fetchReportIds(itemId);

  if (reports.length === 0) {
    return 0;
  }

  console.log(
    `  ${facilityName} (${licenseId}): Found ${reports.length} reports`
  );

  // Download each report
  let downloaded = 0;
  const downloadTasks = reports.map((report) =>
    queue.add(async () => {
      const localPath = await downloadReport(report.imageId, outputDir);
      if (localPath) {
        downloaded++;
      }
    })
  );

  await Promise.all(downloadTasks);
  return downloaded;
}

/**
 * Download all reports for all facilities
 */
export async function downloadAllReports(): Promise<void> {
  console.log("Starting report download...\n");

  // Get facility mappings
  const facilities = getFacilityMappings();
  console.log(`Total facilities: ${facilities.length}`);

  // Initialize progress tracker
  const progressTracker = new ProgressTracker();
  console.log(`Already completed: ${progressTracker.getCompletedCount()}`);

  // Filter to pending facilities
  const pending = config.skipCompleted
    ? facilities.filter((f) => !progressTracker.isCompleted(f.licenseId))
    : facilities;

  console.log(`Facilities to process: ${pending.length}\n`);

  if (pending.length === 0) {
    console.log("All facilities already processed!");
    return;
  }

  // Create queue for report downloads
  const reportQueue = new Queue({ concurrency: config.concurrency.reports });

  // Process facilities with concurrency limit
  const facilityQueue = new Queue({
    concurrency: config.concurrency.facilities,
  });

  let totalDownloaded = 0;
  let facilitiesProcessed = 0;
  let facilitiesWithReports = 0;

  const tasks = pending.map((facility) =>
    facilityQueue.add(async () => {
      try {
        const downloaded = await downloadFacilityReports(facility, reportQueue);
        totalDownloaded += downloaded;
        facilitiesProcessed++;

        if (downloaded > 0) {
          facilitiesWithReports++;
        }

        // Mark as complete
        progressTracker.markCompleted(facility.licenseId);

        // Log progress every 10 facilities
        if (facilitiesProcessed % 10 === 0) {
          console.log(
            `\nProgress: ${facilitiesProcessed}/${pending.length} facilities, ${totalDownloaded} reports downloaded`
          );
        }
      } catch (error) {
        console.error(
          `Error processing facility ${facility.licenseId}:`,
          error
        );
      }
    })
  );

  await Promise.all(tasks);

  console.log("\n" + "=".repeat(60));
  console.log("DOWNLOAD COMPLETE");
  console.log("=".repeat(60));
  console.log(`Facilities processed: ${facilitiesProcessed}`);
  console.log(`Facilities with reports: ${facilitiesWithReports}`);
  console.log(`Total reports downloaded: ${totalDownloaded}`);
  console.log(`Reports saved to: ${config.paths.reports}`);
}

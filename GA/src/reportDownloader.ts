import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import PQueue from 'p-queue';
import { config } from './config.js';
import { downloadPDF, sanitizeFilename } from './http.js';
import { FacilityRecord, Report } from './types.js';

/**
 * Load all facility JSON files
 */
export async function loadAllFacilityRecords(): Promise<FacilityRecord[]> {
  const jsonDir = config.paths.json;

  if (!existsSync(jsonDir)) {
    return [];
  }

  const files = await readdir(jsonDir);
  const records: FacilityRecord[] = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = join(jsonDir, file);
      const content = await readFile(filePath, 'utf-8');
      const record = JSON.parse(content) as FacilityRecord;
      records.push(record);
    }
  }

  return records;
}

/**
 * Load a single facility record
 */
async function loadFacilityRecord(entryId: number): Promise<FacilityRecord | null> {
  const jsonPath = join(config.paths.json, `${entryId}.json`);

  if (!existsSync(jsonPath)) {
    return null;
  }

  const content = await readFile(jsonPath, 'utf-8');
  return JSON.parse(content) as FacilityRecord;
}

/**
 * Save updated facility record
 */
async function saveFacilityRecord(record: FacilityRecord): Promise<void> {
  const jsonPath = join(config.paths.json, `${record.basic.entryId}.json`);
  await writeFile(jsonPath, JSON.stringify(record, null, 2));
}

/**
 * Load finished report downloads
 */
async function loadFinishedReports(): Promise<Set<number>> {
  const finishedFile = config.progress.reportsFinished;

  if (!existsSync(finishedFile)) {
    return new Set();
  }

  const content = await readFile(finishedFile, 'utf-8');
  const ids = content
    .split('\n')
    .map(line => parseInt(line.trim(), 10))
    .filter(id => !isNaN(id));

  return new Set(ids);
}

/**
 * Mark facility's reports as downloaded
 */
async function markReportsFinished(entryId: number): Promise<void> {
  await writeFile(config.progress.reportsFinished, entryId + '\n', { flag: 'a' });
}

/**
 * Download a single report
 */
async function downloadReport(
  report: Report,
  facilityEntryId: number
): Promise<string> {
  // Create facility reports directory
  const facilityReportsDir = join(config.paths.reports, facilityEntryId.toString());
  await mkdir(facilityReportsDir, { recursive: true });

  // Build local filename
  const safeFilename = sanitizeFilename(report.name);
  const localFilename = `${report.entryId}_${safeFilename}.${report.extension}`;
  const localPath = join(facilityReportsDir, localFilename);

  // Skip if already downloaded
  if (existsSync(localPath)) {
    return localPath;
  }

  // Download the PDF
  const buffer = await downloadPDF(report.downloadUrl);
  await writeFile(localPath, buffer);

  return localPath;
}

/**
 * Download all reports for a facility
 */
async function downloadFacilityReports(record: FacilityRecord): Promise<FacilityRecord> {
  const updatedReports: Report[] = [];
  const queue = new PQueue({ concurrency: config.concurrency.reports });

  const downloadPromises = record.reports.map(report =>
    queue.add(async () => {
      try {
        const localPath = await downloadReport(report, record.basic.entryId);
        return { ...report, localPath };
      } catch (error) {
        console.error(`    ✗ Failed to download report ${report.entryId}:`, error);
        return report; // Return without localPath on failure
      }
    })
  );

  const results = await Promise.all(downloadPromises);

  for (const result of results) {
    if (result) {
      updatedReports.push(result);
    }
  }

  return {
    ...record,
    reports: updatedReports,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Download reports for all facilities
 */
export async function downloadAllReports(): Promise<void> {
  console.log('Loading facility records...');
  const records = await loadAllFacilityRecords();
  console.log(`Loaded ${records.length} facility records`);

  const finishedIds = await loadFinishedReports();
  console.log(`Already downloaded: ${finishedIds.size} facility report sets`);

  // Filter to facilities with reports and not yet downloaded
  const toDownload = config.progress.skipCompleted
    ? records.filter(r => r.reports.length > 0 && !finishedIds.has(r.basic.entryId))
    : records.filter(r => r.reports.length > 0);

  const totalReports = toDownload.reduce((sum, r) => sum + r.reports.length, 0);
  console.log(`To download: ${toDownload.length} facilities with ${totalReports} total reports\n`);

  if (toDownload.length === 0) {
    console.log('All reports already downloaded!');
    return;
  }

  await mkdir(config.paths.reports, { recursive: true });

  let processedFacilities = 0;
  let downloadedReports = 0;

  for (const record of toDownload) {
    console.log(`Downloading reports for ${record.basic.entryId}: ${record.basic.name} (${record.reports.length} reports)...`);

    try {
      const updatedRecord = await downloadFacilityReports(record);
      await saveFacilityRecord(updatedRecord);
      await markReportsFinished(record.basic.entryId);

      const successfulDownloads = updatedRecord.reports.filter(r => r.localPath).length;
      downloadedReports += successfulDownloads;
      processedFacilities++;

      console.log(`  ✓ Downloaded ${successfulDownloads}/${record.reports.length} reports [${processedFacilities}/${toDownload.length}]`);
    } catch (error) {
      console.error(`  ✗ Failed to process facility ${record.basic.entryId}:`, error);
    }
  }

  console.log(`\nDownload complete! Processed ${processedFacilities} facilities, ${downloadedReports} reports`);
}

/**
 * Main entry point for standalone download
 */
async function main() {
  console.log('Georgia Healthcare Reports Downloader');
  console.log('=====================================\n');

  await downloadAllReports();

  console.log('\nDownload complete!');
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}

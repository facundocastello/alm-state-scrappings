import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import PQueue from 'p-queue';
import { scrapeFacility } from './scrapeFacility.js';
import { fetchAndDownloadReports } from './reportDownloader.js';
import { exportToCSV } from './csv.js';
import { config } from './config.js';
import { FacilityDetail, FacilityRecord } from './types.js';

async function loadFacilityIds(): Promise<string[]> {
  const content = await readFile(config.paths.input, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

async function loadFinishedIds(filename: string): Promise<Set<string>> {
  if (!existsSync(filename)) {
    return new Set();
  }

  const content = await readFile(filename, 'utf-8');
  const ids = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return new Set(ids);
}

async function markFinished(facilityId: string, filename: string): Promise<void> {
  await writeFile(filename, facilityId + '\n', { flag: 'a' });
}

async function saveJSON(facilityId: string, data: FacilityDetail | FacilityRecord): Promise<void> {
  const jsonDir = join(config.paths.data, 'json');
  await mkdir(jsonDir, { recursive: true });

  const jsonPath = join(jsonDir, `${facilityId}.json`);
  await writeFile(jsonPath, JSON.stringify(data, null, 2));
}

async function loadJSON(facilityId: string): Promise<FacilityDetail | null> {
  const jsonPath = join(config.paths.data, 'json', `${facilityId}.json`);

  if (!existsSync(jsonPath)) {
    return null;
  }

  const content = await readFile(jsonPath, 'utf-8');
  return JSON.parse(content) as FacilityDetail;
}

async function loadAllJSON(): Promise<FacilityRecord[]> {
  const jsonDir = join(config.paths.data, 'json');

  if (!existsSync(jsonDir)) {
    return [];
  }

  const { readdir } = await import('fs/promises');
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

// ============================================================
// PHASE 1: Scrape facility details (no reports)
// ============================================================
async function scrapeFacilityOnly(facilityId: string): Promise<void> {
  try {
    console.log(`\nScraping ${facilityId}...`);

    // Scrape facility details from all tabs
    const facilityDetail = await scrapeFacility(facilityId);

    // Determine data completeness (without reports)
    let dataCompleteness: 'full' | 'partial' | 'minimal' = 'minimal';
    if (facilityDetail.hasAdvisoryData && facilityDetail.hasReportCard) {
      dataCompleteness = 'full';
    } else if (facilityDetail.inspectionSummaries.routine.inspectionCount > 0 ||
               facilityDetail.inspectionSummaries.complaint.inspectionCount > 0) {
      dataCompleteness = 'partial';
    }

    // Save basic facility data (without reports)
    const facilityRecord = {
      ...facilityDetail,
      reports: [],  // Empty for now
      reportsTotal: 0,
      dataCompleteness,
      scrapedAt: new Date().toISOString(),
    };

    await saveJSON(facilityId, facilityRecord);
    await markFinished(facilityId, config.progress.jsonFinishedFile);

    console.log(`✓ Scraped ${facilityId} (${dataCompleteness} data)`);
  } catch (error) {
    console.error(`✗ Failed to scrape ${facilityId}:`, error);
  }
}

// ============================================================
// PHASE 2: Download reports for scraped facilities
// ============================================================
async function downloadReportsOnly(facilityId: string): Promise<void> {
  try {
    console.log(`\nDownloading reports for ${facilityId}...`);

    // Load existing facility JSON
    const existingData = await loadJSON(facilityId);

    if (!existingData) {
      console.error(`✗ No JSON found for ${facilityId}, skipping`);
      return;
    }

    // Download reports
    const reports = await fetchAndDownloadReports(facilityId);

    // Update facility record with reports
    const updatedRecord: FacilityRecord = {
      ...existingData,
      reports,
      reportsTotal: reports.length,
      dataCompleteness: (existingData as FacilityRecord).dataCompleteness || 'minimal',
      scrapedAt: new Date().toISOString(),
    };

    // Save updated JSON
    await saveJSON(facilityId, updatedRecord);
    await markFinished(facilityId, config.progress.reportsFinishedFile);

    console.log(`✓ Downloaded ${reports.length} reports for ${facilityId}`);
  } catch (error) {
    console.error(`✗ Failed to download reports for ${facilityId}:`, error);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('NJ Healthcare Facilities Scraper');
  console.log('================================\n');

  // Ensure directories exist
  await mkdir(config.paths.data, { recursive: true });
  await mkdir(config.paths.output, { recursive: true });
  await mkdir(config.paths.reports, { recursive: true });

  // Load facility IDs
  const allIds = await loadFacilityIds();
  console.log(`Loaded ${allIds.length} facility IDs from ${config.paths.input}\n`);

  // ============================================================
  // PHASE 1: Scrape facility details
  // ============================================================
  console.log('========================================');
  console.log('PHASE 1: Scraping facility details');
  console.log('========================================\n');

  const jsonFinishedIds = await loadFinishedIds(config.progress.jsonFinishedFile);
  console.log(`Already scraped: ${jsonFinishedIds.size} facilities`);

  const idsToScrape = config.progress.skipCompleted
    ? allIds.filter(id => !jsonFinishedIds.has(id))
    : allIds;

  console.log(`To scrape: ${idsToScrape.length} facilities\n`);

  if (idsToScrape.length > 0) {
    const scrapeQueue = new PQueue({ concurrency: config.concurrency.facilities });

    const scrapePromises = idsToScrape.map(id =>
      scrapeQueue.add(() => scrapeFacilityOnly(id))
    );

    await Promise.all(scrapePromises);

    console.log('\n✓ Phase 1 complete: All facility details scraped!\n');
  } else {
    console.log('✓ All facilities already scraped, skipping Phase 1\n');
  }

  // ============================================================
  // PHASE 2: Download reports
  // ============================================================
  console.log('========================================');
  console.log('PHASE 2: Downloading reports');
  console.log('========================================\n');

  const reportsFinishedIds = await loadFinishedIds(config.progress.reportsFinishedFile);
  console.log(`Already downloaded: ${reportsFinishedIds.size} facility reports`);

  const idsToDownload = config.progress.skipCompleted
    ? allIds.filter(id => !reportsFinishedIds.has(id))
    : allIds;

  console.log(`To download: ${idsToDownload.length} facility reports\n`);

  if (idsToDownload.length > 0) {
    const downloadQueue = new PQueue({ concurrency: config.concurrency.facilities });

    const downloadPromises = idsToDownload.map(id =>
      downloadQueue.add(() => downloadReportsOnly(id))
    );

    await Promise.all(downloadPromises);

    console.log('\n✓ Phase 2 complete: All reports downloaded!\n');
  } else {
    console.log('✓ All reports already downloaded, skipping Phase 2\n');
  }

  // ============================================================
  // PHASE 3: Generate CSV
  // ============================================================
  console.log('========================================');
  console.log('PHASE 3: Generating CSV');
  console.log('========================================\n');

  console.log('Loading all JSON files...');
  const records = await loadAllJSON();
  console.log(`Loaded ${records.length} facility records`);

  console.log('Exporting to CSV...');
  await exportToCSV(records);

  // Mark overall completion
  const overallFinishedIds = await loadFinishedIds(config.progress.finishedFile);
  const newlyCompleted = allIds.filter(id => !overallFinishedIds.has(id));

  for (const id of newlyCompleted) {
    await markFinished(id, config.progress.finishedFile);
  }

  console.log('\n================================');
  console.log('✓ All phases complete!');
  console.log('================================\n');
  console.log(`📊 Scraped: ${jsonFinishedIds.size + idsToScrape.length} facilities`);
  console.log(`📥 Downloaded: ${reportsFinishedIds.size + idsToDownload.length} report sets`);
  console.log(`📝 Exported: ${records.length} records to CSV`);
  console.log('\n✓ Done!');
}

main().catch(console.error);

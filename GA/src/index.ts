import { mkdir } from 'fs/promises';
import { config } from './config.js';
import { crawlAllCategories, saveFacilitiesRaw } from './crawl.js';
import { scrapeAllFacilities } from './scrapeFacility.js';
import { downloadAllReports, loadAllFacilityRecords } from './reportDownloader.js';
import { exportToCSV } from './csv.js';

async function main() {
  console.log('=============================================');
  console.log('  Georgia Healthcare Facilities Scraper');
  console.log('=============================================\n');

  // Ensure directories exist
  await mkdir(config.paths.data, { recursive: true });
  await mkdir(config.paths.json, { recursive: true });
  await mkdir(config.paths.reports, { recursive: true });
  await mkdir(config.paths.output, { recursive: true });

  // ============================================================
  // PHASE 1a: Crawl all categories for facility list
  // ============================================================
  console.log('=============================================');
  console.log('  PHASE 1a: Crawling Categories');
  console.log('=============================================\n');

  const facilities = await crawlAllCategories();
  await saveFacilitiesRaw(facilities);

  console.log(`\n✓ Phase 1a complete: Found ${facilities.length} facilities\n`);

  // ============================================================
  // PHASE 1b: Scrape facility metadata and reports list
  // ============================================================
  console.log('=============================================');
  console.log('  PHASE 1b: Scraping Facility Details');
  console.log('=============================================\n');

  await scrapeAllFacilities();

  console.log('\n✓ Phase 1b complete: All facility details scraped\n');

  // ============================================================
  // PHASE 2: Download reports
  // ============================================================
  console.log('=============================================');
  console.log('  PHASE 2: Downloading Reports');
  console.log('=============================================\n');

  await downloadAllReports();

  console.log('\n✓ Phase 2 complete: All reports downloaded\n');

  // ============================================================
  // PHASE 3: Generate CSV
  // ============================================================
  console.log('=============================================');
  console.log('  PHASE 3: Generating CSV');
  console.log('=============================================\n');

  const records = await loadAllFacilityRecords();

  // Sort by category, then by name
  records.sort((a, b) => {
    const catCompare = a.basic.categoryName.localeCompare(b.basic.categoryName);
    if (catCompare !== 0) return catCompare;
    return a.basic.name.localeCompare(b.basic.name);
  });

  await exportToCSV(records);

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n=============================================');
  console.log('  SCRAPING COMPLETE');
  console.log('=============================================\n');

  // Category summary
  const categoryCounts = new Map<string, number>();
  for (const record of records) {
    const count = categoryCounts.get(record.basic.categoryName) || 0;
    categoryCounts.set(record.basic.categoryName, count + 1);
  }

  console.log('Facilities by category:');
  for (const [category, count] of categoryCounts) {
    console.log(`  ${category}: ${count}`);
  }

  // Overall stats
  const totalReports = records.reduce((sum, r) => sum + r.reportsTotal, 0);
  const withViolations = records.filter(r => r.metadata?.violationFound === 'Yes').length;
  const withMetadata = records.filter(r => r.metadata !== null).length;

  console.log('\nOverall statistics:');
  console.log(`  Total facilities: ${records.length}`);
  console.log(`  With metadata: ${withMetadata}`);
  console.log(`  With violations: ${withViolations}`);
  console.log(`  Total reports: ${totalReports}`);

  console.log('\nOutput files:');
  console.log(`  Facilities JSON: ${config.paths.json}`);
  console.log(`  Reports: ${config.paths.reports}`);
  console.log(`  CSV: ${config.paths.output}/facilities.csv`);

  console.log('\n✓ All phases complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

import { createObjectCsvWriter } from 'csv-writer';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { config } from './config.js';
import { FacilityRecord, CSVRow } from './types.js';
import { loadAllFacilityRecords } from './reportDownloader.js';

/**
 * Convert a facility record to CSV row
 */
function convertToCSVRow(record: FacilityRecord): CSVRow {
  const metadata = record.metadata;

  return {
    entry_id: record.basic.entryId.toString(),
    category_name: record.basic.categoryName,
    facility_type: metadata?.facilityType || '',
    facility_name: metadata?.facilityName || record.basic.name,
    violation_found: metadata?.violationFound || '',
    phone: metadata?.phone || '',
    email: metadata?.email || '',
    address: metadata?.address || record.basic.address,
    city: metadata?.city || record.basic.city,
    state: metadata?.state || 'GA',
    zip: metadata?.zip || record.basic.zip,
    county: metadata?.county || record.basic.county,
    licensed_beds: metadata?.licensedBeds || '',
    license_effective_date: metadata?.licenseEffectiveDate || '',
    administrator: metadata?.administrator || '',
    subtype: metadata?.subtype || '',
    reports_total: record.reportsTotal.toString(),
    path: metadata?.path || '',
    created: metadata?.created || record.basic.createdDate,
    modified: metadata?.modified || record.basic.modifiedDate,
    scraped_at: record.scrapedAt,
  };
}

/**
 * Export all facility records to CSV
 */
export async function exportToCSV(records: FacilityRecord[]): Promise<void> {
  await mkdir(config.paths.output, { recursive: true });

  const outputPath = join(config.paths.output, 'facilities.csv');

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'entry_id', title: 'Entry ID' },
      { id: 'category_name', title: 'Category' },
      { id: 'facility_type', title: 'Facility Type' },
      { id: 'facility_name', title: 'Facility Name' },
      { id: 'violation_found', title: 'Violation Found' },
      { id: 'phone', title: 'Phone' },
      { id: 'email', title: 'Email' },
      { id: 'address', title: 'Address' },
      { id: 'city', title: 'City' },
      { id: 'state', title: 'State' },
      { id: 'zip', title: 'Zip' },
      { id: 'county', title: 'County' },
      { id: 'licensed_beds', title: 'Licensed Beds' },
      { id: 'license_effective_date', title: 'License Effective Date' },
      { id: 'administrator', title: 'Administrator' },
      { id: 'subtype', title: 'Subtype' },
      { id: 'reports_total', title: 'Reports Total' },
      { id: 'path', title: 'Path' },
      { id: 'created', title: 'Created' },
      { id: 'modified', title: 'Modified' },
      { id: 'scraped_at', title: 'Scraped At' },
    ],
  });

  const csvRows = records.map(convertToCSVRow);
  await csvWriter.writeRecords(csvRows);

  console.log(`\nExported ${records.length} facilities to ${outputPath}`);
}

/**
 * Main entry point for standalone CSV export
 */
async function main() {
  console.log('Georgia Healthcare Facilities CSV Export');
  console.log('========================================\n');

  console.log('Loading facility records...');
  const records = await loadAllFacilityRecords();
  console.log(`Loaded ${records.length} facility records`);

  if (records.length === 0) {
    console.log('No records to export!');
    return;
  }

  // Sort by category, then by name
  records.sort((a, b) => {
    const catCompare = a.basic.categoryName.localeCompare(b.basic.categoryName);
    if (catCompare !== 0) return catCompare;
    return a.basic.name.localeCompare(b.basic.name);
  });

  await exportToCSV(records);

  // Print summary by category
  console.log('\nSummary by category:');
  const categoryCounts = new Map<string, number>();
  for (const record of records) {
    const count = categoryCounts.get(record.basic.categoryName) || 0;
    categoryCounts.set(record.basic.categoryName, count + 1);
  }
  for (const [category, count] of categoryCounts) {
    console.log(`  ${category}: ${count}`);
  }

  // Print violation summary
  const withViolations = records.filter(r => r.metadata?.violationFound === 'Yes').length;
  console.log(`\nFacilities with violations: ${withViolations}/${records.length}`);

  console.log('\nCSV export complete!');
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}

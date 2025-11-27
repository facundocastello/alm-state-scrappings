import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import PQueue from 'p-queue';
import { config } from './config.js';
import { fetchMetadata, fetchFolderListing, buildPDFUrl } from './http.js';
import { FacilityBasic, FacilityMetadata, FacilityRecord, Report, MetadataField, FolderListingResult } from './types.js';

/**
 * Address info extracted from report listing
 */
interface ReportAddressInfo {
  address: string;
  city: string;
  zip: string;
  county: string;
}

/**
 * Extract field value from metadata fInfo array
 */
function getFieldValue(fInfo: MetadataField[], fieldName: string): string {
  const field = fInfo.find(f => f.name === fieldName);
  return field?.values?.[0] || '';
}

/**
 * Parse metadata response into FacilityMetadata
 */
function parseMetadata(data: { fInfo: MetadataField[]; path: string; templateName: string; created: string; modified: string }): FacilityMetadata {
  const { fInfo, path, templateName, created, modified } = data;

  return {
    facilityType: getFieldValue(fInfo, 'Facility Type'),
    facilityName: getFieldValue(fInfo, 'Facility Name'),
    violationFound: getFieldValue(fInfo, 'Violation Found?'),
    phone: getFieldValue(fInfo, 'Phone #'),
    address: getFieldValue(fInfo, 'Address'),
    city: getFieldValue(fInfo, 'City'),
    state: getFieldValue(fInfo, 'State'),
    zip: getFieldValue(fInfo, 'Zip'),
    county: getFieldValue(fInfo, 'County'),
    licensedBeds: getFieldValue(fInfo, 'Licensed Beds #'),
    licenseEffectiveDate: getFieldValue(fInfo, 'License Effective Date'),
    administrator: getFieldValue(fInfo, 'Administrator'),
    email: getFieldValue(fInfo, 'Email'),
    subtype: getFieldValue(fInfo, 'Subtype'),
    path,
    templateName,
    created,
    modified,
  };
}

/**
 * Extract address info from a report result's data array
 * data[1]: Address, data[2]: City, data[3]: Zip, data[4]: County
 */
function extractAddressFromResult(result: FolderListingResult): ReportAddressInfo | null {
  const data = result.data;
  const address = (data[1] as string) || '';
  const city = (data[2] as string) || '';
  const zip = (data[3] as string) || '';
  const county = (data[4] as string) || '';

  // Only return if we have at least one non-empty field
  if (address || city || zip || county) {
    return { address, city, zip, county };
  }
  return null;
}

/**
 * Fetch reports list for a facility and extract address from most recent report
 */
async function fetchReports(facilityEntryId: number): Promise<{ reports: Report[]; addressFromReports: ReportAddressInfo | null }> {
  const reports: Report[] = [];
  let addressFromReports: ReportAddressInfo | null = null;
  const pageSize = config.pagination.pageSize;
  let start = 0;
  let totalEntries = 0;

  do {
    const end = start + pageSize;

    try {
      const response = await fetchFolderListing(facilityEntryId, start, end);

      if (response.data.failed) {
        console.error(`  Reports error: ${response.data.errMsg}`);
        break;
      }

      totalEntries = response.data.totalEntries;

      for (const result of response.data.results) {
        // Try to extract address from the first result that has it (most recent)
        if (!addressFromReports) {
          addressFromReports = extractAddressFromResult(result);
        }

        // Only include electronic documents (isEdoc = true, type = -2)
        if (result.isEdoc && result.extension) {
          const downloadUrl = buildPDFUrl(result.entryId, result.name, result.extension);
          const data = result.data;

          reports.push({
            entryId: result.entryId,
            name: result.name,
            extension: result.extension,
            downloadUrl,
            localPath: '', // Will be set during download
            createdDate: (data[12] as string) || '',
            modifiedDate: (data[13] as string) || '',
          });
        }
      }

      start = end;
    } catch (error) {
      console.error(`  Error fetching reports page ${start}-${end}:`, error);
      break;
    }
  } while (start < totalEntries);

  return { reports, addressFromReports };
}

/**
 * Scrape a single facility's metadata and report list
 */
export async function scrapeFacility(facility: FacilityBasic): Promise<FacilityRecord> {
  // Fetch metadata
  let metadata: FacilityMetadata | null = null;

  try {
    const metadataResponse = await fetchMetadata(facility.entryId);

    if (metadataResponse.data.err) {
      console.error(`  Metadata error for ${facility.entryId}: ${metadataResponse.data.err}`);
    } else {
      metadata = parseMetadata(metadataResponse.data);
    }
  } catch (error) {
    console.error(`  Failed to fetch metadata for ${facility.entryId}:`, error);
  }

  // Fetch reports list (also extracts address from reports)
  const { reports, addressFromReports } = await fetchReports(facility.entryId);

  // If metadata is missing address fields, fill from report data
  if (metadata && addressFromReports) {
    if (!metadata.address && addressFromReports.address) {
      metadata.address = addressFromReports.address;
    }
    if (!metadata.city && addressFromReports.city) {
      metadata.city = addressFromReports.city;
    }
    if (!metadata.zip && addressFromReports.zip) {
      metadata.zip = addressFromReports.zip;
    }
    if (!metadata.county && addressFromReports.county) {
      metadata.county = addressFromReports.county;
    }
  }

  // If no metadata at all but we have address from reports, create minimal metadata
  if (!metadata && addressFromReports) {
    metadata = {
      facilityType: '',
      facilityName: facility.name,
      violationFound: '',
      phone: '',
      address: addressFromReports.address,
      city: addressFromReports.city,
      state: 'GA',
      zip: addressFromReports.zip,
      county: addressFromReports.county,
      licensedBeds: '',
      licenseEffectiveDate: '',
      administrator: '',
      email: '',
      subtype: '',
      path: '',
      templateName: '',
      created: facility.createdDate,
      modified: facility.modifiedDate,
    };
  }

  return {
    basic: facility,
    metadata,
    reports,
    reportsTotal: reports.length,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Load facilities from raw JSON
 */
export async function loadFacilitiesRaw(): Promise<FacilityBasic[]> {
  if (!existsSync(config.paths.facilitiesRaw)) {
    throw new Error(`Facilities raw file not found: ${config.paths.facilitiesRaw}`);
  }

  const content = await readFile(config.paths.facilitiesRaw, 'utf-8');
  return JSON.parse(content) as FacilityBasic[];
}

/**
 * Load finished facility IDs
 */
async function loadFinishedIds(): Promise<Set<number>> {
  const finishedFile = config.progress.facilitiesFinished;

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
 * Mark facility as finished
 */
async function markFinished(entryId: number): Promise<void> {
  await writeFile(config.progress.facilitiesFinished, entryId + '\n', { flag: 'a' });
}

/**
 * Save facility record to JSON
 */
export async function saveFacilityJSON(record: FacilityRecord): Promise<void> {
  await mkdir(config.paths.json, { recursive: true });
  const jsonPath = join(config.paths.json, `${record.basic.entryId}.json`);
  await writeFile(jsonPath, JSON.stringify(record, null, 2));
}

/**
 * Scrape all facilities
 */
export async function scrapeAllFacilities(): Promise<void> {
  console.log('Loading facilities from raw file...');
  const facilities = await loadFacilitiesRaw();
  console.log(`Loaded ${facilities.length} facilities`);

  const finishedIds = await loadFinishedIds();
  console.log(`Already scraped: ${finishedIds.size} facilities`);

  const toScrape = config.progress.skipCompleted
    ? facilities.filter(f => !finishedIds.has(f.entryId))
    : facilities;

  console.log(`To scrape: ${toScrape.length} facilities\n`);

  if (toScrape.length === 0) {
    console.log('All facilities already scraped!');
    return;
  }

  const queue = new PQueue({ concurrency: config.concurrency.facilities });
  let processed = 0;

  const scrapePromises = toScrape.map(facility =>
    queue.add(async () => {
      try {
        console.log(`Scraping ${facility.entryId}: ${facility.name}...`);

        const record = await scrapeFacility(facility);
        await saveFacilityJSON(record);
        await markFinished(facility.entryId);

        processed++;
        console.log(`  ✓ Scraped ${facility.entryId} (${record.reportsTotal} reports) [${processed}/${toScrape.length}]`);
      } catch (error) {
        console.error(`  ✗ Failed to scrape ${facility.entryId}:`, error);
      }
    })
  );

  await Promise.all(scrapePromises);
  console.log(`\nScraping complete! Processed ${processed}/${toScrape.length} facilities`);
}

/**
 * Main entry point for standalone scrape
 */
async function main() {
  console.log('Georgia Healthcare Facilities Scraper');
  console.log('=====================================\n');

  await mkdir(config.paths.data, { recursive: true });
  await mkdir(config.paths.json, { recursive: true });

  await scrapeAllFacilities();

  console.log('\nScrape complete!');
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}

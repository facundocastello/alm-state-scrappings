import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { config } from './config.js';
import { fetchJson } from './http.js';
import { SearchResponse, FacilitySummary } from './types.js';

/**
 * Fetch all assisted living facilities from the Maryland API
 */
export async function crawlAllFacilities(): Promise<FacilitySummary[]> {
  console.log('Fetching all Maryland assisted living facilities...');

  const searchUrl = `${config.endpoints.search}?includeLessThan10Beds=${config.searchParams.includeLessThan10Beds}`;
  const response = await fetchJson<SearchResponse>(searchUrl);

  console.log(`Found ${response.assistedLivings.length} facilities`);

  return response.assistedLivings;
}

/**
 * Save raw facility data to JSON file
 */
export async function saveRawFacilities(
  facilities: FacilitySummary[]
): Promise<void> {
  await mkdir(config.paths.data, { recursive: true });

  const filePath = join(config.paths.data, 'facilities.raw.json');
  await writeFile(filePath, JSON.stringify(facilities, null, 2));

  console.log(`Saved ${facilities.length} facilities to ${filePath}`);
}

/**
 * Main entry point for standalone crawl
 */
async function main() {
  console.log('Maryland Assisted Living Facilities Crawler');
  console.log('==========================================\n');

  const facilities = await crawlAllFacilities();

  // Log some stats
  const withProfile = facilities.filter((f) => f.hasProfile).length;
  const lessThan10Beds = facilities.filter((f) => f.hasLessThan10Beds).length;
  const ccrc = facilities.filter((f) => f.isCcrc).length;

  console.log(`\nStatistics:`);
  console.log(`  With profile: ${withProfile}`);
  console.log(`  Less than 10 beds: ${lessThan10Beds}`);
  console.log(`  CCRC facilities: ${ccrc}`);

  await saveRawFacilities(facilities);

  console.log('\nCrawl complete!');
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}

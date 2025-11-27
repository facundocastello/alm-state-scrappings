import { writeFile, mkdir } from 'fs/promises';
import PQueue from 'p-queue';
import { config, CATEGORIES, CategoryConfig } from './config.js';
import { fetchFolderListing } from './http.js';
import { FacilityBasic, FolderListingResult } from './types.js';

/**
 * Parse facility data from API result
 */
function parseFacilityFromResult(
  result: FolderListingResult,
  category: CategoryConfig
): FacilityBasic {
  const data = result.data;

  return {
    name: result.name,
    entryId: result.entryId,
    address: (data[1] as string) || '',
    city: (data[2] as string) || '',
    zip: (data[3] as string) || '',
    county: (data[4] as string) || '',
    categoryName: category.name,
    categoryEntryId: category.entryId,
    createdDate: (data[12] as string) || '',
    modifiedDate: (data[13] as string) || '',
  };
}

/**
 * Crawl all facilities from a single category with pagination
 */
async function crawlCategory(category: CategoryConfig): Promise<FacilityBasic[]> {
  const facilities: FacilityBasic[] = [];
  const pageSize = config.pagination.pageSize;
  let start = 0;
  let totalEntries = 0;

  console.log(`\nCrawling category: ${category.name} (entryId: ${category.entryId})`);

  do {
    const end = start + pageSize;

    try {
      const response = await fetchFolderListing(category.entryId, start, end);

      if (response.data.failed) {
        console.error(`  Error: ${response.data.errMsg}`);
        break;
      }

      totalEntries = response.data.totalEntries;

      for (const result of response.data.results) {
        // Only include folders (type 0), not documents
        if (result.type === 0) {
          const facility = parseFacilityFromResult(result, category);
          facilities.push(facility);
        }
      }

      console.log(`  Fetched ${start}-${Math.min(end, totalEntries)} of ${totalEntries} entries`);

      start = end;
    } catch (error) {
      console.error(`  Error fetching page ${start}-${end}:`, error);
      break;
    }
  } while (start < totalEntries);

  console.log(`  Found ${facilities.length} facilities in ${category.name}`);
  return facilities;
}

/**
 * Crawl all categories and return combined facility list
 */
export async function crawlAllCategories(): Promise<FacilityBasic[]> {
  console.log('Starting category crawl...');
  console.log(`Categories to crawl: ${CATEGORIES.length}`);

  const queue = new PQueue({ concurrency: config.concurrency.categories });
  const allFacilities: FacilityBasic[] = [];

  const crawlPromises = CATEGORIES.map(category =>
    queue.add(async () => {
      const facilities = await crawlCategory(category);
      allFacilities.push(...facilities);
      return facilities;
    })
  );

  await Promise.all(crawlPromises);

  console.log(`\nTotal facilities found: ${allFacilities.length}`);
  return allFacilities;
}

/**
 * Save facilities list to JSON file
 */
export async function saveFacilitiesRaw(facilities: FacilityBasic[]): Promise<void> {
  await mkdir(config.paths.data, { recursive: true });
  await writeFile(config.paths.facilitiesRaw, JSON.stringify(facilities, null, 2));
  console.log(`Saved ${facilities.length} facilities to ${config.paths.facilitiesRaw}`);
}

/**
 * Main entry point for standalone crawl
 */
async function main() {
  console.log('Georgia Healthcare Facilities Crawler');
  console.log('=====================================\n');

  const facilities = await crawlAllCategories();
  await saveFacilitiesRaw(facilities);

  // Print summary by category
  console.log('\nSummary by category:');
  for (const category of CATEGORIES) {
    const count = facilities.filter(f => f.categoryEntryId === category.entryId).length;
    console.log(`  ${category.name}: ${count}`);
  }

  console.log('\nCrawl complete!');
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}

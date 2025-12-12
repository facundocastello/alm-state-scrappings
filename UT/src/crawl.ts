import { writeFile } from "fs/promises";
import { httpClient } from "./http.js";
import { SEARCH_URL, PAGE_SIZE, RAW_FACILITIES_PATH, DATA_DIR, FACILITY_URL } from "./config.js";
import { ensureDir } from "./utils.js";
import type { SearchApiResponse, SearchApiItem, FacilitySummary } from "./types.js";

const mapToFacilitySummary = (item: SearchApiItem): FacilitySummary => {
  const address = item.address;
  return {
    fid: String(item.id),
    name: item.name,
    phone: item.phone,
    address: address?.addressOne ?? null,
    addressTwo: address?.addressTwo ?? null,
    city: address?.city ?? null,
    county: address?.county ?? null,
    state: address?.state ?? "UT",
    zip: address?.zipCode ?? null,
    totalCapacity: item.totalCapacity,
    licenseTypeId: item.licenseTypeId,
    profileUrl: FACILITY_URL(item.id),
  };
};

const fetchPage = async (page: number): Promise<SearchApiResponse> => {
  const url = `${SEARCH_URL}?page.size=${PAGE_SIZE}&page.page=${page}&page.sort=facility-search.facility-name&page.sort.dir=ASC`;
  const response = await httpClient.get(url).json<SearchApiResponse>();
  return response;
};

export const crawlAllFacilities = async (): Promise<FacilitySummary[]> => {
  console.log("Starting crawl of Utah CCL facilities...");

  // Fetch first page to get total count
  const firstPage = await fetchPage(1);
  const totalPages = firstPage.totalPages;
  const totalElements = firstPage.totalElements;

  console.log(`Found ${totalElements} facilities across ${totalPages} pages`);

  const allFacilities: FacilitySummary[] = [];

  // Process first page
  for (const item of firstPage.content) {
    allFacilities.push(mapToFacilitySummary(item));
  }
  console.log(`Page 1/${totalPages}: ${firstPage.content.length} facilities`);

  // Fetch remaining pages sequentially (to avoid overwhelming the server)
  for (let page = 2; page <= totalPages; page++) {
    try {
      const response = await fetchPage(page);
      for (const item of response.content) {
        allFacilities.push(mapToFacilitySummary(item));
      }
      console.log(`Page ${page}/${totalPages}: ${response.content.length} facilities (total: ${allFacilities.length})`);
    } catch (err) {
      console.error(`Failed to fetch page ${page}: ${(err as Error).message}`);
    }
  }

  // Save raw results
  await ensureDir(DATA_DIR);
  await writeFile(RAW_FACILITIES_PATH, JSON.stringify(allFacilities, null, 2), "utf8");
  console.log(`Saved ${allFacilities.length} facilities to ${RAW_FACILITIES_PATH}`);

  return allFacilities;
};

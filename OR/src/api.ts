/**
 * ArcGIS API Client for Oregon Facilities
 */
import fs from "fs/promises";
import path from "path";
import { httpClient } from "./http.js";
import {
  ARCGIS_BASE_URL,
  ARCGIS_PAGE_SIZE,
  DATA_DIR,
  FACILITIES_JSON,
} from "./config.js";
import type { FacilityFromAPI, ArcGISResponse } from "./types.js";

/**
 * Build query URL for ArcGIS API
 */
function buildQueryUrl(offset: number): string {
  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: "*",
    outSR: "102100",
    spatialRel: "esriSpatialRelIntersects",
    resultOffset: offset.toString(),
    resultRecordCount: ARCGIS_PAGE_SIZE.toString(),
  });
  return `${ARCGIS_BASE_URL}?${params.toString()}`;
}

/**
 * Fetch total count of facilities
 */
export async function fetchFacilityCount(): Promise<number> {
  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    returnCountOnly: "true",
  });
  const url = `${ARCGIS_BASE_URL}?${params.toString()}`;

  const response = await httpClient.get(url).json<{ count: number }>();
  return response.count;
}

/**
 * Fetch a single page of facilities
 */
async function fetchFacilitiesPage(offset: number): Promise<FacilityFromAPI[]> {
  const url = buildQueryUrl(offset);
  console.log(`  Fetching facilities offset=${offset}...`);

  const response = await httpClient.get(url).json<ArcGISResponse>();
  return response.features.map((f) => f.attributes);
}

/**
 * Fetch all facilities from ArcGIS API with pagination
 */
export async function fetchAllFacilities(): Promise<FacilityFromAPI[]> {
  console.log("Fetching facility count...");
  const totalCount = await fetchFacilityCount();
  console.log(`Total facilities: ${totalCount}`);

  const allFacilities: FacilityFromAPI[] = [];
  let offset = 0;

  while (offset < totalCount) {
    const page = await fetchFacilitiesPage(offset);
    allFacilities.push(...page);
    console.log(`  Fetched ${allFacilities.length}/${totalCount} facilities`);
    offset += ARCGIS_PAGE_SIZE;
  }

  return allFacilities;
}

/**
 * Load facilities from cache or fetch from API
 */
export async function loadFacilities(forceRefresh = false): Promise<FacilityFromAPI[]> {
  // Check if cached file exists
  if (!forceRefresh) {
    try {
      const cached = await fs.readFile(FACILITIES_JSON, "utf-8");
      const facilities = JSON.parse(cached) as FacilityFromAPI[];
      console.log(`Loaded ${facilities.length} facilities from cache`);
      return facilities;
    } catch {
      // File doesn't exist, fetch from API
    }
  }

  // Fetch from API
  console.log("Fetching facilities from ArcGIS API...");
  const facilities = await fetchAllFacilities();

  // Save to cache
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FACILITIES_JSON, JSON.stringify(facilities, null, 2));
  console.log(`Saved ${facilities.length} facilities to ${FACILITIES_JSON}`);

  return facilities;
}

/**
 * Standalone script to fetch and cache facilities
 */
async function main() {
  try {
    const facilities = await loadFacilities(true);
    console.log(`\nFetched ${facilities.length} facilities`);

    // Print summary by type
    const byType = new Map<string, number>();
    for (const f of facilities) {
      const type = f.FacilityTypeDesc || "Unknown";
      byType.set(type, (byType.get(type) || 0) + 1);
    }

    console.log("\nFacilities by type:");
    for (const [type, count] of byType.entries()) {
      console.log(`  ${type}: ${count}`);
    }
  } catch (error) {
    console.error("Error fetching facilities:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1]?.includes("api")) {
  main();
}

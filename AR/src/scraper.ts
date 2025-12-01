/**
 * Arizona Facility Scraper
 * Scrapes facility details, inspections, and deficiencies
 */
import { api } from "./api.js";
import type {
  FacilityInput,
  FacilityDetails,
  Inspection,
  InspectionDetails,
  Attachment,
  ScrapedFacility,
} from "./types.js";
import fs from "fs/promises";
import path from "path";

const REPORTS_DIR = "reports";

export interface ScrapeOptions {
  downloadAttachments: boolean;
  fetchInspectionDetails: boolean;
  maxInspections?: number; // Limit inspection details fetched per facility
}

const DEFAULT_OPTIONS: ScrapeOptions = {
  downloadAttachments: true,
  fetchInspectionDetails: true,
  maxInspections: 10, // Only get details for recent inspections
};

/**
 * Scrape a single facility with all related data
 */
export async function scrapeFacility(
  input: FacilityInput,
  options: ScrapeOptions = DEFAULT_OPTIONS
): Promise<ScrapedFacility> {
  const facilityId = input["5"];
  const errors: string[] = [];
  const scrapedAt = new Date().toISOString();

  console.log(`  Scraping: ${input.facilityLegalName} (${facilityId})`);

  // Initialize result
  const result: ScrapedFacility = {
    facilityId,
    details: null,
    inspections: [],
    inspectionDetails: new Map(),
    attachments: new Map(),
    scrapedAt,
    errors,
  };

  // 1. Get facility details
  try {
    result.details = await api.getFacilityDetails(facilityId);
  } catch (e) {
    const msg = `Failed to get details for ${facilityId}: ${e}`;
    console.error(`    ${msg}`);
    errors.push(msg);
  }

  // 2. Get inspections list
  try {
    result.inspections = await api.getInspections(facilityId);
    console.log(`    Found ${result.inspections.length} inspections`);
  } catch (e) {
    const msg = `Failed to get inspections for ${facilityId}: ${e}`;
    console.error(`    ${msg}`);
    errors.push(msg);
  }

  // 3. Get inspection details with deficiencies
  if (options.fetchInspectionDetails && result.inspections.length > 0) {
    const inspectionsToFetch = options.maxInspections
      ? result.inspections.slice(0, options.maxInspections)
      : result.inspections;

    for (const insp of inspectionsToFetch) {
      try {
        const details = await api.getInspectionDetails(facilityId, insp.inspectionId);
        result.inspectionDetails.set(insp.inspectionId, details);

        const defCount = details.inspectionItems?.length || 0;
        if (defCount > 0) {
          console.log(`    Inspection ${insp.inspectionName}: ${defCount} deficiencies`);
        }
      } catch (e) {
        const msg = `Failed to get inspection details for ${insp.inspectionId}: ${e}`;
        errors.push(msg);
      }

      // 4. Get attachments for each inspection
      if (options.downloadAttachments) {
        try {
          const attachments = await api.getAttachments(insp.inspectionId);
          if (attachments.length > 0) {
            result.attachments.set(insp.inspectionId, attachments);
            console.log(`    Found ${attachments.length} attachments for ${insp.inspectionName}`);
          }
        } catch (e) {
          const msg = `Failed to get attachments for ${insp.inspectionId}: ${e}`;
          errors.push(msg);
        }
      }
    }
  }

  return result;
}

/**
 * Download all attachments for a facility
 */
export async function downloadAttachments(
  facility: ScrapedFacility
): Promise<string[]> {
  const downloaded: string[] = [];
  const facilityDir = path.join(REPORTS_DIR, facility.facilityId);

  // Create facility directory
  await fs.mkdir(facilityDir, { recursive: true });

  for (const [inspectionId, attachments] of facility.attachments) {
    for (const att of attachments) {
      try {
        // Generate filename: INSP-XXXX_filename.pdf
        const inspection = facility.inspections.find((i) => i.inspectionId === inspectionId);
        const inspName = inspection?.inspectionName || inspectionId;
        const filename = `${inspName}_${att.Name}`;
        const filepath = path.join(facilityDir, filename);

        // Skip if already downloaded
        try {
          await fs.access(filepath);
          downloaded.push(filepath);
          continue;
        } catch {
          // File doesn't exist, download it
        }

        // Download the file
        const buffer = await api.downloadAttachment(att.DistributionPublicUrl);
        await fs.writeFile(filepath, buffer);
        downloaded.push(filepath);
        console.log(`    Downloaded: ${filename}`);
      } catch (e) {
        console.error(`    Failed to download ${att.Name}: ${e}`);
      }
    }
  }

  return downloaded;
}

/**
 * Save scraped facility data as JSON
 */
export async function saveFacilityJSON(facility: ScrapedFacility): Promise<string> {
  const dataDir = "data";
  await fs.mkdir(dataDir, { recursive: true });

  const filepath = path.join(dataDir, `${facility.facilityId}.json`);

  // Convert Maps to objects for JSON serialization
  const serializable = {
    ...facility,
    inspectionDetails: Object.fromEntries(facility.inspectionDetails),
    attachments: Object.fromEntries(facility.attachments),
  };

  await fs.writeFile(filepath, JSON.stringify(serializable, null, 2));
  return filepath;
}

/**
 * Count total deficiencies across all inspections
 */
export function countDeficiencies(facility: ScrapedFacility): number {
  let count = 0;
  for (const details of facility.inspectionDetails.values()) {
    count += details.inspectionItems?.length || 0;
  }
  return count;
}

/**
 * Get the most recent inspection
 */
export function getLatestInspection(facility: ScrapedFacility): Inspection | null {
  if (facility.inspections.length === 0) return null;

  // Sort by start date descending
  const sorted = [...facility.inspections].sort((a, b) => {
    const dateA = new Date(a.inspectionStartDate);
    const dateB = new Date(b.inspectionStartDate);
    return dateB.getTime() - dateA.getTime();
  });

  return sorted[0];
}

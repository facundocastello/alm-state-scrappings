import fs from 'fs';
import path from 'path';
import { downloadClient, delay } from './http.js';
import { config } from './config.js';
import type { AssistedHousingFacility, InspectionDocument } from './types.js';

/**
 * Sanitize a string for use as a folder/file name
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

/**
 * Format date for filename: "11/16/2023" -> "20231116"
 */
function formatDateForFilename(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return `${year}${(month || '').padStart(2, '0')}${(day || '').padStart(2, '0')}`;
  }
  // If already in YYYY-MM-DD format or other
  return dateStr.replace(/[/-]/g, '');
}

/**
 * Slugify document type for filename
 */
function slugifyType(type: string): string {
  return type
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Download a single report PDF
 */
export async function downloadReport(
  licenseNumber: string,
  document: InspectionDocument
): Promise<string | null> {
  const folderName = sanitizeFilename(licenseNumber);
  const folderPath = path.join(config.reportsDir, folderName);

  // Ensure folder exists
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Create filename: YYYYMMDD-type.pdf
  const dateStr = formatDateForFilename(document.sentDate);
  const typeSlug = slugifyType(document.type);
  const filename = `${dateStr}-${typeSlug}.pdf`;
  const filePath = path.join(folderPath, filename);

  // Skip if already exists
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  try {
    const response = await downloadClient.get(document.downloadUrl);
    const buffer = response.body as Buffer;

    // Check if we got actual PDF content (starts with %PDF)
    if (buffer.length < 100 || !buffer.subarray(0, 10).toString().includes('%PDF')) {
      // Not a PDF - likely an HTML redirect page
      console.error(`  Warning: ${document.filename} is not a valid PDF (got HTML/redirect page)`);
      return null;
    }

    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error(`  Failed to download ${document.filename}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/**
 * Download all reports for a facility
 */
export async function downloadFacilityReports(
  facility: AssistedHousingFacility
): Promise<AssistedHousingFacility> {
  const updatedFacility = { ...facility };

  for (const inspection of updatedFacility.inspections) {
    for (const doc of inspection.documents) {
      const localPath = await downloadReport(facility.licenseNumber, doc);
      if (localPath) {
        doc.localPath = localPath;
      }
      await delay(200); // Small delay between downloads
    }
  }

  return updatedFacility;
}

/**
 * Download reports for multiple facilities
 */
export async function downloadAllReports(
  facilities: AssistedHousingFacility[],
  onProgress?: (completed: number, total: number, current: AssistedHousingFacility) => void
): Promise<AssistedHousingFacility[]> {
  const results: AssistedHousingFacility[] = [];

  for (let i = 0; i < facilities.length; i++) {
    const facility = facilities[i]!;

    if (onProgress) {
      onProgress(i, facilities.length, facility);
    }

    // Count total documents for this facility
    const totalDocs = facility.inspections.reduce((sum, insp) => sum + insp.documents.length, 0);

    if (totalDocs > 0) {
      const updated = await downloadFacilityReports(facility);
      results.push(updated);
    } else {
      results.push(facility);
    }

    // Delay between facilities
    if (i < facilities.length - 1) {
      await delay(config.requestDelayMs);
    }
  }

  return results;
}

/**
 * Get download statistics
 */
export function getDownloadStats(facilities: AssistedHousingFacility[]): {
  totalFacilities: number;
  totalDocuments: number;
  downloadedDocuments: number;
  facilitiesWithDocs: number;
} {
  let totalDocuments = 0;
  let downloadedDocuments = 0;
  let facilitiesWithDocs = 0;

  for (const facility of facilities) {
    let facilityHasDocs = false;

    for (const inspection of facility.inspections) {
      for (const doc of inspection.documents) {
        totalDocuments++;
        if (doc.localPath) {
          downloadedDocuments++;
        }
        facilityHasDocs = true;
      }
    }

    if (facilityHasDocs) {
      facilitiesWithDocs++;
    }
  }

  return {
    totalFacilities: facilities.length,
    totalDocuments,
    downloadedDocuments,
    facilitiesWithDocs,
  };
}

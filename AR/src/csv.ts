/**
 * CSV Export for Arizona Facility Data
 */
import { createObjectCsvWriter } from "csv-writer";
import type { ScrapedFacility, FacilityCSVRow } from "./types.js";
import { countDeficiencies, getLatestInspection } from "./scraper.js";

const CSV_HEADERS = [
  // IDs
  { id: "facility_id", title: "Facility ID" },
  { id: "external_id", title: "External ID" },
  { id: "ccn", title: "CCN" },

  // Basic info
  { id: "legal_name", title: "Legal Name" },
  { id: "dba", title: "DBA" },
  { id: "facility_type", title: "Facility Type" },
  { id: "sub_type", title: "Sub Type" },
  { id: "bureau", title: "Bureau" },
  { id: "program", title: "Program" },

  // Status
  { id: "facility_status", title: "Facility Status" },
  { id: "license_status", title: "License Status" },
  { id: "quality_rating", title: "Quality Rating" },

  // Location
  { id: "address", title: "Address" },
  { id: "city", title: "City" },
  { id: "state", title: "State" },
  { id: "zip", title: "ZIP" },
  { id: "latitude", title: "Latitude" },
  { id: "longitude", title: "Longitude" },
  { id: "mailing_address", title: "Mailing Address" },

  // Contact
  { id: "phone", title: "Phone" },

  // License
  { id: "license_number", title: "License Number" },
  { id: "license_owner", title: "License Owner" },
  { id: "license_effective_date", title: "License Effective Date" },
  { id: "license_expiration_date", title: "License Expiration Date" },
  { id: "original_licensed_date", title: "Original Licensed Date" },
  { id: "certificate_url", title: "Certificate URL" },

  // Capacity
  { id: "total_capacity", title: "Total Capacity" },
  { id: "services", title: "Services" },

  // Management
  { id: "administrator", title: "Administrator" },
  { id: "manager", title: "Manager" },
  { id: "manager_license", title: "Manager License" },

  // Inspections summary
  { id: "inspection_count", title: "Inspection Count" },
  { id: "complaint_inspection_count", title: "Complaint Inspection Count" },
  { id: "deficiency_count", title: "Deficiency Count" },
  { id: "last_inspection_date", title: "Last Inspection Date" },
  { id: "last_inspection_type", title: "Last Inspection Type" },
  { id: "last_inspection_result", title: "Last Inspection Result" },

  // Reports
  { id: "report_files", title: "Report Files" },

  // Metadata
  { id: "scraped_at", title: "Scraped At" },
];

/**
 * Calculate total capacity from facility services if not directly provided
 */
function calculateTotalCapacity(details: ScrapedFacility["details"]): string {
  // Use direct totalCapacity if available
  if (details?.totalCapacity) {
    return details.totalCapacity;
  }

  // Calculate from services
  if (details?.facilityServices && details.facilityServices.length > 0) {
    const total = details.facilityServices.reduce((sum, s) => {
      return sum + (s.Capacity__c || 0);
    }, 0);
    if (total > 0) {
      return String(total);
    }
  }

  return "";
}

/**
 * Convert scraped facility to CSV row
 */
export function toCSVRow(facility: ScrapedFacility, reportFiles: string[] = []): FacilityCSVRow {
  const details = facility.details;
  const latestInspection = getLatestInspection(facility);
  const deficiencyCount = countDeficiencies(facility);

  // Determine last inspection result
  let lastInspectionResult = "";
  if (latestInspection) {
    const inspDetails = facility.inspectionDetails.get(latestInspection.inspectionId);
    const defCount = inspDetails?.inspectionItems?.length || 0;
    lastInspectionResult = defCount > 0 ? `${defCount} deficiencies` : "No deficiencies";
  }

  // Format services as JSON
  const services = details?.facilityServices
    ? JSON.stringify(
        details.facilityServices.map((s) => ({
          type: s.Service_Type__c,
          capacity: s.Capacity__c || null,
        }))
      )
    : "";

  // Calculate total capacity (from direct field or sum of services)
  const totalCapacity = calculateTotalCapacity(details);

  return {
    // IDs
    facility_id: facility.facilityId,
    external_id: details?.externalFacilitySearchId || "",
    ccn: details?.ccn || "",

    // Basic info
    legal_name: details?.legalName || "",
    dba: details?.dba || "",
    facility_type: details?.facilityType || "",
    sub_type: details?.subType || "",
    bureau: details?.bureau || "",
    program: details?.program || "",

    // Status
    facility_status: details?.facilityStatus || "",
    license_status: details?.licenseStatus || "",
    quality_rating: details?.qualityRating || "",

    // Location
    address: details?.address || "",
    city: details?.physicalCity || "",
    state: details?.physicalState || "",
    zip: details?.physicalZip || "",
    latitude: details?.billingLatitude || "",
    longitude: details?.billingLongitude || "",
    mailing_address: details?.mailingAddress || "",

    // Contact
    phone: details?.phone || "",

    // License
    license_number: details?.license || "",
    license_owner: details?.licenseOwner || "",
    license_effective_date: details?.effectiveDate || "",
    license_expiration_date: details?.expirationDate || "",
    original_licensed_date: details?.originalLicensedDate || "",
    certificate_url: details?.certificatePublicURL || "",

    // Capacity
    total_capacity: totalCapacity,
    services,

    // Management
    administrator: details?.chiefAdministrativeOfficer || "",
    manager: details?.manager || "",
    manager_license: details?.managerLicense || "",

    // Inspections summary
    inspection_count: facility.inspections.length,
    complaint_inspection_count: facility.inspections.filter(i => i.inspectionType.includes('Complaint')).length,
    deficiency_count: deficiencyCount,
    last_inspection_date: latestInspection?.inspectionDates || "",
    last_inspection_type: latestInspection?.inspectionType || "",
    last_inspection_result: lastInspectionResult,

    // Reports
    report_files: JSON.stringify(reportFiles),

    // Metadata
    scraped_at: facility.scrapedAt,
  };
}

/**
 * Write facilities to CSV file
 */
export async function writeCSV(
  facilities: Array<{ facility: ScrapedFacility; reportFiles: string[] }>,
  outputPath: string
): Promise<void> {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: CSV_HEADERS,
  });

  const rows = facilities.map(({ facility, reportFiles }) => toCSVRow(facility, reportFiles));
  await csvWriter.writeRecords(rows);
}

/**
 * Append a single facility to CSV file
 */
export async function appendToCSV(
  facility: ScrapedFacility,
  reportFiles: string[],
  outputPath: string
): Promise<void> {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: CSV_HEADERS,
    append: true,
  });

  const row = toCSVRow(facility, reportFiles);
  await csvWriter.writeRecords([row]);
}

/**
 * Write CSV header only (for initializing output file)
 */
export async function writeCSVHeader(outputPath: string): Promise<void> {
  const headerLine = CSV_HEADERS.map((h) => h.title).join(",") + "\n";
  const { writeFile } = await import("fs/promises");
  await writeFile(outputPath, headerLine);
}

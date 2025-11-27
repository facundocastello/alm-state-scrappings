import { parse } from "csv-parse/sync";
import { readFile } from "fs/promises";
import fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import { CSV_OUTPUT_PATH, INPUT_CSV_PATH, OUTPUT_DIR, PROFILE_URL_BASE } from "./config.js";
import type { FacilityRecord, FacilitySummary, Report } from "./types.js";
import { ensureDir, parseNumber } from "./utils.js";

export const readInputCsv = async (): Promise<FacilitySummary[]> => {
  const content = await readFile(INPUT_CSV_PATH, "utf8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<{
    "License/Exemption Number": string;
    "Facility/Camp Name": string;
    "Facility/Camp License Type": string;
    "Facility Address": string;
    City: string;
    County: string;
    Phone: string;
    "Zip Code": string;
    Capacity: string;
  }>;

  return records.map((record) => {
    const licenseNumber = record["License/Exemption Number"]?.trim() || "";
    const profileUrl = `${PROFILE_URL_BASE}/${licenseNumber}`;
    const fid = licenseNumber;

    return {
      licenseNumber,
      name: record["Facility/Camp Name"]?.trim() || "",
      licenseType: record["Facility/Camp License Type"]?.trim() || "",
      address: record["Facility Address"]?.trim() || "",
      city: record.City?.trim() || "",
      county: record.County?.trim() || "",
      phone: record.Phone?.trim() || "",
      zipCode: record["Zip Code"]?.trim() || "",
      capacity: parseNumber(record.Capacity),
      profileUrl,
      fid,
    };
  });
};

const headers = [
  { id: "facility_id", title: "facility_id" },
  { id: "licenseNumber", title: "license_number" },
  { id: "name", title: "facility_name" },
  { id: "licenseType", title: "license_type" },
  { id: "address", title: "address" },
  { id: "city", title: "city" },
  { id: "county", title: "county" },
  { id: "phone", title: "phone" },
  { id: "zipCode", title: "zip_code" },
  { id: "capacity", title: "capacity" },
  { id: "facilityStatus", title: "facility_status" },
  { id: "licenseStatus", title: "license_status" },
  { id: "licenseEffectiveDate", title: "license_effective_date" },
  { id: "licenseExpirationDate", title: "license_expiration_date" },
  { id: "licenseFacilityType", title: "license_facility_type" },
  { id: "serves", title: "serves" },
  { id: "specialCertification", title: "special_certification" },
  { id: "licenseeName", title: "licensee_name" },
  { id: "licenseeAddress", title: "licensee_address" },
  { id: "licenseePhone", title: "licensee_phone" },
  { id: "reportsTotal", title: "reports_total" },
  { id: "profileUrl", title: "URL_DETAIL" },
  { id: "reportsSummary", title: "reports" },
];

// Read existing CSV data to merge with new data
export const readExistingCsv = async (): Promise<Map<string, Record<string, string>>> => {
  const existingData = new Map<string, Record<string, string>>();
  
  if (!fs.existsSync(CSV_OUTPUT_PATH)) {
    return existingData;
  }

  try {
    const content = await readFile(CSV_OUTPUT_PATH, "utf8");
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;

    for (const record of records) {
      const facilityId = record.facility_id || record.license_number || "";
      if (facilityId) {
        existingData.set(facilityId, record);
      }
    }
  } catch (err) {
    console.warn(`Warning: Could not read existing CSV: ${(err as Error).message}`);
  }

  return existingData;
};

export const writeFacilitiesCsv = async (
  facilities: FacilityRecord[],
  silent = false,
  mergeWithExisting = true
): Promise<void> => {
  await ensureDir(OUTPUT_DIR);

  // Convert new facilities to records format
  const newRecordsMap = new Map<string, Record<string, string>>();
  
  for (const facility of facilities) {
    const reportsSummary = facility.reports
      .map((r: Report) => {
        const parts = [r.reportDate, r.reportType, r.fileName];
        if (r.localPath) {
          parts.push(r.localPath);
        } else if (r.documentUrl) {
          parts.push(r.documentUrl);
        }
        return parts.filter(Boolean).join(" :: ");
      })
      .join(" | ");

    const record: Record<string, string> = {
      facility_id: facility.fid,
      licenseNumber: facility.licenseNumber,
      name: facility.name,
      licenseType: facility.licenseType,
      address: facility.address,
      city: facility.city,
      county: facility.county,
      phone: facility.phone,
      zipCode: facility.zipCode,
      capacity: facility.capacity?.toString() ?? "",
      facilityStatus: facility.facilityStatus,
      licenseStatus: facility.licenseStatus,
      licenseEffectiveDate: facility.licenseEffectiveDate,
      licenseExpirationDate: facility.licenseExpirationDate,
      licenseFacilityType: facility.licenseFacilityType,
      serves: facility.serves.join("; "),
      specialCertification: facility.specialCertification.join("; "),
      licenseeName: facility.licenseeName,
      licenseeAddress: facility.licenseeAddress,
      licenseePhone: facility.licenseePhone,
      reportsTotal: facility.reportsTotal.toString(),
      profileUrl: facility.profileUrl,
      reportsSummary,
    };

    newRecordsMap.set(facility.fid, record);
  }

  // Merge with existing data if requested
  let allRecords: Record<string, string>[];
  if (mergeWithExisting) {
    const existingData = await readExistingCsv();
    
    // Update existing data with new data (new data takes precedence)
    for (const [fid, newRecord] of newRecordsMap.entries()) {
      existingData.set(fid, newRecord);
    }
    
    allRecords = Array.from(existingData.values());
  } else {
    allRecords = Array.from(newRecordsMap.values());
  }

  const csvWriter = createObjectCsvWriter({
    path: CSV_OUTPUT_PATH,
    header: headers,
  });

  await csvWriter.writeRecords(allRecords);
  if (!silent) {
    console.log(`CSV saved to ${CSV_OUTPUT_PATH} (${allRecords.length} total facilities, ${facilities.length} updated)`);
  }
};


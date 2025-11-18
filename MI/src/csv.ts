import { parse } from "csv-parse/sync";
import { readFile } from "fs/promises";
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
  { id: "profileUrl", title: "profile_url" },
  { id: "reportsSummary", title: "reports" },
];

export const writeFacilitiesCsv = async (
  facilities: FacilityRecord[],
  silent = false
): Promise<void> => {
  await ensureDir(OUTPUT_DIR);

  const csvWriter = createObjectCsvWriter({
    path: CSV_OUTPUT_PATH,
    header: headers,
  });

  const records = facilities.map((facility) => {
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

    return {
      ...facility,
      facility_id: facility.fid,
      serves: facility.serves.join("; "),
      specialCertification: facility.specialCertification.join("; "),
      reportsSummary,
    };
  });

  await csvWriter.writeRecords(records);
  if (!silent) {
    console.log(`CSV saved to ${CSV_OUTPUT_PATH} (${facilities.length} facilities)`);
  }
};


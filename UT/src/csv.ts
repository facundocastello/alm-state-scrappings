import { createObjectCsvWriter } from "csv-writer";
import { CSV_OUTPUT_PATH, OUTPUT_DIR } from "./config.js";
import type { FacilityRecord, Checklist } from "./types.js";
import { ensureDir } from "./utils.js";

const headers = [
  { id: "facility_id", title: "facility_id" },
  { id: "idNumber", title: "license_id" },
  { id: "name", title: "facility_name" },
  { id: "address", title: "address" },
  { id: "addressTwo", title: "address_two" },
  { id: "city", title: "city" },
  { id: "state", title: "state" },
  { id: "zip", title: "zip" },
  { id: "county", title: "county" },
  { id: "phone", title: "phone" },
  { id: "licenseType", title: "license_type" },
  { id: "capacity", title: "capacity" },
  { id: "status", title: "status" },
  { id: "specialties", title: "specialties" },
  { id: "initialRegulationDate", title: "initial_regulation_date" },
  { id: "expirationDate", title: "expiration_date" },
  { id: "conditional", title: "conditional" },
  { id: "inspectionsTotal", title: "inspections_total" },
  { id: "inspectionsWithFindings", title: "inspections_with_findings" },
  { id: "checklistsTotal", title: "checklists_total" },
  { id: "checklistsSummary", title: "checklists_summary" },
  { id: "profileUrl", title: "profile_url" },
  { id: "scrapedAt", title: "scraped_at" },
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
    const checklistsSummary = facility.checklists
      .map((c: Checklist) => {
        const parts = [c.inspectionDate, c.inspectionTypes];
        if (c.localPath) {
          parts.push(c.localPath);
        } else {
          parts.push(c.downloadUrl);
        }
        return parts.filter(Boolean).join(" :: ");
      })
      .join(" | ");

    return {
      facility_id: facility.fid,
      idNumber: facility.idNumber,
      name: facility.name,
      address: facility.address,
      addressTwo: facility.addressTwo,
      city: facility.city,
      state: facility.state,
      zip: facility.zip,
      county: facility.county,
      phone: facility.phone,
      licenseType: facility.licenseType,
      capacity: facility.capacity,
      status: facility.status,
      specialties: facility.specialties,
      initialRegulationDate: facility.initialRegulationDate,
      expirationDate: facility.expirationDate,
      conditional: facility.conditional,
      inspectionsTotal: facility.inspectionsTotal,
      inspectionsWithFindings: facility.inspectionsWithFindings,
      checklistsTotal: facility.checklistsTotal,
      checklistsSummary,
      profileUrl: facility.profileUrl,
      scrapedAt: facility.scrapedAt,
    };
  });

  await csvWriter.writeRecords(records);
  if (!silent) {
    console.log(`CSV saved to ${CSV_OUTPUT_PATH} (${facilities.length} facilities)`);
  }
};

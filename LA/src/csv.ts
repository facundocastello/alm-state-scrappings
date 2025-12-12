import { createObjectCsvWriter } from "csv-writer";
import { CSV_OUTPUT_PATH, OUTPUT_DIR } from "./config.js";
import { ensureDir } from "./utils.js";
import type { FacilityRecord } from "./types.js";

// Define CSV columns
const CSV_HEADERS = [
  { id: "facility_id", title: "facility_id" },
  { id: "facility_name", title: "facility_name" },
  { id: "license_number", title: "license_number" },
  { id: "license_level", title: "license_level" },
  { id: "capacity", title: "capacity" },
  { id: "address", title: "address" },
  { id: "city", title: "city" },
  { id: "state", title: "state" },
  { id: "zip", title: "zip" },
  { id: "phone", title: "phone" },
  { id: "fax", title: "fax" },
  { id: "services", title: "services" },
  { id: "contact_person", title: "contact_person" },
  { id: "latitude", title: "latitude" },
  { id: "longitude", title: "longitude" },
  { id: "profile_url", title: "profile_url" },
];

interface CsvRecord {
  facility_id: string;
  facility_name: string;
  license_number: string;
  license_level: string;
  capacity: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  fax: string;
  services: string;
  contact_person: string;
  latitude: string;
  longitude: string;
  profile_url: string;
}

/**
 * Transform a FacilityRecord to a flat CSV record
 */
const transformRecord = (facility: FacilityRecord): CsvRecord => {
  return {
    facility_id: facility.id,
    facility_name: facility.name,
    license_number: facility.licenseNumber || "",
    license_level: facility.licenseLevel || "",
    capacity: facility.capacity?.toString() || "",
    address: facility.address,
    city: facility.city,
    state: facility.state,
    zip: facility.zip,
    phone: facility.phone,
    fax: facility.fax || "",
    services: facility.services.join(" | "),
    contact_person: facility.contactPerson || "",
    latitude: facility.latitude?.toString() || "",
    longitude: facility.longitude?.toString() || "",
    profile_url: facility.profileUrl,
  };
};

/**
 * Write facilities to CSV file
 * @param facilities - Array of facility records to write
 * @param append - If true, append to existing file (only data, no headers)
 */
export const writeFacilitiesCsv = async (
  facilities: FacilityRecord[],
  append: boolean = false
): Promise<void> => {
  await ensureDir(OUTPUT_DIR);

  const csvWriter = createObjectCsvWriter({
    path: CSV_OUTPUT_PATH,
    header: CSV_HEADERS,
    append,
  });

  const records = facilities.map(transformRecord);
  await csvWriter.writeRecords(records);
};

/**
 * Write a single facility to CSV (used for incremental updates)
 */
export const appendFacilityCsv = async (facility: FacilityRecord): Promise<void> => {
  await ensureDir(OUTPUT_DIR);

  const csvWriter = createObjectCsvWriter({
    path: CSV_OUTPUT_PATH,
    header: CSV_HEADERS,
    append: true,
  });

  const record = transformRecord(facility);
  await csvWriter.writeRecords([record]);
};

/**
 * Initialize the CSV file with headers only
 */
export const initCsvFile = async (): Promise<void> => {
  await ensureDir(OUTPUT_DIR);

  const csvWriter = createObjectCsvWriter({
    path: CSV_OUTPUT_PATH,
    header: CSV_HEADERS,
  });

  await csvWriter.writeRecords([]);
};

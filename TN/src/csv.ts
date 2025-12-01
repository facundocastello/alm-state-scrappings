import * as crypto from "crypto";
import { createObjectCsvWriter } from "csv-writer";
import type { TNFacility, CSVRecord } from "./types.js";

/**
 * Generate a unique facility ID.
 * For facilities with a real license number (not 00000000), use the license number.
 * For facilities without a proper license, generate a hash-based ID from name + address.
 */
function generateFacilityId(facility: TNFacility): string {
  // If license number is valid (not all zeros), use it as-is
  if (facility.licenseNumber && !/^0+$/.test(facility.licenseNumber)) {
    return facility.licenseNumber;
  }

  // Generate a hash-based ID from facility name + address
  const input = `${facility.facilityName}|${facility.address}|${facility.city}|${facility.zip}`.toLowerCase();
  const hash = crypto.createHash("md5").update(input).digest("hex").substring(0, 8);
  return `GEN-${hash}`;
}

export function facilityToCSVRecord(facility: TNFacility, facilityType: string): CSVRecord {
  // Combine owner address parts
  const ownerFullAddress = [
    facility.ownerAddress,
    facility.ownerCity,
    facility.ownerState,
    facility.ownerZip,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    facility_id: generateFacilityId(facility),
    license_number: facility.licenseNumber,
    facility_name: facility.facilityName,
    facility_type: facilityType,
    status: facility.status,
    address: facility.address,
    city: facility.city,
    state: facility.state,
    zip: facility.zip,
    phone: facility.phone,
    number_of_beds: facility.numberOfBeds,
    administrator: facility.administrator,
    owner_name: facility.ownerName,
    owner_address: ownerFullAddress,
    owner_phone: facility.ownerPhone,
    date_of_original_licensure: facility.dateOfOriginalLicensure,
    date_of_expiration: facility.dateOfExpiration,
    date_of_last_survey: facility.dateOfLastSurvey,
    accreditation_expires: facility.accreditationExpires,
    managed_by: facility.managedBy,
    managed_by_location: facility.managedByLocation,
    disciplinary_action_count: facility.disciplinaryActionCount,
    has_disciplinary_actions: facility.hasDisciplinaryActions ? "Yes" : "No",
    disciplinary_action_url: facility.disciplinaryActionUrl,
    scraped_at: new Date().toISOString(),
  };
}

export async function writeCSV(
  facilities: TNFacility[],
  facilityType: string,
  outputPath: string
): Promise<void> {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: "facility_id", title: "Facility ID" },
      { id: "license_number", title: "License Number" },
      { id: "facility_name", title: "Facility Name" },
      { id: "facility_type", title: "Facility Type" },
      { id: "status", title: "Status" },
      { id: "address", title: "Address" },
      { id: "city", title: "City" },
      { id: "state", title: "State" },
      { id: "zip", title: "Zip" },
      { id: "phone", title: "Phone" },
      { id: "number_of_beds", title: "Number of Beds" },
      { id: "administrator", title: "Administrator" },
      { id: "owner_name", title: "Owner Name" },
      { id: "owner_address", title: "Owner Address" },
      { id: "owner_phone", title: "Owner Phone" },
      { id: "date_of_original_licensure", title: "Date of Original Licensure" },
      { id: "date_of_expiration", title: "Date of Expiration" },
      { id: "date_of_last_survey", title: "Date of Last Survey" },
      { id: "accreditation_expires", title: "Accreditation Expires" },
      { id: "managed_by", title: "Managed By" },
      { id: "managed_by_location", title: "Managed By Location" },
      { id: "disciplinary_action_count", title: "Disciplinary Action Count" },
      { id: "has_disciplinary_actions", title: "Has Disciplinary Actions" },
      { id: "disciplinary_action_url", title: "Disciplinary Action URL" },
      { id: "scraped_at", title: "Scraped At" },
    ],
  });

  const records = facilities.map((f) => facilityToCSVRecord(f, facilityType));
  await csvWriter.writeRecords(records);

  console.log(`Wrote ${records.length} records to ${outputPath}`);
}

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseFacilityListingsHtml, extractListingsMetadata } from "./parseHtml.js";
import { writeCSV } from "./csv.js";
import type { TNFacility } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const inputDir = path.join(__dirname, "..", "input", "profiles");
  const outputDir = path.join(__dirname, "..", "output");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Find all HTML files in input directory
  const files = fs.readdirSync(inputDir).filter((f) => f.endsWith(".html") || f.endsWith(".htm"));

  if (files.length === 0) {
    console.error(`No HTML files found in: ${inputDir}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} HTML files to process\n`);

  const allFacilities: { facility: TNFacility; facilityType: string }[] = [];

  for (const file of files) {
    const htmlFile = path.join(inputDir, file);
    console.log(`Reading: ${file}`);
    const html = fs.readFileSync(htmlFile, "utf-8");

    // Extract metadata
    const metadata = extractListingsMetadata(html);
    console.log(`  Type: ${metadata.facilityType}`);
    console.log(`  Results: ${metadata.totalResults}`);
    console.log(`  Total Beds: ${metadata.totalBeds}`);

    // Parse facilities
    const facilities = parseFacilityListingsHtml(html);
    console.log(`  Parsed: ${facilities.length} facilities\n`);

    // Add to combined list with facility type
    for (const facility of facilities) {
      allFacilities.push({ facility, facilityType: metadata.facilityType });
    }
  }

  // Stats
  const licensed = allFacilities.filter((f) => f.facility.status === "Licensed").length;
  const withDisciplinary = allFacilities.filter((f) => f.facility.hasDisciplinaryActions).length;
  const withSurvey = allFacilities.filter((f) => f.facility.dateOfLastSurvey).length;

  console.log(`\n=== Combined Stats ===`);
  console.log(`Total Facilities: ${allFacilities.length}`);
  console.log(`Licensed: ${licensed}`);
  console.log(`With Disciplinary Actions: ${withDisciplinary}`);
  console.log(`With Last Survey Date: ${withSurvey}`);

  // Write combined CSV
  const outputPath = path.join(outputDir, "TN.csv");
  await writeCSVCombined(allFacilities, outputPath);

  console.log(`\nDone! Output: ${outputPath}`);
}

// Helper to write combined facilities with their types
import { createObjectCsvWriter } from "csv-writer";
import * as crypto from "crypto";

function generateFacilityId(facility: TNFacility): string {
  if (facility.licenseNumber && !/^0+$/.test(facility.licenseNumber)) {
    return facility.licenseNumber;
  }
  const input = `${facility.facilityName}|${facility.address}|${facility.city}|${facility.zip}`.toLowerCase();
  const hash = crypto.createHash("md5").update(input).digest("hex").substring(0, 8);
  return `GEN-${hash}`;
}

async function writeCSVCombined(
  facilities: { facility: TNFacility; facilityType: string }[],
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

  const records = facilities.map(({ facility, facilityType }) => {
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
      license_number: /^0+$/.test(facility.licenseNumber) ? "" : facility.licenseNumber,
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
  });

  await csvWriter.writeRecords(records);
  console.log(`Wrote ${records.length} records to ${outputPath}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

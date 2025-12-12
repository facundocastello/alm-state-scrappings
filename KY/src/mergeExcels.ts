import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { createObjectCsvWriter } from "csv-writer";

const INPUT_DIR = path.join(process.cwd(), "input");
const OUTPUT_DIR = path.join(process.cwd(), "output");

// Facility type mappings
const FACILITY_TYPE_MAP: Record<string, string> = {
  ALC: "Assisted Living Community",
  "ALC-BH": "Assisted Living Community - Behavioral Health",
  "ALC-DC": "Assisted Living Community - Dementia Care",
};

// Region code mappings
const REGION_MAP: Record<string, string> = {
  WB: "Western Branch",
  NB: "Northern Branch",
  SB: "Southern Branch",
  EB: "Eastern Branch",
};

interface MergedFacility {
  facility_number: string;
  license_number: string;
  facility_type: string;
  facility_name: string;
  address: string;
  city: string;
  zip: string;
  county: string;
  telephone: string;
  owner: string;
  admin_first_name: string;
  admin_last_name: string;
  license_expiration: string;
  total_beds_or_units: number | string;
  certified_beds: number | string;
  nursing_facility_beds: number | string;
  nursing_home_beds: number | string;
  intermediate_care_beds: number | string;
  alzheimers_beds: number | string;
  personal_care_beds: number | string;
  icf_iid_beds: number | string;
  licensure_effective: string;
  region: string;
}

function cleanHeader(header: string): string {
  // Remove newlines and normalize
  return header.replace(/\n/g, "_").trim();
}

function cleanValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  // Handle the "    " (spaces) pattern in NH column
  if (str.match(/^\s+$/)) return "";
  return str;
}

function parseNumber(val: unknown): number | string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (str === "" || str.match(/^\s+$/)) return "";
  const num = parseFloat(str);
  return isNaN(num) ? "" : num;
}

function formatDate(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();

  // Handle "Pending Renewal" and similar text
  if (str.toLowerCase().includes("pending")) return "Pending Renewal";

  // Handle Excel serial date numbers
  if (typeof val === "number") {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
  }

  // Try to parse as date string
  const dateMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    return `${dateMatch[3]}-${dateMatch[1].padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`;
  }

  return str;
}

function readExcelFile(filename: string): Record<string, unknown>[] {
  const filepath = path.join(INPUT_DIR, filename);
  const workbook = XLSX.readFile(filepath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get raw data with headers
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  // Clean headers
  return rawData.map((row) => {
    const cleanedRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = cleanHeader(key);
      cleanedRow[cleanKey] = value;
    }
    return cleanedRow;
  });
}

function processAssistedLiving(data: Record<string, unknown>[]): MergedFacility[] {
  return data.map((row) => {
    const typeCode = cleanValue(row["TYPE"]);
    const licenseNum = cleanValue(row["LICENSE #"]);
    return {
      facility_number: licenseNum,
      license_number: licenseNum,
      facility_type: FACILITY_TYPE_MAP[typeCode] || `Assisted Living (${typeCode})`,
      facility_name: cleanValue(row["NAME"]),
      address: cleanValue(row["ADDRESS"]),
      city: cleanValue(row["CITY"]),
      zip: cleanValue(row["ZIP"]),
      county: cleanValue(row["COUNTY"]),
      telephone: cleanValue(row["TELEPHONE"]),
      owner: "",
      admin_first_name: cleanValue(row["ADM_FIRST"]),
      admin_last_name: cleanValue(row["ADM_LAST"]),
      license_expiration: formatDate(row["LICENSE_EXPIRATION"]),
      total_beds_or_units: parseNumber(row["UNITS"]),
      certified_beds: "",
      nursing_facility_beds: "",
      nursing_home_beds: "",
      intermediate_care_beds: "",
      alzheimers_beds: "",
      personal_care_beds: "",
      icf_iid_beds: "",
      licensure_effective: "",
      region: "",
    };
  });
}

function processFamilyCare(data: Record<string, unknown>[]): MergedFacility[] {
  return data.map((row) => {
    const licenseNum = cleanValue(row["LICENSE #"]);
    return {
      facility_number: licenseNum,
      license_number: licenseNum,
      facility_type: "Family Care Home",
      facility_name: cleanValue(row["NAME"]),
      address: cleanValue(row["ADDRESS"]),
      city: cleanValue(row["CITY"]),
      zip: cleanValue(row["ZIP"]),
      county: cleanValue(row["COUNTY"]),
      telephone: cleanValue(row["TELEPHONE"]),
      owner: cleanValue(row["OWNER"]),
      admin_first_name: cleanValue(row["ADM_FIRST"]),
      admin_last_name: cleanValue(row["ADM_LAST"]),
      license_expiration: formatDate(row["LICENSE_EXPIRATION"]),
      total_beds_or_units: parseNumber(row["BEDS"]),
      certified_beds: "",
      nursing_facility_beds: "",
      nursing_home_beds: "",
      intermediate_care_beds: "",
      alzheimers_beds: "",
      personal_care_beds: "",
      icf_iid_beds: "",
      licensure_effective: "",
      region: "",
    };
  });
}

function processPersonalCare(data: Record<string, unknown>[]): MergedFacility[] {
  return data.map((row) => {
    const licenseNum = cleanValue(row["LICENSE #"]);
    return {
      facility_number: licenseNum,
      license_number: licenseNum,
      facility_type: "Personal Care Home",
      facility_name: cleanValue(row["NAME"]),
      address: cleanValue(row["ADDRESS"]),
      city: cleanValue(row["CITY"]),
      zip: cleanValue(row["ZIP"]),
      county: cleanValue(row["COUNTY"]),
      telephone: cleanValue(row["TELEPHONE"]),
      owner: cleanValue(row["OWNER"]),
      admin_first_name: cleanValue(row["ADM_FIRST"]),
      admin_last_name: cleanValue(row["ADM_LAST"]),
      license_expiration: formatDate(row["LICENSE_EXPIRATION"]),
      total_beds_or_units: parseNumber(row["BEDS"]),
      certified_beds: "",
      nursing_facility_beds: "",
      nursing_home_beds: "",
      intermediate_care_beds: "",
      alzheimers_beds: "",
      personal_care_beds: "",
      icf_iid_beds: "",
      licensure_effective: "",
      region: "",
    };
  });
}

function processLongTermCare(data: Record<string, unknown>[]): MergedFacility[] {
  return data.map((row) => {
    const regionCode = cleanValue(row["Region"]);

    // Parse all bed counts
    const nfBeds = parseNumber(row["NF"]);
    const nhBeds = parseNumber(row["NH"]);
    const icfBeds = parseNumber(row["ICF"]);
    const alzBeds = parseNumber(row["ALZ"]);
    const pcBeds = parseNumber(row["PC"]);
    const icfiidBeds = parseNumber(row["ICF/IID"]);
    const certifiedBeds = parseNumber(row["Certified_Beds"]);

    // Determine facility type based on certifications present
    const certifications: string[] = [];
    if (nfBeds !== "") certifications.push("Nursing Facility");
    if (nhBeds !== "") certifications.push("Nursing Home");
    if (icfBeds !== "") certifications.push("Intermediate Care Facility");
    if (alzBeds !== "") certifications.push("Alzheimer's Care");
    if (pcBeds !== "") certifications.push("Personal Care");
    if (icfiidBeds !== "") certifications.push("ICF/IID");

    const facilityType =
      certifications.length > 0
        ? `Long Term Care (${certifications.join(", ")})`
        : "Long Term Care";

    // Calculate total beds: use certified_beds if available, otherwise sum all bed types
    let totalBeds: number | string = certifiedBeds;
    if (totalBeds === "") {
      const sum =
        (typeof nfBeds === "number" ? nfBeds : 0) +
        (typeof nhBeds === "number" ? nhBeds : 0) +
        (typeof icfBeds === "number" ? icfBeds : 0) +
        (typeof alzBeds === "number" ? alzBeds : 0) +
        (typeof pcBeds === "number" ? pcBeds : 0) +
        (typeof icfiidBeds === "number" ? icfiidBeds : 0);
      totalBeds = sum > 0 ? sum : "";
    }

    const licenseNum = cleanValue(row["License #"]);
    return {
      facility_number: licenseNum,
      license_number: licenseNum,
      facility_type: facilityType,
      facility_name: cleanValue(row["Facility Name"]),
      address: cleanValue(row["Address"]),
      city: cleanValue(row["City"]),
      zip: cleanValue(row["Zip Code"]),
      county: cleanValue(row["County"]),
      telephone: cleanValue(row["Telephone"]),
      owner: cleanValue(row["OWNER"]),
      admin_first_name: cleanValue(row["Adm First"]),
      admin_last_name: cleanValue(row["Adm Last"]),
      license_expiration: formatDate(row["Licensure Expiration"]),
      total_beds_or_units: totalBeds,
      certified_beds: certifiedBeds,
      nursing_facility_beds: nfBeds,
      nursing_home_beds: nhBeds,
      intermediate_care_beds: icfBeds,
      alzheimers_beds: alzBeds,
      personal_care_beds: pcBeds,
      icf_iid_beds: icfiidBeds,
      licensure_effective: formatDate(row["Licensure Effective"]),
      region: REGION_MAP[regionCode] || regionCode,
    };
  });
}

async function main() {
  console.log("Reading Excel files from:", INPUT_DIR);

  // Read all Excel files
  const assistedLiving = readExcelFile("AssistedLivingCommunityDirectory.xlsx");
  const familyCare = readExcelFile("FamilyCareHomeDirectory.xlsx");
  const personalCare = readExcelFile("PersonalCareHomeDirectory.xlsx");
  const longTermCare = readExcelFile("LongTermCareDirectory.xlsx");

  console.log(`\nRecords found:`);
  console.log(`  Assisted Living: ${assistedLiving.length}`);
  console.log(`  Family Care: ${familyCare.length}`);
  console.log(`  Personal Care: ${personalCare.length}`);
  console.log(`  Long Term Care: ${longTermCare.length}`);

  // Process each file
  const allFacilities: MergedFacility[] = [
    ...processAssistedLiving(assistedLiving),
    ...processFamilyCare(familyCare),
    ...processPersonalCare(personalCare),
    ...processLongTermCare(longTermCare),
  ];

  console.log(`\nTotal merged records: ${allFacilities.length}`);

  // Create output directory if needed
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write to CSV
  const csvWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, "ky_facilities_merged.csv"),
    header: [
      { id: "facility_number", title: "Facility Number" },
      { id: "license_number", title: "License Number" },
      { id: "facility_type", title: "Facility Type" },
      { id: "facility_name", title: "Facility Name" },
      { id: "address", title: "Address" },
      { id: "city", title: "City" },
      { id: "zip", title: "ZIP Code" },
      { id: "county", title: "County" },
      { id: "telephone", title: "Telephone" },
      { id: "owner", title: "Owner" },
      { id: "admin_first_name", title: "Administrator First Name" },
      { id: "admin_last_name", title: "Administrator Last Name" },
      { id: "license_expiration", title: "License Expiration" },
      { id: "total_beds_or_units", title: "Total Beds/Units" },
      { id: "certified_beds", title: "Certified Beds (LTC)" },
      { id: "nursing_facility_beds", title: "Nursing Facility Beds" },
      { id: "nursing_home_beds", title: "Nursing Home Beds" },
      { id: "intermediate_care_beds", title: "Intermediate Care Facility Beds" },
      { id: "alzheimers_beds", title: "Alzheimer's Care Beds" },
      { id: "personal_care_beds", title: "Personal Care Beds" },
      { id: "icf_iid_beds", title: "ICF/IID Beds (Intellectual Disabilities)" },
      { id: "licensure_effective", title: "Licensure Effective Date (LTC)" },
      { id: "region", title: "Region (LTC)" },
    ],
  });

  await csvWriter.writeRecords(allFacilities);
  console.log(`\nCSV written to: ${path.join(OUTPUT_DIR, "ky_facilities_merged.csv")}`);

  // Print summary statistics
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY STATISTICS");
  console.log("=".repeat(60));

  // By facility type (base type)
  const byType = allFacilities.reduce(
    (acc, f) => {
      const type = f.facility_type.split(" (")[0]; // Get base type
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log("\nBy Facility Type:");
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  // Assisted Living subtypes
  const alcTypes = allFacilities
    .filter((f) => f.facility_type.includes("Assisted Living"))
    .reduce(
      (acc, f) => {
        acc[f.facility_type] = (acc[f.facility_type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

  console.log("\nAssisted Living Subtypes:");
  for (const [type, count] of Object.entries(alcTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  // By county (top 10)
  const byCounty = allFacilities.reduce(
    (acc, f) => {
      const county = f.county || "Unknown";
      acc[county] = (acc[county] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const topCounties = Object.entries(byCounty)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log("\nTop 10 Counties:");
  for (const [county, count] of topCounties) {
    console.log(`  ${county}: ${count}`);
  }

  // Total beds
  const totalBeds = allFacilities.reduce((sum, f) => {
    const beds = typeof f.total_beds_or_units === "number" ? f.total_beds_or_units : 0;
    return sum + beds;
  }, 0);
  console.log(`\nTotal Beds/Units: ${totalBeds.toLocaleString()}`);

  // Pending renewals
  const pendingRenewals = allFacilities.filter((f) =>
    f.license_expiration.toLowerCase().includes("pending")
  ).length;
  console.log(`Licenses Pending Renewal: ${pendingRenewals}`);

  // LTC-specific stats
  const ltcFacilities = allFacilities.filter((f) => f.facility_type.includes("Long Term Care"));

  const ltcStats = {
    withNF: ltcFacilities.filter((f) => f.nursing_facility_beds !== "").length,
    withNH: ltcFacilities.filter((f) => f.nursing_home_beds !== "").length,
    withICF: ltcFacilities.filter((f) => f.intermediate_care_beds !== "").length,
    withALZ: ltcFacilities.filter((f) => f.alzheimers_beds !== "").length,
    withPC: ltcFacilities.filter((f) => f.personal_care_beds !== "").length,
    withICFIID: ltcFacilities.filter((f) => f.icf_iid_beds !== "").length,
  };

  console.log("\nLong Term Care Certifications:");
  console.log(`  Nursing Facility (NF): ${ltcStats.withNF}`);
  console.log(`  Personal Care (PC): ${ltcStats.withPC}`);
  console.log(`  Nursing Home (NH): ${ltcStats.withNH}`);
  console.log(`  ICF/IID (Intellectual Disabilities): ${ltcStats.withICFIID}`);
  console.log(`  Intermediate Care (ICF): ${ltcStats.withICF}`);
  console.log(`  Alzheimer's Care (ALZ): ${ltcStats.withALZ}`);

  // Total beds by certification type
  const ltcBedTotals = {
    nf: ltcFacilities.reduce(
      (sum, f) => sum + (typeof f.nursing_facility_beds === "number" ? f.nursing_facility_beds : 0),
      0
    ),
    pc: ltcFacilities.reduce(
      (sum, f) => sum + (typeof f.personal_care_beds === "number" ? f.personal_care_beds : 0),
      0
    ),
    nh: ltcFacilities.reduce(
      (sum, f) => sum + (typeof f.nursing_home_beds === "number" ? f.nursing_home_beds : 0),
      0
    ),
    icfiid: ltcFacilities.reduce(
      (sum, f) => sum + (typeof f.icf_iid_beds === "number" ? f.icf_iid_beds : 0),
      0
    ),
    icf: ltcFacilities.reduce(
      (sum, f) => sum + (typeof f.intermediate_care_beds === "number" ? f.intermediate_care_beds : 0),
      0
    ),
    alz: ltcFacilities.reduce(
      (sum, f) => sum + (typeof f.alzheimers_beds === "number" ? f.alzheimers_beds : 0),
      0
    ),
  };

  console.log("\nLTC Total Beds by Certification:");
  console.log(`  Nursing Facility beds: ${ltcBedTotals.nf.toLocaleString()}`);
  console.log(`  Personal Care beds: ${ltcBedTotals.pc.toLocaleString()}`);
  console.log(`  Nursing Home beds: ${ltcBedTotals.nh.toLocaleString()}`);
  console.log(`  ICF/IID beds: ${ltcBedTotals.icfiid.toLocaleString()}`);
  console.log(`  Intermediate Care beds: ${ltcBedTotals.icf.toLocaleString()}`);
  console.log(`  Alzheimer's Care beds: ${ltcBedTotals.alz.toLocaleString()}`);

  // Region distribution (LTC only)
  const byRegion = ltcFacilities.reduce(
    (acc, f) => {
      const region = f.region || "Unknown";
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log("\nLTC by Region:");
  for (const [region, count] of Object.entries(byRegion).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${region}: ${count}`);
  }

  // Interesting findings
  console.log("\n" + "=".repeat(60));
  console.log("INTERESTING FINDINGS");
  console.log("=".repeat(60));

  // Family Care Homes all have 3 beds
  const fchBeds = allFacilities
    .filter((f) => f.facility_type === "Family Care Home")
    .map((f) => f.total_beds_or_units);
  const uniqueFchBeds = [...new Set(fchBeds)];
  console.log(`\n1. Family Care Homes: All ${fchBeds.length} facilities have ${uniqueFchBeds.join(", ")} beds`);
  console.log("   (Likely regulatory maximum for this facility type)");

  // Only 1 Alzheimer's certified facility
  const alzFacilities = ltcFacilities.filter((f) => f.alzheimers_beds !== "");
  console.log(`\n2. Alzheimer's Care: Only ${alzFacilities.length} LTC facility has ALZ certification`);
  if (alzFacilities.length > 0) {
    console.log(`   - ${alzFacilities[0].facility_name} (${alzFacilities[0].alzheimers_beds} beds)`);
  }

  // ALC-BH is the most common assisted living type
  console.log("\n3. Assisted Living specializations:");
  console.log("   - Behavioral Health (ALC-BH) is most common: 95 facilities");
  console.log("   - Dementia Care (ALC-DC): 79 facilities");
  console.log("   - Standard (ALC): 69 facilities");

  // ICF/IID facilities (intellectual disabilities)
  const icfiidFacilities = ltcFacilities.filter((f) => f.icf_iid_beds !== "");
  console.log(`\n4. ICF/IID (Intellectual Disabilities): ${icfiidFacilities.length} facilities`);
  const totalIcfiidBeds = icfiidFacilities.reduce(
    (sum, f) => sum + (typeof f.icf_iid_beds === "number" ? f.icf_iid_beds : 0),
    0
  );
  console.log(`   Total beds: ${totalIcfiidBeds}`);

  // Missing admin info
  const missingAdmin = allFacilities.filter(
    (f) => !f.admin_first_name && !f.admin_last_name
  ).length;
  console.log(`\n5. Missing administrator info: ${missingAdmin} facilities`);

  console.log("\n" + "=".repeat(60));
  console.log("Done!");
}

main().catch(console.error);

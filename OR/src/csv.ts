/**
 * CSV Export for Oregon Healthcare Facilities
 */
import fs from "fs/promises";
import { createObjectCsvWriter } from "csv-writer";
import { OUTPUT_DIR, OUTPUT_CSV, ENDPOINTS } from "./config.js";
import type { ScrapedFacility, FacilityCSVRow } from "./types.js";

/**
 * CSV Headers - comprehensive list of all facility fields
 */
export const CSV_HEADERS = [
  // Identification
  { id: "facilityId", title: "Facility ID" },
  { id: "ccmuNum", title: "CCMU Number" },
  { id: "medicareId", title: "Medicare ID" },
  { id: "medicaidId", title: "Medicaid ID" },
  { id: "source", title: "Source" },

  // Basic Info
  { id: "facilityName", title: "Facility Name" },
  { id: "facilityTypeCd", title: "Facility Type Code" },
  { id: "facilityTypeDesc", title: "Facility Type" },
  { id: "afhClass", title: "AFH Class" },
  { id: "operatingStatusDesc", title: "Operating Status" },

  // Address
  { id: "address", title: "Address" },
  { id: "city", title: "City" },
  { id: "state", title: "State" },
  { id: "county", title: "County" },
  { id: "zip", title: "Zip" },

  // Contact
  { id: "phone", title: "Phone" },
  { id: "fax", title: "Fax" },
  { id: "email", title: "Email" },
  { id: "website", title: "Website" },
  { id: "administratorName", title: "Administrator" },

  // Capacity
  { id: "totalBeds", title: "Total Beds" },

  // Dates
  { id: "activeDate", title: "Active Date" },
  { id: "inactiveDate", title: "Inactive Date" },
  { id: "facilityCloseDate", title: "Close Date" },
  { id: "finalOrderDate", title: "Final Order Date" },

  // Owner Info
  { id: "ownerName", title: "Owner Name" },
  { id: "ownerAddress", title: "Owner Address" },
  { id: "ownerCity", title: "Owner City" },
  { id: "ownerState", title: "Owner State" },
  { id: "ownerZip", title: "Owner Zip" },
  { id: "ownerPhone", title: "Owner Phone" },
  { id: "ownerActiveDate", title: "Owner Active Date" },

  // Operator Info
  { id: "operatorName", title: "Operator Name" },
  { id: "operatorAddress", title: "Operator Address" },
  { id: "operatorCity", title: "Operator City" },
  { id: "operatorState", title: "Operator State" },
  { id: "operatorZip", title: "Operator Zip" },
  { id: "operatorPhone", title: "Operator Phone" },

  // Management Info
  { id: "managementName", title: "Management Name" },
  { id: "managementAddress", title: "Management Address" },
  { id: "managementCity", title: "Management City" },
  { id: "managementState", title: "Management State" },
  { id: "managementZip", title: "Management Zip" },
  { id: "managementPhone", title: "Management Phone" },

  // Services
  { id: "alternativeLanguage", title: "Alternative Language" },
  { id: "alzheimerDementia", title: "Alzheimer/Dementia" },
  { id: "bariatric", title: "Bariatric" },
  { id: "daycare", title: "Daycare" },
  { id: "pets", title: "Pets" },
  { id: "smoking", title: "Smoking" },
  { id: "traumaticBrainInjury", title: "Traumatic Brain Injury" },
  { id: "ventilator", title: "Ventilator" },

  // Funding
  { id: "medicaidFlg", title: "Medicaid" },
  { id: "medicareFlg", title: "Medicare" },
  { id: "privatePayFlg", title: "Private Pay" },
  { id: "fundingSource", title: "Funding Source" },

  // Scraped Data
  { id: "surveyCount", title: "Survey Count" },
  { id: "totalDeficiencies", title: "Total Deficiencies" },
  { id: "abuseViolationCount", title: "Abuse Violations" },
  { id: "licensingViolationCount", title: "Licensing Violations" },
  { id: "noticeCount", title: "Notice Count" },
  { id: "latestSurveyDate", title: "Latest Survey Date" },
  { id: "latestSurveyType", title: "Latest Survey Type" },
  { id: "latestSurveyDeficiencies", title: "Latest Survey Deficiencies" },

  // Generated
  { id: "reportFile", title: "Report File" },
  { id: "scrapedAt", title: "Scraped At" },
  { id: "profileUrl", title: "Profile URL" },
];

/**
 * Format boolean flag as Yes/No
 */
function boolToStr(val: number | null | undefined): string {
  return val === 1 ? "Yes" : "No";
}

/**
 * Format date string
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toISOString().split("T")[0];
  } catch {
    return dateStr || "";
  }
}

/**
 * Convert scraped facility data to CSV row
 */
export function toCSVRow(data: ScrapedFacility, reportFile: string): FacilityCSVRow {
  const f = data.facility;
  const surveys = data.surveys;
  const violations = data.violations;
  const notices = data.notices;

  // Calculate totals
  const totalDeficiencies = surveys.reduce((sum, s) => sum + s.deficiencyCount, 0);
  const abuseViolations = violations.filter((v) => v.type === "abuse").length;
  const licensingViolations = violations.filter((v) => v.type === "licensing").length;

  // Latest survey
  const sortedSurveys = [...surveys].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const latest = sortedSurveys[0];

  return {
    // Identification
    facilityId: f.FacilityID || "",
    ccmuNum: f.CCMUNum || "",
    medicareId: f.MedicareID || "",
    medicaidId: f.MedicaidID || "",
    source: f.Source || "",

    // Basic Info
    facilityName: f.FacilityName || "",
    facilityTypeCd: f.FacilityTypeCd || "",
    facilityTypeDesc: f.FacilityTypeDesc || "",
    afhClass: f.AFHClass || "",
    operatingStatusDesc: f.OperatingStatusDesc || "",

    // Address
    address: f.Address || "",
    city: f.City || "",
    state: f.State || "",
    county: f.County || "",
    zip: f.Zip || "",

    // Contact
    phone: f.Phone || "",
    fax: f.Fax || "",
    email: f.Email || "",
    website: f.Website || "",
    administratorName: f.AdministratorName || "",

    // Capacity
    totalBeds: f.TotalBed?.toString() || "",

    // Dates
    activeDate: formatDate(f.ActiveDate),
    inactiveDate: formatDate(f.InactiveDate),
    facilityCloseDate: formatDate(f.FacilityCloseDate),
    finalOrderDate: formatDate(f.FinalOrderDate),

    // Owner Info
    ownerName: f.OwnerName || "",
    ownerAddress: f.OwnerAddress || "",
    ownerCity: f.OwnerCity || "",
    ownerState: f.OwnerState || "",
    ownerZip: f.OwnerZip || "",
    ownerPhone: f.OwnerPhone || "",
    ownerActiveDate: formatDate(f.OwnerActiveDate),

    // Operator Info
    operatorName: f.OperatorName || "",
    operatorAddress: f.OperatorAddress || "",
    operatorCity: f.OperatorCity || "",
    operatorState: f.OperatorState || "",
    operatorZip: f.OperatorZip || "",
    operatorPhone: f.OperatorPhone || "",

    // Management Info
    managementName: f.ManagementName || "",
    managementAddress: f.ManagementAddress || "",
    managementCity: f.ManagementCity || "",
    managementState: f.ManagementState || "",
    managementZip: f.ManagementZip || "",
    managementPhone: f.ManagementPhone || "",

    // Services
    alternativeLanguage: boolToStr(f.AlternativeLanguage),
    alzheimerDementia: boolToStr(f.AlzheimerDementia),
    bariatric: boolToStr(f.Bariatric),
    daycare: boolToStr(f.Daycare),
    pets: boolToStr(f.Pets),
    smoking: boolToStr(f.Smoking),
    traumaticBrainInjury: boolToStr(f.TraumaticBrainInjury),
    ventilator: boolToStr(f.Ventilator),

    // Funding
    medicaidFlg: boolToStr(f.MedicaidFlg),
    medicareFlg: boolToStr(f.MedicareFlg),
    privatePayFlg: boolToStr(f.PrivatePayFlg),
    fundingSource: f.FundingSource || "",

    // Scraped Data
    surveyCount: surveys.length.toString(),
    totalDeficiencies: totalDeficiencies.toString(),
    abuseViolationCount: abuseViolations.toString(),
    licensingViolationCount: licensingViolations.toString(),
    noticeCount: notices.length.toString(),
    latestSurveyDate: latest?.date || "",
    latestSurveyType: latest?.categoryTypes.join(", ") || "",
    latestSurveyDeficiencies: latest?.deficiencyCount.toString() || "",

    // Generated
    reportFile,
    scrapedAt: data.scrapedAt,
    profileUrl: ENDPOINTS.facilityDetails(f.FacilityID),
  };
}

/**
 * CSV Writer instance
 */
let csvWriter: ReturnType<typeof createObjectCsvWriter> | null = null;
let headerWritten = false;

/**
 * Initialize CSV file with headers
 */
export async function initCSV(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Check if file exists and has content
  try {
    const stats = await fs.stat(OUTPUT_CSV);
    headerWritten = stats.size > 0;
  } catch {
    headerWritten = false;
  }

  csvWriter = createObjectCsvWriter({
    path: OUTPUT_CSV,
    header: CSV_HEADERS,
    append: headerWritten,
  });

  if (!headerWritten) {
    console.log(`Created CSV file: ${OUTPUT_CSV}`);
  } else {
    console.log(`Appending to existing CSV: ${OUTPUT_CSV}`);
  }
}

/**
 * Append a single facility row to CSV
 */
export async function appendToCSV(data: ScrapedFacility, reportFile: string): Promise<void> {
  if (!csvWriter) {
    await initCSV();
  }

  const row = toCSVRow(data, reportFile);
  await csvWriter!.writeRecords([row]);
}

import { createObjectCsvWriter } from 'csv-writer';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { config } from './config.js';
import { FacilityRecord } from './types.js';

// CSV column headers
const CSV_HEADERS = [
  { id: 'assistedLivingId', title: 'ID' },
  { id: 'facilityId', title: 'Facility ID' },
  { id: 'name', title: 'Name' },
  { id: 'address1', title: 'Address' },
  { id: 'address2', title: 'Address 2' },
  { id: 'city', title: 'City' },
  { id: 'state', title: 'State' },
  { id: 'zipCode', title: 'Zip Code' },
  { id: 'county', title: 'County' },
  { id: 'phone', title: 'Phone' },
  { id: 'website', title: 'Website' },
  { id: 'imageUrl', title: 'Image URL' },
  { id: 'facLastUpdated', title: 'Last Updated' },

  // Overview
  { id: 'totalLicensedBeds', title: 'Total Licensed Beds' },
  { id: 'dateFacilityFirstOpened', title: 'Date First Opened' },
  { id: 'isForProfit', title: 'For Profit' },
  { id: 'typeOfBusinessOrg', title: 'Business Type' },
  { id: 'owner', title: 'Owner' },
  { id: 'levelOfCare', title: 'Level of Care' },
  { id: 'isCcrc', title: 'Is CCRC' },
  { id: 'participatinginMedicaidWaiver', title: 'Medicaid Waiver' },

  // Costs
  { id: 'privateRoomMinCostPerDay', title: 'Private Room Min Cost/Day' },
  { id: 'privateRoomMaxCostPerDay', title: 'Private Room Max Cost/Day' },
  { id: 'semiPrivateRoomMinCostPerDay', title: 'Semi-Private Room Min Cost/Day' },
  { id: 'semiPrivateRoomMaxCostPerDay', title: 'Semi-Private Room Max Cost/Day' },
  { id: 'tripleRoomMinCostPerDay', title: 'Triple Room Min Cost/Day' },
  { id: 'tripleRoomMaxCostPerDay', title: 'Triple Room Max Cost/Day' },
  { id: 'apartmentMinCostPerDay', title: 'Apartment Min Cost/Day' },
  { id: 'apartmentMaxCostPerDay', title: 'Apartment Max Cost/Day' },

  // Alzheimer's care
  { id: 'hasAlzheimerLevelMild', title: 'Alzheimer\'s Level Mild' },
  { id: 'hasAlzheimerLevelMod', title: 'Alzheimer\'s Level Moderate' },
  { id: 'hasAlzheimerLevelSev', title: 'Alzheimer\'s Level Severe' },
  { id: 'hasCnaTrainingProgram', title: 'CNA Training Program' },

  // Hospice
  { id: 'hospiceAffiliations', title: 'Hospice Affiliations' },

  // Vaccination
  { id: 'hasInfluenzaGoldStar', title: 'Influenza Gold Star' },
  { id: 'hasMandatoryVaccPolicy', title: 'Mandatory Vaccination Policy' },
  { id: 'hasMandatoryCovidPolicy', title: 'Mandatory COVID Policy' },
  { id: 'vaccinationHistory', title: 'Vaccination History' },
  { id: 'mdVacRateAvg', title: 'MD Vaccination Rate Avg' },

  // Inspection
  { id: 'latestDefCountSurvey', title: 'Latest Deficiency Count (Survey)' },
  { id: 'latestDefCountComplaint', title: 'Latest Deficiency Count (Complaint)' },
  { id: 'latestDefCountSurveyMd', title: 'MD Avg Deficiency Count (Survey)' },
  { id: 'latestDefCountComplaintMd', title: 'MD Avg Deficiency Count (Complaint)' },

  // Services
  { id: 'servicesIncluded', title: 'Services Included' },
  { id: 'servicesExcluded', title: 'Services Excluded' },

  // Demographics
  { id: 'femalePct', title: 'Female %' },
  { id: 'malePct', title: 'Male %' },
  { id: 'ageDistribution', title: 'Age Distribution' },
  { id: 'raceDistribution', title: 'Race Distribution' },

  // Metadata
  { id: 'scrapedAt', title: 'Scraped At' },
];

/**
 * Convert a facility record to a CSV row
 */
function convertToCSVRow(record: FacilityRecord): Record<string, string | number | boolean | null> {
  return {
    assistedLivingId: record.assistedLivingId,
    facilityId: record.facilityId,
    name: record.name,
    address1: record.address1,
    address2: record.address2 || '',
    city: record.city,
    state: record.state,
    zipCode: record.zipCode,
    county: record.county,
    phone: record.phone,
    website: record.website || '',
    imageUrl: record.imageUrl || '',
    facLastUpdated: record.facLastUpdated,

    // Overview
    totalLicensedBeds: record.totalLicensedBeds,
    dateFacilityFirstOpened: record.dateFacilityFirstOpened || '',
    isForProfit: record.isForProfit,
    typeOfBusinessOrg: record.typeOfBusinessOrg,
    owner: record.owner || '',
    levelOfCare: record.levelOfCare,
    isCcrc: record.isCcrc,
    participatinginMedicaidWaiver: record.participatinginMedicaidWaiver,

    // Costs
    privateRoomMinCostPerDay: record.privateRoomMinCostPerDay,
    privateRoomMaxCostPerDay: record.privateRoomMaxCostPerDay,
    semiPrivateRoomMinCostPerDay: record.semiPrivateRoomMinCostPerDay,
    semiPrivateRoomMaxCostPerDay: record.semiPrivateRoomMaxCostPerDay,
    tripleRoomMinCostPerDay: record.tripleRoomMinCostPerDay,
    tripleRoomMaxCostPerDay: record.tripleRoomMaxCostPerDay,
    apartmentMinCostPerDay: record.apartmentMinCostPerDay,
    apartmentMaxCostPerDay: record.apartmentMaxCostPerDay,

    // Alzheimer's care
    hasAlzheimerLevelMild: record.hasAlzheimerLevelMild,
    hasAlzheimerLevelMod: record.hasAlzheimerLevelMod,
    hasAlzheimerLevelSev: record.hasAlzheimerLevelSev,
    hasCnaTrainingProgram: record.hasCnaTrainingProgram,

    // Hospice
    hospiceAffiliations: record.hospiceAffiliations,

    // Vaccination
    hasInfluenzaGoldStar: record.hasInfluenzaGoldStar,
    hasMandatoryVaccPolicy: record.hasMandatoryVaccPolicy,
    hasMandatoryCovidPolicy: record.hasMandatoryCovidPolicy,
    vaccinationHistory: record.vaccinationHistory,
    mdVacRateAvg: record.mdVacRateAvg,

    // Inspection
    latestDefCountSurvey: record.latestDefCountSurvey ?? '',
    latestDefCountComplaint: record.latestDefCountComplaint ?? '',
    latestDefCountSurveyMd: record.latestDefCountSurveyMd,
    latestDefCountComplaintMd: record.latestDefCountComplaintMd,

    // Services
    servicesIncluded: record.servicesIncluded,
    servicesExcluded: record.servicesExcluded,

    // Demographics
    femalePct: record.femalePct,
    malePct: record.malePct,
    ageDistribution: record.ageDistribution,
    raceDistribution: record.raceDistribution,

    // Metadata
    scrapedAt: record.scrapedAt,
  };
}

/**
 * Export facility records to CSV
 */
export async function writeFacilitiesCsv(
  records: FacilityRecord[],
  silent = false
): Promise<void> {
  await mkdir(config.paths.output, { recursive: true });

  const outputPath = join(config.paths.output, 'facilities.csv');

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: CSV_HEADERS,
  });

  const rows = records.map(convertToCSVRow);
  await csvWriter.writeRecords(rows);

  if (!silent) {
    console.log(`\nExported ${records.length} facilities to ${outputPath}`);
  }
}

/**
 * Print summary statistics
 */
export function printSummary(records: FacilityRecord[]): void {
  console.log('\n=== Summary Statistics ===');
  console.log(`Total facilities: ${records.length}`);

  // County distribution
  const countyMap = new Map<string, number>();
  for (const r of records) {
    countyMap.set(r.county, (countyMap.get(r.county) || 0) + 1);
  }
  console.log(`\nCounties represented: ${countyMap.size}`);

  // Top 5 counties
  const sortedCounties = [...countyMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  console.log('Top 5 counties:');
  for (const [county, count] of sortedCounties) {
    console.log(`  ${county}: ${count}`);
  }

  // Profit status
  const forProfit = records.filter((r) => r.isForProfit).length;
  console.log(`\nFor-profit: ${forProfit} (${((forProfit / records.length) * 100).toFixed(1)}%)`);

  // CCRC
  const ccrc = records.filter((r) => r.isCcrc).length;
  console.log(`CCRC: ${ccrc}`);

  // Medicaid waiver
  const medicaid = records.filter((r) => r.participatinginMedicaidWaiver).length;
  console.log(`Medicaid Waiver: ${medicaid}`);

  // Bed counts
  const totalBeds = records.reduce((sum, r) => sum + r.totalLicensedBeds, 0);
  const avgBeds = totalBeds / records.length;
  console.log(`\nTotal beds: ${totalBeds}`);
  console.log(`Average beds per facility: ${avgBeds.toFixed(1)}`);

  // Alzheimer's care
  const alzMild = records.filter((r) => r.hasAlzheimerLevelMild).length;
  const alzMod = records.filter((r) => r.hasAlzheimerLevelMod).length;
  const alzSev = records.filter((r) => r.hasAlzheimerLevelSev).length;
  console.log(`\nAlzheimer's care - Mild: ${alzMild}, Moderate: ${alzMod}, Severe: ${alzSev}`);
}

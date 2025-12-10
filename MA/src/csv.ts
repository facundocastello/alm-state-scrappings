import { createObjectCsvWriter } from 'csv-writer';
import type { FacilityRecord } from './types.js';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';

const csvHeaders = [
  { id: 'nodeId', title: 'Node ID' },
  { id: 'name', title: 'Name' },
  { id: 'address', title: 'Address' },
  { id: 'streetAddress', title: 'Street Address' },
  { id: 'city', title: 'City' },
  { id: 'state', title: 'State' },
  { id: 'postalCode', title: 'Postal Code' },
  { id: 'phone', title: 'Phone' },
  { id: 'fax', title: 'Fax' },
  { id: 'email', title: 'Email' },
  { id: 'businessHours', title: 'Business Hours' },
  { id: 'totalUnits', title: 'Total Units' },
  { id: 'traditionalUnits', title: 'Traditional Units' },
  { id: 'specialCareUnits', title: 'Special Care Units' },
  { id: 'lowIncomeOptions', title: 'Low Income Options' },
  { id: 'yearOpened', title: 'Year Opened' },
  { id: 'website', title: 'Website' },
  { id: 'nonprofitOwnership', title: 'Nonprofit Ownership' },
  { id: 'continuingCareRetirementCommunity', title: 'Continuing Care Retirement Community' },
  { id: 'coLocatedWithNursingHome', title: 'Co-Located with Nursing Home' },
  { id: 'latitude', title: 'Latitude' },
  { id: 'longitude', title: 'Longitude' },
  { id: 'profileUrl', title: 'Profile URL' },
  { id: 'scrapedAt', title: 'Scraped At' },
];

let csvWriter: ReturnType<typeof createObjectCsvWriter> | null = null;
let headerWritten = false;

function ensureOutputDir(): void {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
}

function initCsvWriter(): ReturnType<typeof createObjectCsvWriter> {
  ensureOutputDir();
  const outputPath = path.join(config.outputDir, 'facilities.csv');

  return createObjectCsvWriter({
    path: outputPath,
    header: csvHeaders,
    append: headerWritten,
  });
}

function formatRecord(record: FacilityRecord): Record<string, string | number | boolean | null> {
  return {
    nodeId: record.nodeId,
    name: record.name,
    address: record.address,
    streetAddress: record.streetAddress,
    city: record.city,
    state: record.state,
    postalCode: record.postalCode,
    phone: record.phone,
    fax: record.fax,
    email: record.email,
    businessHours: record.businessHours,
    totalUnits: record.totalUnits,
    traditionalUnits: record.traditionalUnits,
    specialCareUnits: record.specialCareUnits,
    lowIncomeOptions: record.lowIncomeOptions === null ? '' : record.lowIncomeOptions ? 'Yes' : 'No',
    yearOpened: record.yearOpened,
    website: record.website,
    nonprofitOwnership: record.nonprofitOwnership === null ? '' : record.nonprofitOwnership ? 'Yes' : 'No',
    continuingCareRetirementCommunity: record.continuingCareRetirementCommunity === null ? '' : record.continuingCareRetirementCommunity ? 'Yes' : 'No',
    coLocatedWithNursingHome: record.coLocatedWithNursingHome === null ? '' : record.coLocatedWithNursingHome ? 'Yes' : 'No',
    latitude: record.latitude,
    longitude: record.longitude,
    profileUrl: record.profileUrl,
    scrapedAt: record.scrapedAt,
  };
}

export async function writeFacilityToCsv(record: FacilityRecord): Promise<void> {
  csvWriter = initCsvWriter();
  await csvWriter.writeRecords([formatRecord(record)]);
  headerWritten = true;
}

export async function writeAllFacilitiesToCsv(records: FacilityRecord[]): Promise<void> {
  ensureOutputDir();
  const outputPath = path.join(config.outputDir, 'facilities.csv');

  const writer = createObjectCsvWriter({
    path: outputPath,
    header: csvHeaders,
    append: false,
  });

  await writer.writeRecords(records.map(formatRecord));
  console.log(`\nWritten ${records.length} facilities to ${outputPath}`);
}

export function resetCsvWriter(): void {
  headerWritten = false;
  csvWriter = null;
}

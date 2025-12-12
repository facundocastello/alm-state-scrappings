import XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { RawExcelRow, FacilityRecord, BedType } from './types.js';

const INPUT_DIR = path.join(process.cwd(), 'input');
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'facilities.csv');

// Map bed type string to the corresponding field name
function getBedFieldName(bedType: string): keyof FacilityRecord | null {
  const mapping: Record<string, keyof FacilityRecord> = {
    'Skilled Nursing Facility': 'skilledNursingFacilityBeds',
    'Nursing Facility': 'nursingFacilityBeds',
    'Intermediate Care Facility/Individuals with Intellectual Disabilities': 'icfIidBeds',
    'Congregate Assisted Living Facility': 'congregateAssistedLivingBeds',
    'Congregate Specialty Care Assisted Living Facility': 'congregateSpecialtyCareBeds',
    'Group Assisted Living Facility': 'groupAssistedLivingBeds',
    'Group Specialty Care Assisted Living Facility': 'groupSpecialtyCareBeds',
    'Family Assisted Living Facility': 'familyAssistedLivingBeds',
    'In-Patient Hospice': 'inPatientHospiceBeds',
    'In-Home Hospice': 'inHomeHospiceBeds',
  };
  return mapping[bedType] || null;
}

// Transform raw Excel row to FacilityRecord
function transformRow(row: RawExcelRow): FacilityRecord {
  // Merge address lines
  const addressParts = [row['Address Line 1'], row['Address Line 2']].filter(Boolean);
  const address = addressParts.join(', ');

  // Initialize bed counts
  const bedCounts: Record<string, number> = {
    skilledNursingFacilityBeds: 0,
    nursingFacilityBeds: 0,
    icfIidBeds: 0,
    congregateAssistedLivingBeds: 0,
    congregateSpecialtyCareBeds: 0,
    groupAssistedLivingBeds: 0,
    groupSpecialtyCareBeds: 0,
    familyAssistedLivingBeds: 0,
    inPatientHospiceBeds: 0,
    inHomeHospiceBeds: 0,
  };

  // Process Class 1-5 and their bed counts
  for (let i = 1; i <= 5; i++) {
    const classKey = `Class ${i}` as keyof RawExcelRow;
    const bedsKey = `Class ${i} Beds/Stations` as keyof RawExcelRow;

    const classType = row[classKey] as string | undefined;
    const bedCount = row[bedsKey] as number | undefined;

    if (classType && bedCount) {
      const fieldName = getBedFieldName(classType);
      if (fieldName) {
        bedCounts[fieldName] += bedCount;
      }
    }
  }

  return {
    facnum: String(row['Fac ID'] || ''),
    facilityName: row['Facility Name'] || '',
    address,
    city: row.City || '',
    state: row.State || '',
    zip: String(row.ZIP || ''),
    county: row.County || '',
    medicareNumber: String(row['Medicare #'] || ''),
    medicaidNumber: String(row['Medicaid #'] || ''),
    administratorName: row['Administrator Name'] || '',
    phone: row.Phone || '',
    facilityType: row['Facility Type'] || '',
    licensedBeds: row['Licensed Beds'] || 0,
    esrdStations: row['ESRD Stations'] || 0,
    hospitalAuthorizedBedCapacity: row['Hospital Authorized Bed Capacity'] || 0,
    licenseeType: row['Licensee Type'] || '',
    licenseStatus: row['License Status'] || '',
    deemedStatus: row['Deemed Status'] || '',
    ...bedCounts,
  } as FacilityRecord;
}

// Read all Excel files from input directory
function readExcelFiles(): RawExcelRow[] {
  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
  console.log(`Found ${files.length} Excel files in input/`);

  const allRows: RawExcelRow[] = [];

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file);
    console.log(`  Reading: ${file}`);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<RawExcelRow>(sheet);

    console.log(`    → ${rows.length} rows`);
    allRows.push(...rows);
  }

  return allRows;
}

// Convert 0 to empty string for CSV output
function zeroToEmpty(value: number): number | string {
  return value === 0 ? '' : value;
}

// Write CSV file
async function writeCsv(records: FacilityRecord[]): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const csvWriter = createObjectCsvWriter({
    path: OUTPUT_FILE,
    header: [
      { id: 'facnum', title: 'facnum' },
      { id: 'facilityName', title: 'facility_name' },
      { id: 'address', title: 'address' },
      { id: 'city', title: 'city' },
      { id: 'state', title: 'state' },
      { id: 'zip', title: 'zip' },
      { id: 'county', title: 'county' },
      { id: 'medicareNumber', title: 'medicare_number' },
      { id: 'medicaidNumber', title: 'medicaid_number' },
      { id: 'administratorName', title: 'administrator_name' },
      { id: 'phone', title: 'phone' },
      { id: 'facilityType', title: 'facility_type' },
      { id: 'licensedBeds', title: 'licensed_beds' },
      { id: 'esrdStations', title: 'esrd_stations' },
      { id: 'hospitalAuthorizedBedCapacity', title: 'hospital_authorized_bed_capacity' },
      { id: 'licenseeType', title: 'licensee_type' },
      { id: 'licenseStatus', title: 'license_status' },
      { id: 'deemedStatus', title: 'deemed_status' },
      { id: 'skilledNursingFacilityBeds', title: 'skilled_nursing_facility_beds' },
      { id: 'nursingFacilityBeds', title: 'nursing_facility_beds' },
      { id: 'icfIidBeds', title: 'icf_iid_beds' },
      { id: 'congregateAssistedLivingBeds', title: 'congregate_assisted_living_beds' },
      { id: 'congregateSpecialtyCareBeds', title: 'congregate_specialty_care_beds' },
      { id: 'groupAssistedLivingBeds', title: 'group_assisted_living_beds' },
      { id: 'groupSpecialtyCareBeds', title: 'group_specialty_care_beds' },
      { id: 'familyAssistedLivingBeds', title: 'family_assisted_living_beds' },
      { id: 'inPatientHospiceBeds', title: 'in_patient_hospice_beds' },
      { id: 'inHomeHospiceBeds', title: 'in_home_hospice_beds' },
    ],
  });

  // Transform records to convert 0s to empty strings
  const outputRecords = records.map(r => ({
    ...r,
    licensedBeds: zeroToEmpty(r.licensedBeds),
    esrdStations: zeroToEmpty(r.esrdStations),
    hospitalAuthorizedBedCapacity: zeroToEmpty(r.hospitalAuthorizedBedCapacity),
    skilledNursingFacilityBeds: zeroToEmpty(r.skilledNursingFacilityBeds),
    nursingFacilityBeds: zeroToEmpty(r.nursingFacilityBeds),
    icfIidBeds: zeroToEmpty(r.icfIidBeds),
    congregateAssistedLivingBeds: zeroToEmpty(r.congregateAssistedLivingBeds),
    congregateSpecialtyCareBeds: zeroToEmpty(r.congregateSpecialtyCareBeds),
    groupAssistedLivingBeds: zeroToEmpty(r.groupAssistedLivingBeds),
    groupSpecialtyCareBeds: zeroToEmpty(r.groupSpecialtyCareBeds),
    familyAssistedLivingBeds: zeroToEmpty(r.familyAssistedLivingBeds),
    inPatientHospiceBeds: zeroToEmpty(r.inPatientHospiceBeds),
    inHomeHospiceBeds: zeroToEmpty(r.inHomeHospiceBeds),
  }));

  await csvWriter.writeRecords(outputRecords);
}

async function main() {
  console.log('=== Alabama Facility Data Processor ===\n');

  // Read all Excel files
  const rawRows = readExcelFiles();
  console.log(`\nTotal raw rows: ${rawRows.length}`);

  // Check for duplicates by Fac ID
  const facIds = rawRows.map(r => r['Fac ID']);
  const uniqueFacIds = new Set(facIds);
  console.log(`Unique Fac IDs: ${uniqueFacIds.size}`);

  if (facIds.length !== uniqueFacIds.size) {
    console.log(`⚠️  Found ${facIds.length - uniqueFacIds.size} duplicate Fac IDs - keeping first occurrence`);

    // Deduplicate by Fac ID
    const seen = new Set<string>();
    const deduped: RawExcelRow[] = [];
    for (const row of rawRows) {
      const id = String(row['Fac ID']);
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push(row);
      }
    }
    rawRows.length = 0;
    rawRows.push(...deduped);
    console.log(`After deduplication: ${rawRows.length} rows`);
  }

  // Transform to output format
  console.log('\nTransforming data...');
  const records = rawRows.map(transformRow);

  // Summary stats
  console.log('\n=== Facility Type Distribution ===');
  const typeCounts: Record<string, number> = {};
  for (const r of records) {
    typeCounts[r.facilityType] = (typeCounts[r.facilityType] || 0) + 1;
  }
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log('\n=== Bed Type Totals ===');
  const bedTotals = {
    'Skilled Nursing Facility': records.reduce((sum, r) => sum + r.skilledNursingFacilityBeds, 0),
    'Nursing Facility': records.reduce((sum, r) => sum + r.nursingFacilityBeds, 0),
    'ICF/IID': records.reduce((sum, r) => sum + r.icfIidBeds, 0),
    'Congregate Assisted Living': records.reduce((sum, r) => sum + r.congregateAssistedLivingBeds, 0),
    'Congregate Specialty Care': records.reduce((sum, r) => sum + r.congregateSpecialtyCareBeds, 0),
    'Group Assisted Living': records.reduce((sum, r) => sum + r.groupAssistedLivingBeds, 0),
    'Group Specialty Care': records.reduce((sum, r) => sum + r.groupSpecialtyCareBeds, 0),
    'Family Assisted Living': records.reduce((sum, r) => sum + r.familyAssistedLivingBeds, 0),
    'In-Patient Hospice': records.reduce((sum, r) => sum + r.inPatientHospiceBeds, 0),
    'In-Home Hospice': records.reduce((sum, r) => sum + r.inHomeHospiceBeds, 0),
  };
  for (const [type, total] of Object.entries(bedTotals).filter(([_, t]) => t > 0)) {
    console.log(`  ${type}: ${total} beds`);
  }

  // Write CSV
  console.log(`\nWriting CSV to ${OUTPUT_FILE}...`);
  await writeCsv(records);

  console.log(`\n✅ Done! Processed ${records.length} facilities`);
}

main().catch(console.error);

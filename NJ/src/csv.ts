import { createObjectCsvWriter } from 'csv-writer';
import { join } from 'path';
import { config } from './config.js';
import { FacilityRecord, CSVRow } from './types.js';

function formatBedsInformation(record: FacilityRecord): string {
  if (record.beds.length === 0) {
    return '(no bed information)';
  }

  // Format as pipe-separated: "Type1: Count1|Type2: Count2"
  return record.beds
    .map(bed => `${bed.type}: ${bed.count}`)
    .join('|');
}

function convertToCSVRow(record: FacilityRecord): CSVRow {
  return {
    facility_id: record.facilityId,
    license_number: record.licenseNumber,
    facility_name: record.facilityName,
    license_type: record.licenseType,
    facility_status: record.facilityStatus,
    license_status: record.licenseStatus,
    address: record.address,
    city: record.city,
    county: record.county,
    state: record.state,
    zip_code: record.zipCode,
    phone: record.phone || '',
    capacity: record.capacity !== null ? record.capacity.toString() : '',
    license_effective_date: record.licenseEffectiveDate || '',
    license_expiration_date: record.licenseExpirationDate || '',
    licensee_name: record.licenseeName || '',
    licensee_address: record.licenseeAddress || '',
    licensee_phone: record.licenseePhone || '',
    administrator: record.administrator || '',

    beds_information: formatBedsInformation(record),

    routine_inspections: record.inspectionSummaries.routine.inspectionCount.toString(),
    routine_deficiencies: record.inspectionSummaries.routine.deficiencyCount.toString(),
    routine_scope_severity: record.inspectionSummaries.routine.maxScopeAndSeverity || '',

    complaint_inspections: record.inspectionSummaries.complaint.inspectionCount.toString(),
    complaint_deficiencies: record.inspectionSummaries.complaint.deficiencyCount.toString(),
    complaint_scope_severity: record.inspectionSummaries.complaint.maxScopeAndSeverity || '',

    has_advisory_data: record.hasAdvisoryData ? 'yes' : 'no',
    has_report_card: record.hasReportCard ? 'yes' : 'no',

    reports_total: record.reportsTotal.toString(),
    data_completeness: record.dataCompleteness,

    profile_url: record.profileUrl,
    reports_page_url: record.reportsPageUrl,
    scraped_at: record.scrapedAt,
  };
}

export async function exportToCSV(records: FacilityRecord[]): Promise<void> {
  const outputPath = join(config.paths.output, 'facilities.csv');

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'facility_id', title: 'Facility ID' },
      { id: 'license_number', title: 'License Number' },
      { id: 'facility_name', title: 'Facility Name' },
      { id: 'license_type', title: 'License Type' },
      { id: 'facility_status', title: 'Facility Status' },
      { id: 'license_status', title: 'License Status' },
      { id: 'address', title: 'Address' },
      { id: 'city', title: 'City' },
      { id: 'county', title: 'County' },
      { id: 'state', title: 'State' },
      { id: 'zip_code', title: 'Zip Code' },
      { id: 'phone', title: 'Phone' },
      { id: 'capacity', title: 'Capacity' },
      { id: 'license_effective_date', title: 'License Effective Date' },
      { id: 'license_expiration_date', title: 'License Expiration Date' },
      { id: 'licensee_name', title: 'Licensee Name' },
      { id: 'licensee_address', title: 'Licensee Address' },
      { id: 'licensee_phone', title: 'Licensee Phone' },
      { id: 'administrator', title: 'Administrator' },
      { id: 'beds_information', title: 'Beds Information' },
      { id: 'routine_inspections', title: 'Routine Inspections' },
      { id: 'routine_deficiencies', title: 'Routine Deficiencies' },
      { id: 'routine_scope_severity', title: 'Routine Scope & Severity' },
      { id: 'complaint_inspections', title: 'Complaint Inspections' },
      { id: 'complaint_deficiencies', title: 'Complaint Deficiencies' },
      { id: 'complaint_scope_severity', title: 'Complaint Scope & Severity' },
      { id: 'has_advisory_data', title: 'Has Advisory Data' },
      { id: 'has_report_card', title: 'Has Report Card' },
      { id: 'reports_total', title: 'Reports Total' },
      { id: 'data_completeness', title: 'Data Completeness' },
      { id: 'profile_url', title: 'Profile URL' },
      { id: 'reports_page_url', title: 'Reports Page URL' },
      { id: 'scraped_at', title: 'Scraped At' },
    ],
  });

  const csvRows = records.map(convertToCSVRow);
  await csvWriter.writeRecords(csvRows);

  console.log(`\nExported ${records.length} facilities to ${outputPath}`);
}

import { createObjectCsvWriter } from 'csv-writer';
import { join } from 'path';
import { config } from './config.js';
import { FacilityRecord, CSVRow, BedTypeInfo } from './types.js';

interface BedCounts {
  total: number;
  longTermCare: number;
  assistedLiving: number;
  adultDay: number;
  pediatricDay: number;
  pediatricLTC: number;
  residential: number;
  ventilator: number;
  behavioralMgmt: number;
  comprehensivePC: number;
}

function parseBedCounts(beds: BedTypeInfo[]): BedCounts {
  const counts: BedCounts = {
    total: 0,
    longTermCare: 0,
    assistedLiving: 0,
    adultDay: 0,
    pediatricDay: 0,
    pediatricLTC: 0,
    residential: 0,
    ventilator: 0,
    behavioralMgmt: 0,
    comprehensivePC: 0,
  };

  for (const bed of beds) {
    counts.total += bed.count;

    const type = bed.type.toLowerCase();
    if (type.includes('long term care')) {
      counts.longTermCare += bed.count;
    } else if (type.includes('assisted living')) {
      counts.assistedLiving += bed.count;
    } else if (type.includes('adult day')) {
      counts.adultDay += bed.count;
    } else if (type.includes('pediatric day')) {
      counts.pediatricDay += bed.count;
    } else if (type.includes('pediatric long-term')) {
      counts.pediatricLTC += bed.count;
    } else if (type.includes('residential')) {
      counts.residential += bed.count;
    } else if (type.includes('ventilator')) {
      counts.ventilator += bed.count;
    } else if (type.includes('behavioral')) {
      counts.behavioralMgmt += bed.count;
    } else if (type.includes('comprehensive personal care')) {
      counts.comprehensivePC += bed.count;
    }
  }

  return counts;
}

function convertToCSVRow(record: FacilityRecord): CSVRow {
  const bedCounts = parseBedCounts(record.beds);
  const totalInspections =
    record.inspectionSummaries.routine.inspectionCount +
    record.inspectionSummaries.complaint.inspectionCount;

  return {
    // Tab prefix forces Excel to treat as text and preserve leading zeros
    facility_id: `\t${record.facilityId}`,
    license_number: `\t${record.licenseNumber}`,
    facility_name: record.facilityName,
    license_type: record.licenseType,
    address: record.address,
    city: record.city,
    county: record.county,
    state: record.state,
    zip_code: record.zipCode,
    phone: record.phone || '',
    license_expiration_date: record.licenseExpirationDate || '',
    licensee_name: record.licenseeName || '',
    administrator: record.administrator || '',

    // Separate bed count columns
    beds_total: bedCounts.total.toString(),
    beds_long_term_care: bedCounts.longTermCare > 0 ? bedCounts.longTermCare.toString() : '',
    beds_assisted_living: bedCounts.assistedLiving > 0 ? bedCounts.assistedLiving.toString() : '',
    beds_adult_day: bedCounts.adultDay > 0 ? bedCounts.adultDay.toString() : '',
    beds_pediatric_day: bedCounts.pediatricDay > 0 ? bedCounts.pediatricDay.toString() : '',
    beds_pediatric_ltc: bedCounts.pediatricLTC > 0 ? bedCounts.pediatricLTC.toString() : '',
    beds_residential: bedCounts.residential > 0 ? bedCounts.residential.toString() : '',
    beds_ventilator: bedCounts.ventilator > 0 ? bedCounts.ventilator.toString() : '',
    beds_behavioral_mgmt: bedCounts.behavioralMgmt > 0 ? bedCounts.behavioralMgmt.toString() : '',
    beds_comprehensive_pc: bedCounts.comprehensivePC > 0 ? bedCounts.comprehensivePC.toString() : '',

    routine_inspections: record.inspectionSummaries.routine.inspectionCount.toString(),
    routine_deficiencies: record.inspectionSummaries.routine.deficiencyCount.toString(),
    routine_scope_severity: record.inspectionSummaries.routine.maxScopeAndSeverity || '',

    complaint_inspections: record.inspectionSummaries.complaint.inspectionCount.toString(),
    complaint_deficiencies: record.inspectionSummaries.complaint.deficiencyCount.toString(),
    complaint_scope_severity: record.inspectionSummaries.complaint.maxScopeAndSeverity || '',

    total_inspections: totalInspections.toString(),

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
  const outputPath = join(config.paths.output, 'facility.csv');

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'facility_id', title: 'Facility ID' },
      { id: 'license_number', title: 'License Number' },
      { id: 'facility_name', title: 'Facility Name' },
      { id: 'license_type', title: 'License Type' },
      { id: 'address', title: 'Address' },
      { id: 'city', title: 'City' },
      { id: 'county', title: 'County' },
      { id: 'state', title: 'State' },
      { id: 'zip_code', title: 'Zip Code' },
      { id: 'phone', title: 'Phone' },
      { id: 'license_expiration_date', title: 'License Expiration Date' },
      { id: 'licensee_name', title: 'Licensee Name' },
      { id: 'administrator', title: 'Administrator' },
      { id: 'beds_total', title: 'Beds Total' },
      { id: 'beds_long_term_care', title: 'Beds Long Term Care' },
      { id: 'beds_assisted_living', title: 'Beds Assisted Living' },
      { id: 'beds_adult_day', title: 'Beds Adult Day' },
      { id: 'beds_pediatric_day', title: 'Beds Pediatric Day' },
      { id: 'beds_pediatric_ltc', title: 'Beds Pediatric LTC' },
      { id: 'beds_residential', title: 'Beds Residential' },
      { id: 'beds_ventilator', title: 'Beds Ventilator' },
      { id: 'beds_behavioral_mgmt', title: 'Beds Behavioral Management' },
      { id: 'beds_comprehensive_pc', title: 'Beds Comprehensive Personal Care' },
      { id: 'routine_inspections', title: 'Routine Inspections' },
      { id: 'routine_deficiencies', title: 'Routine Deficiencies' },
      { id: 'routine_scope_severity', title: 'Routine Scope & Severity' },
      { id: 'complaint_inspections', title: 'Complaint Inspections' },
      { id: 'complaint_deficiencies', title: 'Complaint Deficiencies' },
      { id: 'complaint_scope_severity', title: 'Complaint Scope & Severity' },
      { id: 'total_inspections', title: 'Total Inspections' },
      { id: 'has_advisory_data', title: 'Has Advisory Data' },
      { id: 'has_report_card', title: 'Has Report Card' },
      { id: 'reports_total', title: 'Reports Total' },
      { id: 'data_completeness', title: 'Data Completeness' },
      { id: 'profile_url', title: 'URL_DETAIL' },
      { id: 'reports_page_url', title: 'Reports Page URL' },
      { id: 'scraped_at', title: 'Scraped At' },
    ],
  });

  const csvRows = records.map(convertToCSVRow);
  await csvWriter.writeRecords(csvRows);

  console.log(`\nExported ${records.length} facilities to ${outputPath}`);
}

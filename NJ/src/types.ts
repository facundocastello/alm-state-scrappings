export interface BedTypeInfo {
  type: string;
  count: number;
}

export interface InspectionSummary {
  inspectionCount: number;
  deficiencyCount: number;
  maxScopeAndSeverity: string | null;
  moreInfoUrl: string;
}

export interface FacilityInfo {
  licenseNumber: string;
  facilityName: string;
  licenseType: string;
  facilityStatus: string;
  licenseStatus: string;
  address: string;
  city: string;
  county: string;
  state: string;
  zipCode: string;
  phone: string | null;
  capacity: number | null;
  licenseEffectiveDate: string | null;
  licenseExpirationDate: string | null;
  licenseeName: string | null;
  licenseeAddress: string | null;
  licenseePhone: string | null;
  administrator: string | null;
}

export interface FacilityDetail extends FacilityInfo {
  facilityId: string;
  beds: BedTypeInfo[];

  inspectionSummaries: {
    routine: InspectionSummary;
    complaint: InspectionSummary;
  };

  hasAdvisoryData: boolean;
  hasReportCard: boolean;

  profileUrl: string;
  reportsPageUrl: string;
}

export interface Report {
  reportType: string;
  reportDate: string;
  fileName: string;
  downloadUrl: string;
  localPath?: string;
}

export interface FacilityRecord extends FacilityDetail {
  reports: Report[];
  reportsTotal: number;
  dataCompleteness: 'full' | 'partial' | 'minimal';
  scrapedAt: string;
}

export interface CSVRow {
  facility_id: string;
  license_number: string;
  facility_name: string;
  license_type: string;
  facility_status: string;
  license_status: string;
  address: string;
  city: string;
  county: string;
  state: string;
  zip_code: string;
  phone: string;
  capacity: string;
  license_effective_date: string;
  license_expiration_date: string;
  licensee_name: string;
  licensee_address: string;
  licensee_phone: string;
  administrator: string;

  beds_information: string;

  routine_inspections: string;
  routine_deficiencies: string;
  routine_scope_severity: string;

  complaint_inspections: string;
  complaint_deficiencies: string;
  complaint_scope_severity: string;

  has_advisory_data: string;
  has_report_card: string;

  reports_total: string;
  data_completeness: string;

  profile_url: string;
  reports_page_url: string;
  scraped_at: string;
}

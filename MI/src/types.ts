export interface FacilitySummary {
  licenseNumber: string;
  name: string;
  licenseType: string;
  address: string;
  city: string;
  county: string;
  phone: string;
  zipCode: string;
  capacity: number | null;
  profileUrl: string;
  fid: string;
}

export interface Report {
  reportType: string;
  reportDate: string;
  fileName: string;
  documentUrl?: string;
  localPath?: string;
}

export interface FacilityDetail {
  licenseNumber: string;
  facilityName: string;
  address: string;
  city: string;
  county: string;
  phone: string;
  zipCode: string;
  facilityStatus: string;
  licenseStatus: string;
  licenseEffectiveDate: string;
  licenseExpirationDate: string;
  licenseFacilityType: string;
  capacity: number | null;
  serves: string[];
  specialCertification: string[];
  licenseeName: string;
  licenseeAddress: string;
  licenseePhone: string;
  reports: Report[];
}

export interface FacilityRecord extends FacilitySummary {
  facilityStatus: string;
  licenseStatus: string;
  licenseEffectiveDate: string;
  licenseExpirationDate: string;
  licenseFacilityType: string;
  serves: string[];
  specialCertification: string[];
  licenseeName: string;
  licenseeAddress: string;
  licenseePhone: string;
  reports: Report[];
  reportsTotal: number;
}


// Raw API response types from Utah CCL

export interface SearchApiAddress {
  addressOne: string | null;
  addressTwo: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  county: string | null;
}

export interface SearchApiItem {
  id: number;
  name: string;
  phone: string | null;
  directors: string | null;
  address: SearchApiAddress | null;
  totalCapacity: number | null;
  underAgeTwoCapacity: number | null;
  licenseTypeId: number;
}

export interface SearchApiResponse {
  content: SearchApiItem[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  firstPage: boolean;
  lastPage: boolean;
  numberOfElements: number;
  sort: string | null;
}

export interface FacilityApiInspection {
  id: number | null;
  inspectionDate: string;
  inspectionTypes: string;
  checklistIds: number[];
  findings: string[];
  underAppeal: boolean;
}

export interface FacilityApiLicenseType {
  name: string;
  licenseExpirationDate: string | null;
  status: string | null;
}

export interface FacilityApiResponse {
  idNumber: string;
  name: string;
  address: SearchApiAddress | null;
  phone: string | null;
  type: string | null;
  licenseType: string | null;
  capacity: number | null;
  underAgeTwoCapacity: number | null;
  initialRegulationDate: string | null;
  expirationDate: string | null;
  conditional: boolean;
  condExpirationDate: string | null;
  status: string | null;
  occQiReq: string | null;
  licenseTypes: FacilityApiLicenseType[];
  inspections: FacilityApiInspection[];
  dcount: number | null;
  icount: number | null;
  ccount: number | null;
  specialties: string | null;
  cmsCertNumber: string | null;
}

// Internal types

export interface FacilitySummary {
  fid: string;
  name: string;
  phone: string | null;
  address: string | null;
  addressTwo: string | null;
  city: string | null;
  county: string | null;
  state: string;
  zip: string | null;
  totalCapacity: number | null;
  licenseTypeId: number;
  profileUrl: string;
}

export interface Checklist {
  checklistId: number;
  inspectionDate: string;
  inspectionTypes: string;
  downloadUrl: string;
  localPath?: string;
}

export interface Inspection {
  inspectionDate: string;
  inspectionTypes: string;
  checklistIds: number[];
  findings: string[];
  underAppeal: boolean;
}

export interface FacilityDetail {
  idNumber: string;
  licenseType: string | null;
  capacity: number | null;
  status: string | null;
  specialties: string | null;
  initialRegulationDate: string | null;
  expirationDate: string | null;
  conditional: boolean;
  inspections: Inspection[];
  checklists: Checklist[];
}

export interface FacilityRecord extends FacilitySummary {
  idNumber: string;
  licenseType: string | null;
  capacity: number | null;
  status: string | null;
  specialties: string | null;
  initialRegulationDate: string | null;
  expirationDate: string | null;
  conditional: boolean;
  inspections: Inspection[];
  checklists: Checklist[];
  inspectionsTotal: number;
  inspectionsWithFindings: number;
  checklistsTotal: number;
  scrapedAt: string;
}

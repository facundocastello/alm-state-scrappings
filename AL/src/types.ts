// Bed type categories found in AL data
export type BedType =
  | 'Skilled Nursing Facility'
  | 'Nursing Facility'
  | 'Intermediate Care Facility/Individuals with Intellectual Disabilities'
  | 'Congregate Assisted Living Facility'
  | 'Congregate Specialty Care Assisted Living Facility'
  | 'Group Assisted Living Facility'
  | 'Group Specialty Care Assisted Living Facility'
  | 'Family Assisted Living Facility'
  | 'In-Patient Hospice'
  | 'In-Home Hospice';

// Raw row from Excel
export interface RawExcelRow {
  'Facility Name': string;
  'Address Line 1': string;
  'Address Line 2'?: string;
  City: string;
  State: string;
  ZIP: string;
  County: string;
  'Fac ID': string;
  'Medicare #'?: string;
  'Medicaid #'?: string;
  'Administrator Name'?: string;
  Phone?: string;
  'Facility Type': string;
  'Licensed Beds'?: number;
  'ESRD Stations'?: number;
  'Hospital Authorized Bed Capacity'?: number;
  'Class 1'?: string;
  'Class 1 Beds/Stations'?: number;
  'Class 2'?: string;
  'Class 2 Beds/Stations'?: number;
  'Class 3'?: string;
  'Class 3 Beds/Stations'?: number;
  'Class 4'?: string;
  'Class 4 Beds/Stations'?: number;
  'Class 5'?: string;
  'Class 5 Beds/Stations'?: number;
  'Licensee Type'?: string;
  'License Status'?: string;
  'Deemed Status'?: string;
}

// Transformed facility record for CSV output
export interface FacilityRecord {
  facnum: string;
  facilityName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  medicareNumber: string;
  medicaidNumber: string;
  administratorName: string;
  phone: string;
  facilityType: string;
  licensedBeds: number;
  esrdStations: number;
  hospitalAuthorizedBedCapacity: number;
  licenseeType: string;
  licenseStatus: string;
  deemedStatus: string;
  // Bed counts by type
  skilledNursingFacilityBeds: number;
  nursingFacilityBeds: number;
  icfIidBeds: number; // Intermediate Care Facility/Individuals with Intellectual Disabilities
  congregateAssistedLivingBeds: number;
  congregateSpecialtyCareBeds: number;
  groupAssistedLivingBeds: number;
  groupSpecialtyCareBeds: number;
  familyAssistedLivingBeds: number;
  inPatientHospiceBeds: number;
  inHomeHospiceBeds: number;
}

// All unique bed types for reference
export const BED_TYPES: BedType[] = [
  'Skilled Nursing Facility',
  'Nursing Facility',
  'Intermediate Care Facility/Individuals with Intellectual Disabilities',
  'Congregate Assisted Living Facility',
  'Congregate Specialty Care Assisted Living Facility',
  'Group Assisted Living Facility',
  'Group Specialty Care Assisted Living Facility',
  'Family Assisted Living Facility',
  'In-Patient Hospice',
  'In-Home Hospice',
];

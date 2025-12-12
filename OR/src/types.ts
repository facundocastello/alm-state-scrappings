/**
 * Oregon Healthcare Facility Types
 */

/**
 * Facility data from ArcGIS API (82 fields)
 */
export interface FacilityFromAPI {
  // Identification
  LoadID: number;
  FacilityID: string;
  CCMUNum: string;
  InternalFacilityID: number;
  MedicareID: string | null;
  MedicaidID: string | null;
  Source: string;
  CompanyID: number;

  // Basic Info
  FacilityName: string;
  FacilityTypeCd: string;
  FacilityTypeDesc: string;
  FacilityDisplayDesc: string;
  FacilityAbbreviation: string;
  AFHClass: string | null;
  OperatingStatusCod: string;
  OperatingStatusDesc: string;

  // Address
  Address: string;
  City: string;
  State: string;
  County: string;
  Zip: string;

  // Contact
  Phone: string;
  Fax: string;
  Email: string | null;
  Website: string;
  AdministratorName: string;

  // Capacity
  TotalBed: number | null;

  // Dates
  ActiveDate: string | null;
  InactiveDate: string | null;
  FacilityCloseDate: string | null;
  FinalOrderDate: string | null;
  LoadDt: string;

  // Owner Info
  OwnerName: string | null;
  OwnerAddress: string | null;
  OwnerCity: string | null;
  OwnerState: string | null;
  OwnerZip: string | null;
  OwnerPhone: string | null;
  OwnerActiveDate: string | null;

  // Operator Info
  OperatorName: string | null;
  OperatorAddress: string | null;
  OperatorCity: string | null;
  OperatorState: string | null;
  OperatorZip: string | null;
  OperatorPhone: string | null;

  // Management Info
  ManagementName: string | null;
  ManagementAddress: string | null;
  ManagementCity: string | null;
  ManagementState: string | null;
  ManagementZip: string | null;
  ManagementPhone: string | null;

  // Service Capabilities (boolean flags as 0/1)
  AlternativeLanguage: number;
  AlzheimerDementia: number;
  Bariatric: number;
  Daycare: number;
  Pets: number;
  Smoking: number;
  TraumaticBrainInjury: number;
  Ventilator: number;

  // Funding
  MedicaidFlg: number;
  MedicareFlg: number;
  PrivatePayFlg: number;
  FundingSource: string | null;
}

/**
 * ArcGIS API response structure
 */
export interface ArcGISResponse {
  objectIdFieldName: string;
  uniqueIdField: { name: string; isSystemMaintained: boolean };
  globalIdFieldName: string;
  fields: Array<{ name: string; type: string; alias: string; length?: number }>;
  features: Array<{ attributes: FacilityFromAPI }>;
  exceededTransferLimit?: boolean;
}

/**
 * Survey/Inspection record from web portal
 */
export interface Survey {
  date: string;
  reportNumber: string;
  categoryTypes: string[];
  deficiencyCount: number;
}

/**
 * Survey citation detail (from table row)
 */
export interface SurveyCitation {
  tagId: string;
  tagTitle: string;
  level: number;
  visits: Array<{ visitNum: number; date: string }>;
  /** Detailed info fetched from /SurveyCites/Details/{reportNumber}?tag={tagId} */
  details?: CitationDetails;
}

/**
 * Detailed citation info from /SurveyCites/Details/{reportNumber}?tag={tagId}
 */
export interface CitationDetails {
  reportNumber: string;
  tagId: string;
  tagTitle: string;
  /** The full rule/regulation text (OAR) */
  ruleText: string;
  /** Specific findings from the inspection */
  findings: string;
  /** Plan of Correction */
  planOfCorrection: string;
  /** Individual visits with dates and correction status */
  visitDetails: Array<{
    visitType: string;  // e.g., "t" for technical
    visitDate: string;
    correctedDate: string | null;
  }>;
}

/**
 * Violation record (abuse or licensing)
 */
export interface Violation {
  type: "abuse" | "licensing";
  description?: string;
  date?: string;
  status?: string;
}

/**
 * Notice record (license conditions, revocations)
 */
export interface Notice {
  type: string;
  date?: string;
  description?: string;
}

/**
 * Complete scraped facility data
 */
export interface ScrapedFacility {
  facility: FacilityFromAPI;
  surveys: Survey[];
  surveyCitations: Map<string, SurveyCitation[]>;
  violations: Violation[];
  notices: Notice[];
  scrapedAt: string;
}

/**
 * CSV row structure for export
 */
export interface FacilityCSVRow {
  // Identification
  facilityId: string;
  ccmuNum: string;
  medicareId: string;
  medicaidId: string;
  source: string;

  // Basic Info
  facilityName: string;
  facilityTypeCd: string;
  facilityTypeDesc: string;
  afhClass: string;
  operatingStatusDesc: string;

  // Address
  address: string;
  city: string;
  state: string;
  county: string;
  zip: string;

  // Contact
  phone: string;
  fax: string;
  email: string;
  website: string;
  administratorName: string;

  // Capacity
  totalBeds: string;

  // Dates
  activeDate: string;
  inactiveDate: string;
  facilityCloseDate: string;
  finalOrderDate: string;

  // Owner Info
  ownerName: string;
  ownerAddress: string;
  ownerCity: string;
  ownerState: string;
  ownerZip: string;
  ownerPhone: string;
  ownerActiveDate: string;

  // Operator Info
  operatorName: string;
  operatorAddress: string;
  operatorCity: string;
  operatorState: string;
  operatorZip: string;
  operatorPhone: string;

  // Management Info
  managementName: string;
  managementAddress: string;
  managementCity: string;
  managementState: string;
  managementZip: string;
  managementPhone: string;

  // Services (boolean as "Yes"/"No")
  alternativeLanguage: string;
  alzheimerDementia: string;
  bariatric: string;
  daycare: string;
  pets: string;
  smoking: string;
  traumaticBrainInjury: string;
  ventilator: string;

  // Funding
  medicaidFlg: string;
  medicareFlg: string;
  privatePayFlg: string;
  fundingSource: string;

  // Scraped Data
  surveyCount: string;
  totalDeficiencies: string;
  abuseViolationCount: string;
  licensingViolationCount: string;
  noticeCount: string;
  latestSurveyDate: string;
  latestSurveyType: string;
  latestSurveyDeficiencies: string;

  // Generated
  reportFile: string;
  scrapedAt: string;
  profileUrl: string;
}

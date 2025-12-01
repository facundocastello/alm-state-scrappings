/**
 * Arizona Healthcare Facility Data Types
 * Based on AZ CareCheck (AZDHS) Salesforce Aura API
 */

// Input facility from search results
export interface FacilityInput {
  "5": string; // facilityId
  facilityLegalName: string;
  facilityDBAName?: string;
  facilityType: string;
  operating: string;
  phoneNumber: string;
  program: string;
  location: {
    City: string;
    Latitude: string;
    Longitude: string;
    PostalCode: string;
    State: string;
    Street: string;
  };
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  showStaticResourceIcon: boolean;
}

// License details
export interface License {
  license: string;
  licenseType: string;
  licenseStatus: string;
  effectiveDate: string;
  expirationDate: string;
  originalLicensedDate: string;
  certificatePublicURL?: string;
  services: string;
}

// Service capacity
export interface FacilityService {
  Id: string;
  Service_Type__c: string;
  Capacity__c?: number;
}

// Full facility details from API
export interface FacilityDetails {
  facilityId: string;
  legalName: string;
  dba?: string;
  address: string;
  mailingAddress?: string;
  physicalCity: string;
  physicalState: string;
  physicalZip: string;
  phone: string;

  // Location
  billingLatitude: string;
  billingLongitude: string;
  shippingLatitude?: string;

  // Classification
  bureau: string;
  program: string;
  type: string;
  facilityType: string;
  subType?: string;

  // Status
  facilityStatus: string;
  licenseStatus: string;
  exempt: boolean;

  // License info
  license: string;
  licenseOwner: string;
  effectiveDate: string;
  expirationDate: string;
  originalLicensedDate: string;
  licenses: License[];

  // Additional identifiers
  externalFacilitySearchId: string;
  ccn?: string; // CMS Certification Number (for nursing homes)

  // Capacity & Services
  totalCapacity?: string;
  facilityServices: FacilityService[];

  // Management
  chiefAdministrativeOfficer?: string;
  manager?: string;
  managerLicense?: string;

  // Quality
  qualityRating?: string; // A, B, C rating for nursing homes

  // URLs
  certificatePublicURL?: string;

  // Affiliations
  affiliation?: string;
  affiliationStartDate?: string;
  affiliationEndDate?: string;
  hasRelatedFacilities: boolean;
  isMothershipFacility: boolean;

  // Other addresses
  cultivationAddress?: string;
  manufactureAddress?: string;
}

// Inspection summary from list
export interface Inspection {
  Id: string;
  inspectionId: string;
  inspectionName: string;
  inspectionType: string;
  inspectionStatus: string;
  inspectionDates: string;
  inspectionStartDate: string;
  inspectionSODSentDate?: string;
  inspectionIDRDueDate?: string;
  initialComments: string;
  bureau: string;
  certificateNumber: string;
  worksheetType: string;
  licenseManagedBy: string;
  federalComment?: string;
  inspectionAddressLine1?: string;
  inspectionAddressLine2?: string;
}

// Deficiency/violation item
export interface DeficiencyItem {
  evidence: string;
  rule: string;
  hasAttachments: boolean;
  monitoring?: string;
  permanentSolution?: string;
  temporarySolution?: string;
  personResponsible?: string;
}

// Full inspection details with deficiencies
export interface InspectionDetails {
  inspectionNumber: string;
  inspectionStatus: string;
  inspectionType: string;
  inspectionDates: string;
  initialComments: string;
  inspectionItems: DeficiencyItem[];

  // Facility info included in response
  facilityName: string;
  facilityType: string;
  facilityPhysicalAddress: string;
  facilityMailingAddress?: string;
  facilityPhoneNumber: string;
  facilityWebsite?: string;
  facilityServices?: string;
  facilityDBA?: string;

  // License info
  certificateNumber: string;
  facilityLicenseNumber: string;
  facilityLicenseEffectiveDate: string;
  facilityLicenseExpirationDate: string;

  // Other
  bureau: string;
  program: string;
  worksheetType: string;

  // Hours (if applicable)
  mondayHours?: string;
  tuesdayHours?: string;
  wednesdayHours?: string;
  thursdayHours?: string;
  fridayHours?: string;
  saturdayHours?: string;
  sundayHours?: string;

  // Addresses
  manufactureAddress?: string;
  offsiteCultivationAddress?: string;
}

// Attachment/document
export interface Attachment {
  Id: string;
  Name: string;
  ContentVersionId: string;
  CreatedById: string;
  PreferencesAllowOriginalDownload: string;
  PreferencesAllowPDFDownload: string;
  PreferencesPasswordRequired: string;
  DistributionPublicUrl: string;
  ContentDownloadUrl: string;
}

// Combined facility data for output
export interface ScrapedFacility {
  // Input data
  facilityId: string;

  // Details
  details: FacilityDetails | null;

  // Inspections
  inspections: Inspection[];
  inspectionDetails: Map<string, InspectionDetails>;

  // Attachments
  attachments: Map<string, Attachment[]>;

  // Metadata
  scrapedAt: string;
  errors: string[];
}

// CSV row structure
export interface FacilityCSVRow {
  // IDs
  facility_id: string;
  external_id: string;
  ccn: string;

  // Basic info
  legal_name: string;
  dba: string;
  facility_type: string;
  sub_type: string;
  bureau: string;
  program: string;

  // Status
  facility_status: string;
  license_status: string;
  quality_rating: string;

  // Location
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: string;
  longitude: string;
  mailing_address: string;

  // Contact
  phone: string;

  // License
  license_number: string;
  license_owner: string;
  license_effective_date: string;
  license_expiration_date: string;
  original_licensed_date: string;
  certificate_url: string;

  // Capacity
  total_capacity: string;
  services: string; // JSON array of services

  // Management
  administrator: string;
  manager: string;
  manager_license: string;

  // Inspections summary
  inspection_count: number;
  complaint_inspection_count: number;
  deficiency_count: number;
  last_inspection_date: string;
  last_inspection_type: string;
  last_inspection_result: string;

  // Reports
  report_files: string; // JSON array of downloaded PDFs

  // Metadata
  scraped_at: string;
}

// API response wrapper
export interface AuraResponse<T> {
  actions: Array<{
    id: string;
    state: string;
    returnValue: {
      returnValue: T;
      cacheable: boolean;
    };
    error: unknown[];
  }>;
}

// Custom metadata for facility tabs
export interface FacilityMetadata {
  showEnforcements: boolean;
  showInvestigations: boolean;
}

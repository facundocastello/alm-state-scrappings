// ============================================
// Assisted Housing Types (pfr.maine.gov)
// ============================================

export interface AssistedHousingListing {
  name: string;
  licenseNumber: string;
  location: string;
  profession: string;
  status: string;
  detailUrl: string;
}

export interface LicenseHistoryEntry {
  licenseType: string;
  startDate: string;
  endDate: string;
}

export interface SpecialtyEntry {
  description: string;
  issueDate: string;
  status: string;
  capacity: number | null;
}

export interface InspectionDocument {
  type: string;
  sentDate: string;
  filename: string;
  downloadUrl: string;
  localPath?: string;
}

export interface InspectionEntry {
  date: string;
  type: string;
  status: string;
  documents: InspectionDocument[];
}

export interface AssistedHousingDetail {
  // Full address
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  fax: string;

  // License info
  firstLicensure: string;
  expirationDate: string;
  statusNote: string;

  // Capacity
  totalCapacity: number | null;
  adaAccessible: boolean | null;

  // Contacts
  primaryAdministrator: string;
  primaryOwner: string;

  // History
  licenseHistory: LicenseHistoryEntry[];

  // Specialties
  specialties: SpecialtyEntry[];

  // Inspections
  inspections: InspectionEntry[];
}

export interface AssistedHousingFacility extends AssistedHousingListing, AssistedHousingDetail {
  scrapedAt: string;
}

// ============================================
// Nursing Home / Hospice Types (gateway.maine.gov)
// ============================================

export interface NursingHomeFacility {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  fax: string;
  providerType: string;
  license: string;
  administrator: string;
  facilityId: string;
  surveyCount: number;
  mapUrl: string;
  facilityType: 'nursing_home' | 'hospice';
  scrapedAt: string;

  // Survey data (populated by Playwright later)
  surveys?: SurveyEntry[];
}

export interface SurveyEntry {
  date: string;
  type: string;
  reportUrl?: string;
  localPath?: string;
}

// ============================================
// Progress Tracking
// ============================================

export interface ScrapingProgress {
  url: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

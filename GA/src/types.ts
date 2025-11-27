// ============================================================
// API Response Types
// ============================================================

export interface FolderListingRequest {
  repoName: string;
  folderId: number;
  getNewListing: boolean;
  start: number;
  end: number;
  sortColumn: string;
  sortAscending: boolean;
}

export interface FolderListingResult {
  name: string;
  entryId: number;
  type: number;
  shortcutTargetId: number;
  targetType: number;
  pathToImage: string;
  iconClass: string;
  extension: string;
  multiValueFields: (string | null)[];
  isEdoc: boolean;
  entryProperties: unknown;
  contexthits: unknown;
  metadata: unknown;
  thumbnailPageCount: number;
  mediaMimeType: string | null;
  mediaHandlerUrl: string | null;
  tags: unknown;
  data: (string | number | null)[];
}

export interface ColType {
  displayName: string;
  name: string;
  type: number;
  isNumeric: boolean;
  hidden: boolean;
  multiValue: boolean;
  width: number;
}

export interface FolderListingData {
  name: string;
  folderId: number;
  colTypes: ColType[];
  results: FolderListingResult[];
  failed: boolean;
  errMsg: string | null;
  entryType: number;
  path: string;
  parentId: number;
  showColumnPicker: boolean;
  totalEntries: number;
  sortAscending: boolean;
  sortColumn: string;
}

export interface FolderListingResponse {
  data: FolderListingData;
  __breach: string;
}

export interface MetadataField {
  name: string;
  values: string[];
  isMvfg: boolean;
}

export interface MetadataData {
  templateName: string;
  localizedName: string | null;
  modified: string;
  created: string;
  path: string;
  tagIds: number[];
  fInfo: MetadataField[];
  linkGroup: unknown;
  documentRelationships: unknown[];
  err: string | null;
}

export interface MetadataResponse {
  data: MetadataData;
  __breach: string;
}

// ============================================================
// Domain Types
// ============================================================

export interface FacilityBasic {
  name: string;
  entryId: number;
  address: string;
  city: string;
  zip: string;
  county: string;
  categoryName: string;
  categoryEntryId: number;
  createdDate: string;
  modifiedDate: string;
}

export interface FacilityMetadata {
  facilityType: string;
  facilityName: string;
  violationFound: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  licensedBeds: string;
  licenseEffectiveDate: string;
  administrator: string;
  email: string;
  subtype: string;
  path: string;
  templateName: string;
  created: string;
  modified: string;
}

export interface Report {
  entryId: number;
  name: string;
  extension: string;
  downloadUrl: string;
  localPath: string;
  createdDate: string;
  modifiedDate: string;
}

export interface FacilityRecord {
  basic: FacilityBasic;
  metadata: FacilityMetadata | null;
  reports: Report[];
  reportsTotal: number;
  scrapedAt: string;
}

// ============================================================
// CSV Types
// ============================================================

export interface CSVRow {
  entry_id: string;
  category_name: string;
  facility_type: string;
  facility_name: string;
  violation_found: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  licensed_beds: string;
  license_effective_date: string;
  administrator: string;
  subtype: string;
  reports_total: string;
  path: string;
  created: string;
  modified: string;
  scraped_at: string;
}

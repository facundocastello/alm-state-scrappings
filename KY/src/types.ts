export interface FacilityMapping {
  itemId: string;
  licenseId: string;
  facilityName: string;
  region: string;
  county: string;
  formerNames: string;
}

export interface ReportInfo {
  imageId: string;
  dateUploaded: string;
  description: string;
  imageType: string;
  localPath?: string;
}

export interface FacilityReports {
  licenseId: string;
  itemId: string;
  facilityName: string;
  reports: ReportInfo[];
}

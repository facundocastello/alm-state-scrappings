import type { County } from "./constants.js";

export interface FacilitySummary {
  county: County;
  name: string;
  license: string;
  address: string;
  city: string;
  zip: string;
  score?: number | null;
  starsLabel?: string;
  starsValue?: string;
  profileUrl: string;
  fid: string;
}

export interface StatementOfDeficiency {
  inspectionType: string;
  documentType: string;
  inspectionDate: string;
  pages?: string;
  idrPending?: string;
  documentUrl?: string;
  localPath?: string;
  hasDeficiencies: boolean;
}

export interface StarRatingEntry {
  starsLabel: string;
  starsValue: string;
  score: number | null;
  issueDate: string;
  merits: number | null;
  demerits: number | null;
  inspectionType: string;
  worksheetUrl?: string;
}

export interface FacilityDetail {
  licenseNumber: string;
  siteAddress: string;
  siteCity: string;
  siteState: string;
  siteZip: string;
  capacity: number | null;
  county: string;
  statements: StatementOfDeficiency[];
  starRatings: StarRatingEntry[];
  latestRating?: StarRatingEntry;
  inspectionsTotal: number;
  inspectionsWithDeficiencies: number;
  inspectionsWithoutDeficiencies: number;
  worksheetCount: number;
}

export interface FacilityRecord extends FacilitySummary {
  siteAddress: string;
  siteCity: string;
  siteState: string;
  siteZip: string;
  capacity: number | null;
  statements: StatementOfDeficiency[];
  starRatings: StarRatingEntry[];
  latestRating?: StarRatingEntry;
  inspectionsTotal: number;
  inspectionsWithDeficiencies: number;
  inspectionsWithoutDeficiencies: number;
  worksheetCount: number;
}


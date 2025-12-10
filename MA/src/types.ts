export interface FacilityFromListing {
  name: string;
  profileUrl: string;
  address: string;
  phone: string;
  businessHours: string;
  totalUnits: number | null;
  traditionalUnits: number | null;
  specialCareUnits: number | null;
  lowIncomeOptions: boolean | null;
}

export interface FacilityProfile {
  // Drupal node ID (from data-alerts-path)
  nodeId: string | null;

  // From leaflet map data (JSON embedded in page)
  fax: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;

  // From "More info" section
  yearOpened: number | null;
  website: string | null;
  nonprofitOwnership: boolean | null;
  continuingCareRetirementCommunity: boolean | null;
  coLocatedWithNursingHome: boolean | null;

  // From JSON-LD
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

export interface FacilityRecord extends FacilityFromListing, FacilityProfile {
  scrapedAt: string;
}

export interface ScrapingProgress {
  url: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

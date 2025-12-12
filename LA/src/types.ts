/**
 * Basic facility info extracted from listing page
 */
export interface FacilitySummary {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  profileUrl: string;
}

/**
 * Complete facility record with all scraped details
 */
export interface FacilityRecord extends FacilitySummary {
  fax: string | null;
  licenseNumber: string | null;
  licenseLevel: string | null;
  capacity: number | null;
  services: string[];
  contactPerson: string | null;
  latitude: number | null;
  longitude: number | null;
}

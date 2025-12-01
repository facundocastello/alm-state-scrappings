export interface TNFacility {
  // Row number from HTML
  rowNumber: number;

  // Basic facility info
  facilityName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;

  // Administrator info
  administrator: string;

  // Owner info
  ownerName: string;
  ownerAddress: string;
  ownerCity: string;
  ownerState: string;
  ownerZip: string;
  ownerPhone: string;

  // License info
  licenseNumber: string;
  status: string;
  numberOfBeds: number;
  dateOfLastSurvey: string;
  dateOfOriginalLicensure: string;
  dateOfExpiration: string;
  accreditationExpires: string;

  // Management info
  managedBy: string;
  managedByLocation: string;

  // Disciplinary info
  disciplinaryActionCount: number;
  disciplinaryActionUrl: string;
  hasDisciplinaryActions: boolean;
}

export interface TNDisciplinaryAction {
  licenseNumber: string;
  facilityName: string;
  action: string;
  reason: string;
  actionDate: string;
  fileName: string;
  fileUrl: string;
}

export interface CSVRecord {
  facility_id: string;
  license_number: string;
  facility_name: string;
  facility_type: string;
  status: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  number_of_beds: number;
  administrator: string;
  owner_name: string;
  owner_address: string;
  owner_phone: string;
  date_of_original_licensure: string;
  date_of_expiration: string;
  date_of_last_survey: string;
  accreditation_expires: string;
  managed_by: string;
  managed_by_location: string;
  disciplinary_action_count: number;
  has_disciplinary_actions: string;
  disciplinary_action_url: string;
  scraped_at: string;
}

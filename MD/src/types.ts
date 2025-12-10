// ============================================================
// API Response Types - Search Endpoint
// ============================================================

export interface SearchResponse {
  assistedLivings: FacilitySummary[];
}

export interface FacilitySummary {
  assistedLivingId: number;
  providerId: string;
  name: string;
  location: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  zipCode: string;
  countyCode: string;
  county: string;
  phone: string;
  website: string | null;
  websiteDisplayText: string | null;
  privateRoomMinCostPerDay: number;
  privateRoomMaxCostPerDay: number;
  semiPrivateRoomMinCostPerDay: number;
  semiPrivateRoomMaxCostPerDay: number;
  tripleRoomMinCostPerDay: number;
  tripleRoomMaxCostPerDay: number;
  apartmentMinCostPerDay: number;
  apartmentMaxCostPerDay: number;
  hasSecureAlzheimersUnit: boolean;
  hasTransportationServices: boolean;
  distance: number | null;
  totalLicensedBeds: number;
  hasLessThan10Beds: boolean;
  hasProfile: boolean;
  participatinginMedicaidWaiver: boolean;
  isCcrc: boolean;
}

// ============================================================
// API Response Types - Profile Endpoint
// ============================================================

export interface ProfileResponse {
  assistedLivingId: number;
  facilityId: string;
  providerName: string;
  facDbaPriorName: string | null;
  facNameChangeDt: string | null;
  facNameAbbrev: string | null;
  facLastUpdated: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  phone: string;
  website: string | null;
  websiteDisplayText: string | null;
  imageUrl: string | null;
  imageUrlDefault: string | null;
  overview: OverviewData;
}

export interface OverviewData {
  privateRoomMinCostPerDay: number;
  privateRoomMaxCostPerDay: number;
  semiPrivateRoomMinCostPerDay: number;
  semiPrivateRoomMaxCostPerDay: number;
  tripleRoomMinCostPerDay: number;
  tripleRoomMaxCostPerDay: number;
  apartmentMinCostPerDay: number;
  apartmentMaxCostPerDay: number;
  dateFacilityFirstOpened: string | null;
  isForProfit: boolean;
  typeOfBusinessOrg: string;
  owner: string | null;
  levelofCare: string;
  totalLicensedBeds: number;
  participatinginMedicaidWaiver: boolean;
  influenzaGoldStar: boolean | null;
  influenzaMandatory: boolean | null;
  isCcrc: boolean;
  hasAlzheimerLevelMild: boolean;
  hasAlzheimerLevelMod: boolean;
  hasAlzheimerLevelSev: boolean;
  hasCnaTrainingProgram: boolean;
  hospiceAffiliations: HospiceAffiliation[] | null;
}

export interface HospiceAffiliation {
  hospiceAffiliationName: string;
}

// Separate Overview endpoint response (has hospiceAffiliations that Profile doesn't)
export interface OverviewResponse extends OverviewData {
  hospiceAffiliations: HospiceAffiliation[] | null;
}

// ============================================================
// API Response Types - StaffFluVacc Endpoint
// ============================================================

export interface StaffFluVaccResponse {
  isGoldStar: boolean;
  mandatoryPolicy: boolean;
  mandatoryCovidPolicy: boolean;
  mdVacRateAvg: number;
  vacRates: VaccinationRate[];
}

export interface VaccinationRate {
  timeframe: string;
  facVaccRate: number;
}

// ============================================================
// API Response Types - Inspect Endpoint
// ============================================================

export interface InspectResponse {
  latestDefCountSurvey: number | null;
  latestDefCountComplaint: number | null;
  latestStaffInfluenzaVaccMd: number;
  latestDefDateSurvey: string | null;
  latestDefDateComplaint: string | null;
  latestDefCountSurveyMd: number;
  latestDefCountComplaintMd: number;
  latestDefSurveyScopeLevel: string | null;
  latestDefComplaintScopeLevel: string | null;
  surveyInspections: Inspection[];
  complaintInspections: Inspection[];
  noDeficiencies: string[];
}

export interface Inspection {
  inspectionDate: string;
  deficiencyCount: number;
  scopeLevel: string;
  documentUrl?: string;
}

// ============================================================
// API Response Types - PatientChar Endpoint
// ============================================================

export interface PatientCharResponse {
  femalePct: number;
  malePct: number;
  genderUnknownPct: number;
  ageChart: ChartEntry[];
  raceChart: ChartEntry[];
  mdFemalePct: number;
  mdMalePct: number;
  mdGenderUnknownPct: number;
  mdAgeChart: ChartEntry[];
  mdRaceChart: ChartEntry[];
  ethHispanicPct: number;
  ethNonHispanicPct: number;
  ethUnknownPct: number;
  mdEthHispanicPct: number;
  mdEthNonHispanicPct: number;
  mdEthUnknownPct: number;
}

export interface ChartEntry {
  label: string;
  valuePct: number;
}

// ============================================================
// API Response Types - AvailableServices Endpoint
// ============================================================

export interface AvailableServicesResponse {
  hasSecureAlzheimersUnit: boolean | null;
  has24HourAwakeStaff: boolean | null;
  hasAlzheimersCare: boolean | null;
  hasBarberCare: boolean | null;
  hasBeautyCare: boolean | null;
  hasBehavioralManagement: boolean | null;
  hasCatheterCare: boolean | null;
  hasCentralIvTherapy: boolean | null;
  hasColostomyCare: boolean | null;
  hasDecubitusCare: boolean | null;
  hasDementiaCare: boolean | null;
  hasDialysis: boolean | null;
  hasDispenseMedications: boolean | null;
  hasHomeHealthAngencyServices: boolean | null;
  hasHospicecare: boolean | null;
  hasIncontinenceCare: boolean | null;
  hasLaundryServices: boolean | null;
  hasMeals: boolean | null;
  hasOccupationalTherapy: boolean | null;
  hasPeripheralIvTherapy: boolean | null;
  hasPeritonealDialysis: boolean | null;
  hasPersonalCare: boolean | null;
  hasPhysicalTherapy: boolean | null;
  hasPortableOxygenCare: boolean | null;
  hasRehabilitationCare: boolean | null;
  hasRespiteCare: boolean | null;
  hasSpeechLanguageTherapy: boolean | null;
  hasSuctioningCare: boolean | null;
  hasTotalParenteralNutrition: boolean | null;
  hasTracheostomyCare: boolean | null;
  hasTransportationServices: boolean | null;
  hasTubeFeeding: boolean | null;
  hasVentilatorCare: boolean | null;
  hasWanderGuard: boolean | null;
}

// Service name mapping for human-readable labels
export const SERVICE_LABELS: Record<keyof AvailableServicesResponse, string> = {
  hasSecureAlzheimersUnit: "Secure Alzheimer's Unit",
  has24HourAwakeStaff: "24-Hour Awake Staff",
  hasAlzheimersCare: "Alzheimer's Care",
  hasBarberCare: "Barber Services",
  hasBeautyCare: "Beauty Services",
  hasBehavioralManagement: "Behavioral Management",
  hasCatheterCare: "Catheter Care",
  hasCentralIvTherapy: "Central IV Therapy",
  hasColostomyCare: "Colostomy Care",
  hasDecubitusCare: "Decubitus Care",
  hasDementiaCare: "Dementia Care",
  hasDialysis: "Dialysis",
  hasDispenseMedications: "Dispense Medications",
  hasHomeHealthAngencyServices: "Home Health Agency Services",
  hasHospicecare: "Hospice Care",
  hasIncontinenceCare: "Incontinence Care",
  hasLaundryServices: "Laundry Services",
  hasMeals: "Meals",
  hasOccupationalTherapy: "Occupational Therapy",
  hasPeripheralIvTherapy: "Peripheral IV Therapy",
  hasPeritonealDialysis: "Peritoneal Dialysis",
  hasPersonalCare: "Personal Care",
  hasPhysicalTherapy: "Physical Therapy",
  hasPortableOxygenCare: "Portable Oxygen Care",
  hasRehabilitationCare: "Rehabilitation Care",
  hasRespiteCare: "Respite Care",
  hasSpeechLanguageTherapy: "Speech/Language Therapy",
  hasSuctioningCare: "Suctioning Care",
  hasTotalParenteralNutrition: "Total Parenteral Nutrition",
  hasTracheostomyCare: "Tracheostomy Care",
  hasTransportationServices: "Transportation Services",
  hasTubeFeeding: "Tube Feeding",
  hasVentilatorCare: "Ventilator Care",
  hasWanderGuard: "Wander Guard",
};

// ============================================================
// Domain Types - Facility Record
// ============================================================

export interface FacilityRecord {
  // Basic info
  assistedLivingId: number;
  facilityId: string;
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  phone: string;
  website: string | null;
  imageUrl: string | null;
  facLastUpdated: string;

  // Overview
  totalLicensedBeds: number;
  dateFacilityFirstOpened: string | null;
  isForProfit: boolean;
  typeOfBusinessOrg: string;
  owner: string | null;
  levelOfCare: string;
  isCcrc: boolean;
  participatinginMedicaidWaiver: boolean;

  // Costs
  privateRoomMinCostPerDay: number;
  privateRoomMaxCostPerDay: number;
  semiPrivateRoomMinCostPerDay: number;
  semiPrivateRoomMaxCostPerDay: number;
  tripleRoomMinCostPerDay: number;
  tripleRoomMaxCostPerDay: number;
  apartmentMinCostPerDay: number;
  apartmentMaxCostPerDay: number;

  // Alzheimer's care levels
  hasAlzheimerLevelMild: boolean;
  hasAlzheimerLevelMod: boolean;
  hasAlzheimerLevelSev: boolean;
  hasCnaTrainingProgram: boolean;

  // Hospice affiliations (pipe-separated)
  hospiceAffiliations: string;

  // Vaccination data
  hasInfluenzaGoldStar: boolean;
  hasMandatoryVaccPolicy: boolean;
  hasMandatoryCovidPolicy: boolean;
  vaccinationHistory: string; // "2023-2024 (41.05%), 2022-2023 (73.42%)"
  mdVacRateAvg: number;

  // Inspection summary
  latestDefCountSurvey: number | null;
  latestDefCountComplaint: number | null;
  latestDefCountSurveyMd: number;
  latestDefCountComplaintMd: number;

  // Services (comma-separated)
  servicesIncluded: string;
  servicesExcluded: string;

  // Patient demographics
  femalePct: number;
  malePct: number;
  ageDistribution: string; // "85-94 (52.63%), 95+ (36.84%), ..."
  raceDistribution: string; // "White (75.44%), African American (24.56%)"

  // Metadata
  scrapedAt: string;
}

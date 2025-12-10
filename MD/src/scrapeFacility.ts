import { config } from './config.js';
import { fetchJson } from './http.js';
import {
  FacilitySummary,
  ProfileResponse,
  OverviewResponse,
  StaffFluVaccResponse,
  InspectResponse,
  PatientCharResponse,
  AvailableServicesResponse,
  FacilityRecord,
  SERVICE_LABELS,
  ChartEntry,
} from './types.js';

/**
 * Format vaccination history as "2023-2024 (41.05%), 2022-2023 (73.42%)"
 */
function formatVaccinationHistory(vaccData: StaffFluVaccResponse): string {
  if (!vaccData.vacRates || vaccData.vacRates.length === 0) {
    return '';
  }

  return vaccData.vacRates
    .filter((rate) => rate.facVaccRate != null)
    .map((rate) => `${rate.timeframe} (${rate.facVaccRate.toFixed(2)}%)`)
    .join(', ');
}

/**
 * Format age distribution as "85-94 (52.63%), 95+ (36.84%), ..."
 * Sorted by highest percentage first, filtered to non-zero values
 */
function formatAgeDistribution(ageChart: ChartEntry[]): string {
  if (!ageChart || ageChart.length === 0) {
    return '';
  }

  // Map labels to human-readable format
  const labelMap: Record<string, string> = {
    'AGE_65-74_YEARS_%': '65-74',
    'AGE_75-84_YEARS_%': '75-84',
    'AGE_85-94_YEARS_%': '85-94',
    'AGE_GTE95_YEARS_%': '95+',
    'AGE_LTE64_YEARS_%': '≤64',
    'AGE_UNKNOWN_%': 'Unknown',
  };

  return ageChart
    .filter((entry) => entry.valuePct > 0)
    .sort((a, b) => b.valuePct - a.valuePct)
    .map((entry) => {
      const label = labelMap[entry.label] || entry.label;
      return `${label} (${entry.valuePct.toFixed(2)}%)`;
    })
    .join(', ');
}

/**
 * Format race distribution as "White (75.44%), African American (24.56%)"
 * Sorted by highest percentage first, filtered to non-zero values
 */
function formatRaceDistribution(raceChart: ChartEntry[]): string {
  if (!raceChart || raceChart.length === 0) {
    return '';
  }

  // Map labels to human-readable format
  const labelMap: Record<string, string> = {
    African: 'African American',
    AmericanIndian: 'American Indian',
    Asian: 'Asian',
    Hawaiian: 'Hawaiian/Pacific Islander',
    Hispanic: 'Hispanic',
    Mixed: 'Mixed Race',
    Other: 'Other',
    White: 'White',
  };

  return raceChart
    .filter((entry) => entry.valuePct > 0)
    .sort((a, b) => b.valuePct - a.valuePct)
    .map((entry) => {
      const label = labelMap[entry.label] || entry.label;
      return `${label} (${entry.valuePct.toFixed(2)}%)`;
    })
    .join(', ');
}

/**
 * Format services into included and excluded comma-separated lists
 */
function formatServices(services: AvailableServicesResponse): {
  included: string;
  excluded: string;
} {
  const included: string[] = [];
  const excluded: string[] = [];

  for (const [key, label] of Object.entries(SERVICE_LABELS)) {
    const value = services[key as keyof AvailableServicesResponse];
    if (value === true) {
      included.push(label);
    } else if (value === false) {
      excluded.push(label);
    }
    // null values are ignored as per scrapeinfo.txt instructions
  }

  return {
    included: included.join(', '),
    excluded: excluded.join(', '),
  };
}

/**
 * Fetch all profile data for a single facility
 */
export async function scrapeFacility(
  summary: FacilitySummary
): Promise<FacilityRecord> {
  const id = summary.assistedLivingId;

  // Fetch all endpoints in parallel
  const [profile, overviewData, vaccData, inspectData, patientChar, services] =
    await Promise.all([
      fetchJson<ProfileResponse>(config.endpoints.profile(id)),
      fetchJson<OverviewResponse>(config.endpoints.overview(id)).catch(
        () => null
      ),
      fetchJson<StaffFluVaccResponse>(config.endpoints.staffFluVacc(id)).catch(
        () => null
      ),
      fetchJson<InspectResponse>(config.endpoints.inspect(id)).catch(
        () => null
      ),
      fetchJson<PatientCharResponse>(config.endpoints.patientChar(id)).catch(
        () => null
      ),
      fetchJson<AvailableServicesResponse>(
        config.endpoints.availableServices(id)
      ).catch(() => null),
    ]);

  // Format hospice affiliations (from Overview endpoint, not Profile)
  const hospiceAffiliations =
    overviewData?.hospiceAffiliations
      ?.map((h) => h.hospiceAffiliationName)
      .join(' | ') || '';

  // Format vaccination history
  const vaccinationHistory = vaccData
    ? formatVaccinationHistory(vaccData)
    : '';

  // Format services
  const formattedServices = services
    ? formatServices(services)
    : { included: '', excluded: '' };

  // Format demographics
  const ageDistribution = patientChar
    ? formatAgeDistribution(patientChar.ageChart)
    : '';
  const raceDistribution = patientChar
    ? formatRaceDistribution(patientChar.raceChart)
    : '';

  const record: FacilityRecord = {
    // Basic info
    assistedLivingId: profile.assistedLivingId,
    facilityId: profile.facilityId,
    name: profile.providerName,
    address1: profile.address1,
    address2: profile.address2,
    city: profile.city,
    state: profile.state,
    zipCode: profile.zipCode,
    county: profile.county,
    phone: profile.phone,
    website: profile.website,
    imageUrl: profile.imageUrl,
    facLastUpdated: profile.facLastUpdated,

    // Overview
    totalLicensedBeds: profile.overview.totalLicensedBeds,
    dateFacilityFirstOpened: profile.overview.dateFacilityFirstOpened,
    isForProfit: profile.overview.isForProfit,
    typeOfBusinessOrg: profile.overview.typeOfBusinessOrg,
    owner: profile.overview.owner,
    levelOfCare: profile.overview.levelofCare,
    isCcrc: profile.overview.isCcrc,
    participatinginMedicaidWaiver: profile.overview.participatinginMedicaidWaiver,

    // Costs
    privateRoomMinCostPerDay: profile.overview.privateRoomMinCostPerDay,
    privateRoomMaxCostPerDay: profile.overview.privateRoomMaxCostPerDay,
    semiPrivateRoomMinCostPerDay: profile.overview.semiPrivateRoomMinCostPerDay,
    semiPrivateRoomMaxCostPerDay: profile.overview.semiPrivateRoomMaxCostPerDay,
    tripleRoomMinCostPerDay: profile.overview.tripleRoomMinCostPerDay,
    tripleRoomMaxCostPerDay: profile.overview.tripleRoomMaxCostPerDay,
    apartmentMinCostPerDay: profile.overview.apartmentMinCostPerDay,
    apartmentMaxCostPerDay: profile.overview.apartmentMaxCostPerDay,

    // Alzheimer's care levels
    hasAlzheimerLevelMild: profile.overview.hasAlzheimerLevelMild,
    hasAlzheimerLevelMod: profile.overview.hasAlzheimerLevelMod,
    hasAlzheimerLevelSev: profile.overview.hasAlzheimerLevelSev,
    hasCnaTrainingProgram: profile.overview.hasCnaTrainingProgram,

    // Hospice affiliations
    hospiceAffiliations,

    // Vaccination data
    hasInfluenzaGoldStar: vaccData?.isGoldStar ?? false,
    hasMandatoryVaccPolicy: vaccData?.mandatoryPolicy ?? false,
    hasMandatoryCovidPolicy: vaccData?.mandatoryCovidPolicy ?? false,
    vaccinationHistory,
    mdVacRateAvg: vaccData?.mdVacRateAvg ?? 0,

    // Inspection summary
    latestDefCountSurvey: inspectData?.latestDefCountSurvey ?? null,
    latestDefCountComplaint: inspectData?.latestDefCountComplaint ?? null,
    latestDefCountSurveyMd: inspectData?.latestDefCountSurveyMd ?? 0,
    latestDefCountComplaintMd: inspectData?.latestDefCountComplaintMd ?? 0,

    // Services
    servicesIncluded: formattedServices.included,
    servicesExcluded: formattedServices.excluded,

    // Patient demographics
    femalePct: patientChar?.femalePct ?? 0,
    malePct: patientChar?.malePct ?? 0,
    ageDistribution,
    raceDistribution,

    // Metadata
    scrapedAt: new Date().toISOString(),
  };

  return record;
}

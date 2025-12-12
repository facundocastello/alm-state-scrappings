import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import type { AssistedHousingFacility, NursingHomeFacility } from './types.js';

// Ensure output directory exists
function ensureOutputDir(): void {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
}

// ============================================
// Assisted Housing CSV
// ============================================

const assistedHousingHeaders = [
  { id: 'licenseNumber', title: 'license_number' },
  { id: 'name', title: 'facility_name' },
  { id: 'profession', title: 'profession' },
  { id: 'status', title: 'license_status' },
  { id: 'street', title: 'street' },
  { id: 'city', title: 'city' },
  { id: 'state', title: 'state' },
  { id: 'zip', title: 'zip' },
  { id: 'phone', title: 'phone' },
  { id: 'fax', title: 'fax' },
  { id: 'firstLicensure', title: 'first_licensure' },
  { id: 'expirationDate', title: 'expiration_date' },
  { id: 'totalCapacity', title: 'total_capacity' },
  { id: 'adaAccessible', title: 'ada_accessible' },
  { id: 'primaryAdministrator', title: 'primary_administrator' },
  { id: 'primaryOwner', title: 'primary_owner' },
  { id: 'specialtiesCount', title: 'specialties_count' },
  { id: 'specialtiesSummary', title: 'specialties' },
  { id: 'licenseHistoryCount', title: 'license_history_count' },
  { id: 'licenseHistorySummary', title: 'license_history' },
  { id: 'inspectionsTotal', title: 'inspections_total' },
  { id: 'inspectionsNoDeficiencies', title: 'inspections_no_deficiencies' },
  { id: 'inspectionsWithDeficiencies', title: 'inspections_with_deficiencies' },
  { id: 'documentsCount', title: 'documents_count' },
  { id: 'documentsSummary', title: 'documents' },
  { id: 'detailUrl', title: 'detail_url' },
  { id: 'scrapedAt', title: 'scraped_at' },
];

export async function writeAssistedHousingCsv(
  facilities: AssistedHousingFacility[]
): Promise<string> {
  ensureOutputDir();

  const outputPath = path.join(config.outputDir, 'assisted-housing.csv');

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: assistedHousingHeaders,
  });

  const records = facilities.map(facility => {
    // Count inspections by status
    const inspectionsNoDeficiencies = facility.inspections.filter(
      i => i.status.toLowerCase().includes('no deficiencies')
    ).length;
    const inspectionsWithDeficiencies = facility.inspections.filter(
      i => i.status.toLowerCase().includes('deficiencies') &&
           !i.status.toLowerCase().includes('no deficiencies')
    ).length;

    // Count documents
    const documentsCount = facility.inspections.reduce(
      (sum, insp) => sum + insp.documents.length,
      0
    );

    // Summarize specialties
    const specialtiesSummary = facility.specialties
      .map(s => `${s.description} (${s.capacity || '?'} capacity, ${s.status})`)
      .join(' | ');

    // Summarize license history
    const licenseHistorySummary = facility.licenseHistory
      .map(h => `${h.licenseType}: ${h.startDate} - ${h.endDate}`)
      .join(' | ');

    // Summarize documents
    const documentsSummary = facility.inspections
      .flatMap(insp =>
        insp.documents.map(doc => {
          const parts = [insp.date, doc.type];
          if (doc.localPath) {
            parts.push(doc.localPath);
          }
          return parts.join(' :: ');
        })
      )
      .join(' | ');

    return {
      licenseNumber: facility.licenseNumber,
      name: facility.name,
      profession: facility.profession,
      status: facility.status,
      street: facility.street,
      city: facility.city,
      state: facility.state,
      zip: facility.zip,
      phone: facility.phone,
      fax: facility.fax,
      firstLicensure: facility.firstLicensure,
      expirationDate: facility.expirationDate,
      totalCapacity: facility.totalCapacity ?? '',
      adaAccessible: facility.adaAccessible != null ? (facility.adaAccessible ? 'Yes' : 'No') : '',
      primaryAdministrator: facility.primaryAdministrator,
      primaryOwner: facility.primaryOwner,
      specialtiesCount: facility.specialties.length,
      specialtiesSummary,
      licenseHistoryCount: facility.licenseHistory.length,
      licenseHistorySummary,
      inspectionsTotal: facility.inspections.length,
      inspectionsNoDeficiencies,
      inspectionsWithDeficiencies,
      documentsCount,
      documentsSummary,
      detailUrl: facility.detailUrl,
      scrapedAt: facility.scrapedAt,
    };
  });

  await csvWriter.writeRecords(records);
  console.log(`Assisted Housing CSV saved to ${outputPath} (${facilities.length} facilities)`);

  return outputPath;
}

// ============================================
// Nursing Home / Hospice CSV
// ============================================

const nursingHomeHeaders = [
  { id: 'facilityId', title: 'facility_id' },
  { id: 'facilityType', title: 'facility_type' },
  { id: 'name', title: 'facility_name' },
  { id: 'providerType', title: 'provider_type' },
  { id: 'license', title: 'license' },
  { id: 'street', title: 'street' },
  { id: 'city', title: 'city' },
  { id: 'state', title: 'state' },
  { id: 'zip', title: 'zip' },
  { id: 'phone', title: 'phone' },
  { id: 'fax', title: 'fax' },
  { id: 'administrator', title: 'administrator' },
  { id: 'surveyCount', title: 'survey_count' },
  { id: 'mapUrl', title: 'map_url' },
  { id: 'scrapedAt', title: 'scraped_at' },
];

export async function writeNursingHomeCsv(
  facilities: NursingHomeFacility[],
  filename: string = 'nursing-homes.csv'
): Promise<string> {
  ensureOutputDir();

  const outputPath = path.join(config.outputDir, filename);

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: nursingHomeHeaders,
  });

  const records = facilities.map(facility => ({
    facilityId: facility.facilityId,
    facilityType: facility.facilityType,
    name: facility.name,
    providerType: facility.providerType,
    license: facility.license,
    street: facility.street,
    city: facility.city,
    state: facility.state,
    zip: facility.zip,
    phone: facility.phone,
    fax: facility.fax,
    administrator: facility.administrator,
    surveyCount: facility.surveyCount,
    mapUrl: facility.mapUrl,
    scrapedAt: facility.scrapedAt,
  }));

  await csvWriter.writeRecords(records);
  console.log(`CSV saved to ${outputPath} (${facilities.length} facilities)`);

  return outputPath;
}

/**
 * Write hospice facilities to CSV
 */
export async function writeHospiceCsv(facilities: NursingHomeFacility[]): Promise<string> {
  return writeNursingHomeCsv(facilities, 'hospice.csv');
}

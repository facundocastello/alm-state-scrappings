import { httpClient } from "./http.js";
import { FACILITY_URL, CHECKLIST_URL } from "./config.js";
import type {
  FacilitySummary,
  FacilityApiResponse,
  FacilityDetail,
  FacilityRecord,
  Checklist,
  Inspection,
} from "./types.js";

const mapInspection = (apiInspection: FacilityApiResponse["inspections"][number]): Inspection => {
  return {
    inspectionDate: apiInspection.inspectionDate,
    inspectionTypes: apiInspection.inspectionTypes,
    checklistIds: apiInspection.checklistIds,
    findings: apiInspection.findings,
    underAppeal: apiInspection.underAppeal,
  };
};

const extractChecklists = (inspections: FacilityApiResponse["inspections"]): Checklist[] => {
  const checklists: Checklist[] = [];

  for (const inspection of inspections) {
    for (const checklistId of inspection.checklistIds) {
      checklists.push({
        checklistId,
        inspectionDate: inspection.inspectionDate,
        inspectionTypes: inspection.inspectionTypes,
        downloadUrl: CHECKLIST_URL(checklistId),
      });
    }
  }

  return checklists;
};

export const scrapeFacility = async (summary: FacilitySummary): Promise<FacilityRecord> => {
  const url = FACILITY_URL(summary.fid);
  const response = await httpClient.get(url).json<FacilityApiResponse>();

  const inspections = response.inspections.map(mapInspection);
  const checklists = extractChecklists(response.inspections);

  const detail: FacilityDetail = {
    idNumber: response.idNumber,
    licenseType: response.licenseType,
    capacity: response.capacity,
    status: response.status,
    specialties: response.specialties,
    initialRegulationDate: response.initialRegulationDate,
    expirationDate: response.expirationDate,
    conditional: response.conditional,
    inspections,
    checklists,
  };

  const inspectionsWithFindings = inspections.filter(
    (i: Inspection) => i.findings.length > 0
  ).length;

  const record: FacilityRecord = {
    ...summary,
    ...detail,
    inspectionsTotal: inspections.length,
    inspectionsWithFindings,
    checklistsTotal: checklists.length,
    scrapedAt: new Date().toISOString(),
  };

  return record;
};

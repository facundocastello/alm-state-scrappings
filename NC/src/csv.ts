import { createObjectCsvWriter } from "csv-writer";
import { CSV_OUTPUT_PATH, OUTPUT_DIR } from "./config.js";
import type { FacilityRecord, StatementOfDeficiency } from "./types.js";
import { ensureDir } from "./utils.js";

const headers = [
  { id: "facility_id", title: "facility_id" },
  { id: "county", title: "county" },
  { id: "name", title: "facility_name" },
  { id: "license", title: "license_number" },
  { id: "siteAddress", title: "site_address" },
  { id: "siteCity", title: "site_city" },
  { id: "siteState", title: "site_state" },
  { id: "siteZip", title: "site_zip" },
  { id: "capacity", title: "capacity" },
  { id: "score", title: "search_score" },
  { id: "starsValue", title: "search_stars" },
  { id: "latestRatingStars", title: "latest_rating_stars" },
  { id: "latestRatingScore", title: "latest_rating_score" },
  { id: "latestRatingIssueDate", title: "latest_rating_issue_date" },
  { id: "latestRatingInspectionType", title: "latest_rating_inspection_type" },
  { id: "latestRatingMerits", title: "latest_rating_merits" },
  { id: "latestRatingDemerits", title: "latest_rating_demerits" },
  { id: "totalStarEntries", title: "star_entries" },
  { id: "inspectionsTotal", title: "inspections_total" },
  { id: "inspectionsWithDeficiencies", title: "inspections_with_deficiencies" },
  { id: "inspectionsWithoutDeficiencies", title: "inspections_without_deficiencies" },
  { id: "statementsWithDocuments", title: "statements_with_documents" },
  { id: "worksheetCount", title: "worksheet_count" },
  { id: "profileUrl", title: "URL_DETAIL" },
  { id: "documentsSummary", title: "documents" },
];

export const writeFacilitiesCsv = async (
  facilities: FacilityRecord[],
  silent = false
): Promise<void> => {
  await ensureDir(OUTPUT_DIR);

  const csvWriter = createObjectCsvWriter({
    path: CSV_OUTPUT_PATH,
    header: headers,
  });

  const records = facilities.map((facility) => {
    const latest = facility.latestRating;
    const statementsWithDocuments = facility.statements.filter(
      (s: StatementOfDeficiency) => Boolean(s.documentUrl)
    ).length;
    const documentsSummary = facility.statements
      .map((s: StatementOfDeficiency) => {
        const parts = [s.inspectionDate, s.inspectionType, s.documentType];
        if (s.localPath) {
          parts.push(s.localPath);
        } else if (s.documentUrl) {
          parts.push(s.documentUrl);
        }
        return parts.filter(Boolean).join(" :: ");
      })
      .join(" | ");

    return {
      ...facility,
      facility_id: facility.fid,
      latestRatingStars: latest?.starsValue ?? latest?.starsLabel ?? "",
      latestRatingScore: latest?.score ?? "",
      latestRatingIssueDate: latest?.issueDate ?? "",
      latestRatingInspectionType: latest?.inspectionType ?? "",
      latestRatingMerits: latest?.merits ?? "",
      latestRatingDemerits: latest?.demerits ?? "",
      totalStarEntries: facility.starRatings.length,
      statementsWithDocuments,
      documentsSummary,
    };
  });

  await csvWriter.writeRecords(records);
  if (!silent) {
    console.log(`CSV saved to ${CSV_OUTPUT_PATH} (${facilities.length} facilities)`);
  }
};


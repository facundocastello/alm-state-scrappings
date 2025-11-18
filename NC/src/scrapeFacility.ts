import { load, type CheerioAPI } from "cheerio";

import { httpClient } from "./http.js";
import type {
  FacilityRecord,
  FacilitySummary,
  StarRatingEntry,
  StatementOfDeficiency,
} from "./types.js";
import { cleanText, parseNumber } from "./utils.js";
import { downloadReports } from "./reportDownloader.js";

interface FacilityInfo {
  licenseNumber: string;
  siteAddress: string;
  siteCity: string;
  siteState: string;
  siteZip: string;
  capacity: number | null;
  county: string;
}

const parseFacilityInfo = ($: CheerioAPI): FacilityInfo => {
  const info: Record<string, string> = {};

  $("#facilinfo table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;
    const key = cleanText(cells.eq(0).text()).replace(/:$/, "");
    const valueHtml = cells.eq(1).html() ?? "";
    const value = cleanText(valueHtml.replace(/<br\s*\/?>/gi, "\n"));
    info[key] = value;
  });

  const siteAddressRaw = info["Site Address"] ?? "";
  const [street, cityLineRaw] = siteAddressRaw
    .split("\n")
    .map((line) => cleanText(line));

  let siteCity = "";
  let siteState = "";
  let siteZip = "";

  if (cityLineRaw) {
    const cityStateZipMatch = cityLineRaw.match(/^(.*?),\s*([A-Z]{2})\s+(\d{5})/);
    if (cityStateZipMatch) {
      const [, city, state, zip] = cityStateZipMatch;
      if (city) siteCity = cleanText(city);
      if (state) siteState = state;
      if (zip) siteZip = zip;
    } else {
      siteCity = cityLineRaw;
    }
  }

  const capacity = parseNumber(info["Capacity"]);

  return {
    licenseNumber: info["License Number"] ?? "",
    siteAddress: street || siteAddressRaw,
    siteCity: siteCity || "",
    siteState,
    siteZip,
    capacity,
    county: info["County"] ?? "",
  };
};

const parseStatements = (
  $: CheerioAPI,
  profileUrl: string
): StatementOfDeficiency[] => {
  const statements: StatementOfDeficiency[] = [];
  $("#sodlist tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 5) return;

    const documentCell = cells.eq(1);
    const link = documentCell.find("a");
    const documentUrl = link.length ? new URL(link.attr("href") ?? "", profileUrl).toString() : undefined;
    const documentType = cleanText(documentCell.text());

    const hasDeficiencies =
      Boolean(link.length) ||
      /statement of deficiency/i.test(documentType) ||
      /plan of correction/i.test(documentType);

    statements.push({
      inspectionType: cleanText(cells.eq(0).text()),
      documentType,
      inspectionDate: cleanText(cells.eq(2).text()),
      pages: cleanText(cells.eq(3).text()),
      idrPending: cleanText(cells.eq(4).text()),
      documentUrl,
      hasDeficiencies,
    });
  });

  return statements;
};

const parseStarRatings = (
  $: CheerioAPI,
  profileUrl: string
): StarRatingEntry[] => {
  const rows: StarRatingEntry[] = [];
  $("#star tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 8) return;

    const starImgAlt = cleanText(cells.eq(0).find("img").attr("alt") ?? cells.eq(0).text());

    const worksheetLink = cells.eq(7).find("a").attr("href");
    const rawScore = parseNumber(cells.eq(2).text());

    rows.push({
      starsLabel: starImgAlt,
      starsValue: cleanText(cells.eq(1).text()),
      score: rawScore != null && rawScore < 0 ? Math.abs(rawScore) : rawScore,
      issueDate: cleanText(cells.eq(3).text()),
      merits: parseNumber(cells.eq(4).text()),
      demerits: parseNumber(cells.eq(5).text()),
      inspectionType: cleanText(cells.eq(6).text()),
      worksheetUrl: worksheetLink
        ? new URL(worksheetLink, profileUrl).toString()
        : undefined,
    });
  });
  return rows;
};

const buildFacilityDetail = (
  summary: FacilitySummary,
  detail: FacilityInfo,
  statements: StatementOfDeficiency[],
  starRatings: StarRatingEntry[]
): FacilityRecord => {
  const inspectionsTotal = statements.length;
  const inspectionsWithDeficiencies = statements.filter((s) => s.hasDeficiencies).length;
  const inspectionsWithoutDeficiencies = inspectionsTotal - inspectionsWithDeficiencies;

  const sortedRatings = [...starRatings].sort((a, b) => {
    const timeA = Date.parse(a.issueDate);
    const timeB = Date.parse(b.issueDate);
    if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) {
      return 0;
    }
    return timeB - timeA;
  });

  const latestRating = sortedRatings[0];

  return {
    ...summary,
    siteAddress: detail.siteAddress,
    siteCity: detail.siteCity || summary.city,
    siteState: detail.siteState || "NC",
    siteZip: detail.siteZip || summary.zip,
    capacity: detail.capacity,
    statements,
    starRatings,
    latestRating,
    inspectionsTotal,
    inspectionsWithDeficiencies,
    inspectionsWithoutDeficiencies,
    worksheetCount: starRatings.filter((entry) => Boolean(entry.worksheetUrl)).length,
  };
};

export const scrapeFacility = async (
  summary: FacilitySummary
): Promise<FacilityRecord> => {
  const response = await httpClient.get(summary.profileUrl);
  const $ = load(response.body);

  const info = parseFacilityInfo($);
  const statements = parseStatements($, summary.profileUrl);
  const starRatings = parseStarRatings($, summary.profileUrl);

  await downloadReports(summary.fid, statements);

  return buildFacilityDetail(summary, info, statements, starRatings);
};


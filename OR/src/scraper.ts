/**
 * Web Scraper for Oregon Healthcare Facility Data
 * Scrapes surveys, violations, and notices from the web portal
 */
import * as cheerio from "cheerio";
import { httpClient, delay, ScrapingError } from "./http.js";
import { ENDPOINTS } from "./config.js";
import type {
  FacilityFromAPI,
  Survey,
  SurveyCitation,
  CitationDetails,
  Violation,
  Notice,
  ScrapedFacility,
} from "./types.js";

export { ScrapingError } from "./http.js";

/**
 * Parse surveys/inspections from the web portal
 */
export async function scrapeSurveys(facilityId: string): Promise<Survey[]> {
  const url = ENDPOINTS.surveys(facilityId);
  const surveys: Survey[] = [];

  try {
    const response = await httpClient.get(url);
    const $ = cheerio.load(response.body);

    // Find the survey table rows
    $("table tbody tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 4) {
        const date = $(cells[0]).text().trim();
        const reportNumber = $(cells[1]).text().trim();
        const categoryTypesText = $(cells[2]).text().trim();
        const deficiencyCountText = $(cells[3]).text().trim();

        if (reportNumber) {
          surveys.push({
            date,
            reportNumber,
            categoryTypes: categoryTypesText
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            deficiencyCount: parseInt(deficiencyCountText, 10) || 0,
          });
        }
      }
    });
  } catch (error) {
    console.error(`  Error scraping surveys for ${facilityId}:`, error);
  }

  return surveys;
}

/**
 * Parse survey citations/details for a specific survey
 */
export async function scrapeSurveyCitations(
  reportNumber: string
): Promise<SurveyCitation[]> {
  const url = ENDPOINTS.surveyCites(reportNumber);
  const citations: SurveyCitation[] = [];

  try {
    const response = await httpClient.get(url);
    const $ = cheerio.load(response.body);

    // Find citation table rows (they have data-href with link to details)
    $("table tbody tr.ajax-clickable-row, table tbody tr").each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td");
      if (cells.length >= 4) {
        const tagId = $(cells[0]).text().trim();
        const tagTitle = $(cells[1]).text().trim();
        const levelText = $(cells[2]).text().trim();
        const visitsText = $(cells[3]).html() || "";

        // Parse visits from HTML (format: "t  : 7/22/2025 <br>")
        const visits: Array<{ visitNum: number; date: string }> = [];

        // Try the original format first (1 - 10/13/2023)
        const visitMatches = visitsText.matchAll(/(\d+)\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/g);
        for (const match of visitMatches) {
          visits.push({
            visitNum: parseInt(match[1], 10),
            date: match[2],
          });
        }

        // Also try alternative format (t : 7/22/2025)
        if (visits.length === 0) {
          const altMatches = visitsText.matchAll(/([a-z])\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/gi);
          let visitNum = 1;
          for (const match of altMatches) {
            visits.push({
              visitNum: visitNum++,
              date: match[2],
            });
          }
        }

        if (tagId) {
          citations.push({
            tagId,
            tagTitle,
            level: parseInt(levelText, 10) || 0,
            visits,
          });
        }
      }
    });
  } catch (error) {
    // Survey citations may not exist for all surveys
    console.error(`  Error scraping citations for ${reportNumber}:`, error);
  }

  return citations;
}

/**
 * Fetch detailed citation info from /SurveyCites/Details/{reportNumber}?tag={tagId}
 */
export async function scrapeCitationDetails(
  reportNumber: string,
  tagId: string
): Promise<CitationDetails | null> {
  const url = ENDPOINTS.citationDetails(reportNumber, tagId);

  try {
    const response = await httpClient.get(url);
    const $ = cheerio.load(response.body);

    // Extract from definition list structure
    const dl = $("dl.dl-horizontal");

    const reportNum = dl.find('dt:contains("Report Number")').next("dd").text().trim();
    const tag = dl.find('dt:contains("Tag ID")').next("dd").text().trim();
    const title = dl.find('dt:contains("Tag Title")').next("dd").text().trim();

    // The last <dd> contains all the visit details, rule text, findings, and POC
    const detailsDD = dl.find("dd").last();

    // Parse visit details (can be multiple visits)
    const visitDetails: CitationDetails["visitDetails"] = [];
    detailsDD.find(".col-md-2").each((i, el) => {
      const visitType = $(el).find("strong").text().trim();
      const visitDateDiv = $(el).next(".col-md-3");
      const correctedDateDiv = visitDateDiv.next(".col-md-3");

      const visitDateMatch = visitDateDiv.text().match(/Visit Date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      const correctedDateMatch = correctedDateDiv.text().match(/Corrected Date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);

      if (visitDateMatch) {
        visitDetails.push({
          visitType,
          visitDate: visitDateMatch[1],
          correctedDate: correctedDateMatch ? correctedDateMatch[1] : null,
        });
      }
    });

    // Extract rule text and findings from the Details section
    // The content after "Details:" and before "Plan of Correction:" contains rule + findings
    let ruleText = "";
    let findings = "";

    const detailsSection = detailsDD.find('.col-md-12:contains("Details:")').next(".col-md-12");
    const fullText = detailsSection.find("p").text().trim();

    // The rule text typically contains "This Rule is not met as evidenced by:"
    // Everything before that is the rule, everything after is findings
    const evidenceMarker = /This Rule is not met as evidenced by:\s*/i;
    const evidenceMatch = fullText.match(evidenceMarker);

    if (evidenceMatch) {
      const splitIndex = fullText.indexOf(evidenceMatch[0]);
      ruleText = fullText.substring(0, splitIndex).trim();
      findings = fullText.substring(splitIndex + evidenceMatch[0].length).trim();
    } else {
      // If no marker, treat entire text as findings
      findings = fullText;
    }

    // Extract Plan of Correction
    const pocSection = detailsDD.find('.col-md-12:contains("Plan of Correction:")').next(".col-md-12");
    const planOfCorrection = pocSection.text().trim();

    return {
      reportNumber: reportNum || reportNumber,
      tagId: tag || tagId,
      tagTitle: title,
      ruleText,
      findings,
      planOfCorrection,
      visitDetails,
    };
  } catch (error) {
    console.error(`  Error scraping citation details for ${reportNumber}/${tagId}:`, error);
    return null;
  }
}

/**
 * Parse violations from the web portal
 */
export async function scrapeViolations(facilityId: string): Promise<Violation[]> {
  const url = ENDPOINTS.violations(facilityId);
  const violations: Violation[] = [];

  try {
    const response = await httpClient.get(url);
    const $ = cheerio.load(response.body);

    // Check for abuse violations
    const abuseSection = $('h2:contains("Abuse"), h3:contains("Abuse")').next();
    if (abuseSection.length) {
      // Look for violation entries in abuse section
      abuseSection.find("table tbody tr, li, p").each((_, el) => {
        const text = $(el).text().trim();
        if (text && !text.includes("No abuse history")) {
          violations.push({
            type: "abuse",
            description: text,
          });
        }
      });
    }

    // Check for licensing violations
    const licensingSection = $(
      'h2:contains("Licensing"), h3:contains("Licensing")'
    ).next();
    if (licensingSection.length) {
      licensingSection.find("table tbody tr, li, p").each((_, el) => {
        const text = $(el).text().trim();
        if (text && !text.includes("No licensing violations")) {
          violations.push({
            type: "licensing",
            description: text,
          });
        }
      });
    }

    // Alternative: check for any table with violation data
    $("table").each((_, table) => {
      const tableText = $(table).text().toLowerCase();
      if (
        tableText.includes("violation") ||
        tableText.includes("abuse") ||
        tableText.includes("licensing")
      ) {
        $(table)
          .find("tbody tr")
          .each((_, row) => {
            const cells = $(row).find("td");
            if (cells.length >= 2) {
              const type = $(cells[0]).text().trim().toLowerCase();
              const description = $(cells[1]).text().trim();

              if (description && !description.includes("No ")) {
                violations.push({
                  type: type.includes("abuse") ? "abuse" : "licensing",
                  description,
                });
              }
            }
          });
      }
    });
  } catch (error) {
    console.error(`  Error scraping violations for ${facilityId}:`, error);
  }

  return violations;
}

/**
 * Parse notices from the web portal
 */
export async function scrapeNotices(facilityId: string): Promise<Notice[]> {
  const url = ENDPOINTS.notices(facilityId);
  const notices: Notice[] = [];

  try {
    const response = await httpClient.get(url);
    const $ = cheerio.load(response.body);

    // Look for notice entries in tables or lists
    $("table tbody tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const type = $(cells[0]).text().trim();
        const description = $(cells[1]).text().trim();

        if (type && !description.includes("No condition notices")) {
          notices.push({
            type,
            description,
          });
        }
      }
    });

    // Also check for list items
    $("ul li, ol li").each((_, el) => {
      const text = $(el).text().trim();
      if (text && !text.includes("No condition") && !text.includes("No notice")) {
        notices.push({
          type: "notice",
          description: text,
        });
      }
    });
  } catch (error) {
    console.error(`  Error scraping notices for ${facilityId}:`, error);
  }

  return notices;
}

/**
 * Scrape all data for a single facility (parallelized)
 * Throws ScrapingError if critical data fails to fetch
 */
export async function scrapeFacility(
  facility: FacilityFromAPI
): Promise<ScrapedFacility> {
  const facilityId = facility.FacilityID;
  console.log(`  Scraping ${facilityId}: ${facility.FacilityName}`);

  // Track errors
  const errors: string[] = [];

  // Parallel: fetch surveys, violations, and notices simultaneously
  const [surveysResult, violationsResult, noticesResult] = await Promise.allSettled([
    scrapeSurveys(facilityId),
    scrapeViolations(facilityId),
    scrapeNotices(facilityId),
  ]);

  // Extract results or track errors
  let surveys: Survey[] = [];
  let violations: Violation[] = [];
  let notices: Notice[] = [];

  if (surveysResult.status === "fulfilled") {
    surveys = surveysResult.value;
  } else {
    errors.push(`surveys: ${surveysResult.reason}`);
  }

  if (violationsResult.status === "fulfilled") {
    violations = violationsResult.value;
  } else {
    errors.push(`violations: ${violationsResult.reason}`);
  }

  if (noticesResult.status === "fulfilled") {
    notices = noticesResult.value;
  } else {
    errors.push(`notices: ${noticesResult.reason}`);
  }

  // If surveys failed, this is critical - throw to retry later
  if (surveysResult.status === "rejected") {
    throw new ScrapingError(`Failed to fetch surveys: ${surveysResult.reason}`, facilityId);
  }

  // Scrape survey citations for each survey (parallel per survey)
  const surveyCitations = new Map<string, SurveyCitation[]>();

  const surveyPromises = surveys
    .filter(s => s.reportNumber)
    .map(async (survey) => {
      const citations = await scrapeSurveyCitations(survey.reportNumber);
      if (citations.length > 0) {
        // Fetch all citation details in parallel (batch of 5 to avoid overwhelming server)
        const BATCH_SIZE = 5;
        for (let i = 0; i < citations.length; i += BATCH_SIZE) {
          const batch = citations.slice(i, i + BATCH_SIZE);
          const detailsPromises = batch.map(async (citation) => {
            const details = await scrapeCitationDetails(survey.reportNumber, citation.tagId);
            if (details) {
              citation.details = details;
            }
          });
          await Promise.all(detailsPromises);
          if (i + BATCH_SIZE < citations.length) {
            await delay(100); // Small delay between batches
          }
        }
        return { reportNumber: survey.reportNumber, citations };
      }
      return null;
    });

  const results = await Promise.all(surveyPromises);
  for (const result of results) {
    if (result) {
      surveyCitations.set(result.reportNumber, result.citations);
    }
  }

  // Log non-critical errors but continue
  if (errors.length > 0) {
    console.log(`    ⚠ Non-critical errors for ${facilityId}: ${errors.join("; ")}`);
  }

  return {
    facility,
    surveys,
    surveyCitations,
    violations,
    notices,
    scrapedAt: new Date().toISOString(),
  };
}

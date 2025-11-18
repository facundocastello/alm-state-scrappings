import { load, type CheerioAPI } from "cheerio";

import { httpClient } from "./http.js";
import type { FacilityRecord, FacilitySummary, Report } from "./types.js";
import { cleanText, parseNumber } from "./utils.js";
import { downloadReports } from "./reportDownloader.js";

interface FacilityInfo {
  facilityName: string;
  address: string;
  city: string;
  county: string;
  phone: string;
  zipCode: string;
  facilityStatus: string;
  licenseStatus: string;
  licenseEffectiveDate: string;
  licenseExpirationDate: string;
  licenseFacilityType: string;
  capacity: number | null;
  serves: string[];
  specialCertification: string[];
  licenseeName: string;
  licenseeAddress: string;
  licenseePhone: string;
}

// Helper to extract value from a row by label
const getFieldValue = ($: CheerioAPI, container: ReturnType<CheerioAPI>, label: string): string => {
  const row = container.find(".row").filter((_, el) => {
    const strongText = $(el).find("strong").text();
    return cleanText(strongText).startsWith(label);
  });

  if (row.length === 0) return "";

  const valueDiv = row.find(".profile");
  if (valueDiv.length === 0) return "";

  return cleanText(valueDiv.text());
};

const parseFacilityInfo = ($: CheerioAPI): FacilityInfo => {
  // Find the Facility Information section
  const facilitySection = $("legend.FacSection, div.FacSection")
    .filter((_, el) => $(el).text().includes("Facility Information"))
    .first();

  if (facilitySection.length === 0) {
    return {
      facilityName: "",
      address: "",
      city: "",
      county: "",
      phone: "",
      zipCode: "",
      facilityStatus: "",
      licenseStatus: "",
      licenseEffectiveDate: "",
      licenseExpirationDate: "",
      licenseFacilityType: "",
      capacity: null,
      serves: [],
      specialCertification: [],
      licenseeName: "",
      licenseeAddress: "",
      licenseePhone: "",
    };
  }

  const container = facilitySection.next(".padding-left-15");

  // Extract facility name
  const facilityName = getFieldValue($, container, "Facility Name");

  // Extract address (may have line breaks)
  const addressRow = container.find(".row").filter((_, el) => {
    return $(el).find("strong").text().includes("Address");
  });
  let address = "";
  let city = "";
  let zipCode = "";
  if (addressRow.length > 0) {
    const addressDiv = addressRow.find(".profile");
    const addressText = addressDiv.html() || "";
    // Split by <br /> tags
    const lines = addressText
      .split(/<br\s*\/?>/i)
      .map((line) => cleanText(line))
      .filter(Boolean);
    if (lines.length > 0) {
      address = lines[0] || "";
      if (lines.length > 1) {
        // Parse city, state, zip from second line (e.g., "Gladstone , MI 49837")
        const cityLine = lines[1] || "";
        const cityMatch = cityLine.match(/^(.+?)\s*,\s*[A-Z]{2}\s+(\d{5}(?:-\d{4})?)$/);
        if (cityMatch) {
          city = cleanText(cityMatch[1] || "");
          zipCode = cityMatch[2] || "";
        } else {
          city = cityLine;
        }
      }
    }
  }

  const county = getFieldValue($, container, "County");
  const phone = getFieldValue($, container, "Phone");
  const facilityStatus = getFieldValue($, container, "Facility Status");
  const licenseStatus = getFieldValue($, container, "License Status");
  const licenseEffectiveDate = getFieldValue($, container, "License Effective Date");
  const licenseExpirationDate = getFieldValue($, container, "License Expiration Date");
  const licenseFacilityType = getFieldValue($, container, "License Facility Type");
  const capacity = parseNumber(getFieldValue($, container, "Capacity"));

  // Parse Services Provided
  const servicesSection = $("div.FacSection")
    .filter((_, el) => $(el).text().includes("Services Provided"))
    .first();

  let serves: string[] = [];
  let specialCertification: string[] = [];

  if (servicesSection.length > 0) {
    const servicesContainer = servicesSection.next(".padding-left-15");
    const servesText = getFieldValue($, servicesContainer, "Serves");
    if (servesText) {
      serves = servesText.split(",").map((s) => cleanText(s)).filter(Boolean);
    }
    const certText = getFieldValue($, servicesContainer, "Special Certification");
    if (certText) {
      specialCertification = certText.split(",").map((s) => cleanText(s)).filter(Boolean);
    }
  }

  // Parse Licensee Information
  const licenseeSection = $("div.FacSection")
    .filter((_, el) => $(el).text().includes("Licensee Information"))
    .first();

  let licenseeName = "";
  let licenseeAddress = "";
  let licenseePhone = "";

  if (licenseeSection.length > 0) {
    const licenseeContainer = licenseeSection.next(".padding-left-15");
    
    // Licensee Information (name and address)
    const licenseeInfoRow = licenseeContainer.find(".row").filter((_, el) => {
      return $(el).find("strong").text().includes("Licensee Information");
    });
    
    if (licenseeInfoRow.length > 0) {
      const licenseeInfoDiv = licenseeInfoRow.find(".profile");
      const licenseeInfoHtml = licenseeInfoDiv.html() || "";
      const licenseeLines = licenseeInfoHtml
        .split(/<br\s*\/?>/i)
        .map((line) => cleanText(line))
        .filter(Boolean);
      
      if (licenseeLines.length > 0) {
        licenseeName = licenseeLines[0] || "";
        if (licenseeLines.length > 1) {
          licenseeAddress = licenseeLines.slice(1).join(", ");
        }
      }
    }

    licenseePhone = getFieldValue($, licenseeContainer, "Licensee Phone");
  }

  return {
    facilityName,
    address,
    city,
    county,
    phone,
    zipCode,
    facilityStatus,
    licenseStatus,
    licenseEffectiveDate,
    licenseExpirationDate,
    licenseFacilityType,
    capacity,
    serves,
    specialCertification,
    licenseeName,
    licenseeAddress,
    licenseePhone,
  };
};

const parseReports = ($: CheerioAPI, profileUrl: string): Report[] => {
  const reports: Report[] = [];
  const seenReportIds = new Set<string>();

  // Find the Reports Available section
  const reportsSection = $("div.FacSection")
    .filter((_, el) => $(el).text().includes("Reports Available"))
    .first();

  if (reportsSection.length === 0) {
    return reports;
  }

  // Reports are in div.form-group elements that come after the Reports Available section
  // They continue until we hit an <hr> tag
  // Use nextUntil to get all siblings until hr, then filter for form-group divs
  const reportElements = reportsSection.nextUntil("hr").filter("div.form-group");
  
  // Process each report
  reportElements.each((_, groupEl) => {
    const $group = $(groupEl);
    const cols = $group.find("div.col-xs-12");

    if (cols.length > 0) {
      // Get the report type from the div with "noPadding" class or one of the hidden-* classes
      let reportType = "";
      const typeDiv = $group.find("div.noPadding, div.hidden-xs.hidden-sm, div.hidden-md.hidden-lg").first();
      if (typeDiv.length > 0) {
        reportType = cleanText(typeDiv.text());
      }

      // Get the filename from div with class containing "col-xs-8"
      let fileName = "";
      const fileNameDiv = $group.find("div.col-xs-8.col-md-3, div[class*='col-xs-8']").first();
      if (fileNameDiv.length > 0) {
        fileName = cleanText(fileNameDiv.text());
      }

      // Get the date from div with "text-right" class
      let reportDate = "";
      const dateDiv = $group.find("div.text-right, div[class*='text-right']").first();
      if (dateDiv.length > 0) {
        reportDate = cleanText(dateDiv.text());
      }

      // Get the download link (prefer DownloadReport over ViewReport)
      const downloadLink = $group.find('a[href*="DownloadReport"]').first();
      
      if (downloadLink.length > 0) {
        const href = downloadLink.attr("href");
        if (href) {
          // Extract report ID from URL (e.g., /Home/DownloadReport/346883)
          const reportIdMatch = href.match(/\/DownloadReport\/(\d+)/);
          if (reportIdMatch) {
            const reportId = reportIdMatch[1] || "";
            if (!seenReportIds.has(reportId)) {
              seenReportIds.add(reportId);

              // Build full URL
              const documentUrl = href.startsWith("http") ? href : new URL(href, profileUrl).toString();

              // If we don't have a report type, try to infer from filename or title
              if (!reportType) {
                const title = downloadLink.attr("title") || "";
                if (title.includes("Renewal Inspection")) {
                  reportType = "Renewal Inspection Report";
                } else if (title.includes("Original Licensing Study")) {
                  reportType = "Original Licensing Study Report";
                } else if (title.includes("Addendum")) {
                  reportType = "Addendum to Original Licensing Study Report";
                } else if (title.includes("Inspection")) {
                  reportType = "Inspection Report";
                } else if (title.includes("Special Investigation")) {
                  reportType = "Special Investigation Report";
                } else {
                  reportType = "Report";
                }
              }

              // If we don't have a filename, try to get it from the URL or use a default
              if (!fileName) {
                // Try to extract from title attribute
                const title = downloadLink.attr("title") || "";
                if (title) {
                  // Title format: "View Renewal Inspection Report Published on 5/21/2024"
                  // We can't get filename from title, so use report type
                  fileName = `${reportId}_${reportType.replace(/\s+/g, "_")}.pdf`;
                } else {
                  fileName = `${reportId}.pdf`;
                }
              }

              reports.push({
                reportType,
                reportDate,
                fileName,
                documentUrl,
              });
            }
          }
        }
      }
    }
  });

  return reports;
};

const buildFacilityRecord = (
  summary: FacilitySummary,
  detail: FacilityInfo,
  reports: Report[]
): FacilityRecord => {
  return {
    ...summary,
    facilityStatus: detail.facilityStatus,
    licenseStatus: detail.licenseStatus,
    licenseEffectiveDate: detail.licenseEffectiveDate,
    licenseExpirationDate: detail.licenseExpirationDate,
    licenseFacilityType: detail.licenseFacilityType,
    capacity: detail.capacity ?? summary.capacity,
    serves: detail.serves,
    specialCertification: detail.specialCertification,
    licenseeName: detail.licenseeName,
    licenseeAddress: detail.licenseeAddress,
    licenseePhone: detail.licenseePhone,
    reports,
    reportsTotal: reports.length,
  };
};

export const scrapeFacility = async (
  summary: FacilitySummary
): Promise<FacilityRecord> => {
  const response = await httpClient.get(summary.profileUrl);
  const $ = load(response.body);

  const info = parseFacilityInfo($);
  const reports = parseReports($, summary.profileUrl);

  await downloadReports(summary.fid, reports);

  return buildFacilityRecord(summary, info, reports);
};

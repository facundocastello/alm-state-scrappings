import * as cheerio from "cheerio";
import type { TNFacility } from "./types.js";

/**
 * Parse city, state, zip from a location string like "Memphis, TN 38125"
 */
function parseLocation(location: string): {
  city: string;
  state: string;
  zip: string;
} {
  const match = location.match(/^(.+?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/);
  if (match) {
    return {
      city: match[1]?.trim() ?? "",
      state: match[2] ?? "",
      zip: match[3] ?? "",
    };
  }
  // Try without state
  const simpleMatch = location.match(/^(.+?)\s+([A-Z]{2})$/);
  if (simpleMatch) {
    return {
      city: simpleMatch[1]?.trim() ?? "",
      state: simpleMatch[2] ?? "",
      zip: "",
    };
  }
  return { city: location.trim(), state: "", zip: "" };
}

/**
 * Parse the facility listings HTML and extract all facility data
 */
export function parseFacilityListingsHtml(html: string): TNFacility[] {
  const $ = cheerio.load(html);
  const facilities: TNFacility[] = [];

  $("table.table tbody tr.row").each((_, row) => {
    const $row = $(row);
    const tds = $row.find("td");

    if (tds.length < 4) return;

    // Column 1: Row number
    const rowNumber = parseInt($(tds[0]).text().trim(), 10) || 0;

    // Column 2: Facility name, address, phone
    const col2 = $(tds[1]);
    const col2Html = col2.html() ?? "";
    const col2Parts = col2Html.split("<br>").map((s) =>
      cheerio
        .load(s)
        .text()
        .trim()
        .replace(/\s+/g, " ")
    );

    const facilityName = col2Parts[0] ?? "";
    const address = col2Parts[1] ?? "";
    const cityStateZip = col2Parts[2] ?? "";
    const phone = col2Parts[3] ?? "";

    const { city, state, zip } = parseLocation(cityStateZip);

    // Column 3: Administrator and Owner info
    const col3 = $(tds[2]);
    let administrator = "";
    let ownerName = "";
    let ownerAddress = "";
    let ownerCity = "";
    let ownerState = "";
    let ownerZip = "";
    let ownerPhone = "";

    const col3Divs = col3.find("div");
    let ownerInfoStarted = false;
    const ownerParts: string[] = [];

    col3Divs.each((_, div) => {
      const text = $(div).text().trim();
      if (text.startsWith("Administrator:")) {
        administrator = text.replace("Administrator:", "").trim();
      } else if (text === "Owner Information:") {
        ownerInfoStarted = true;
      } else if (ownerInfoStarted) {
        ownerParts.push(text);
      }
    });

    // Parse owner parts: name, address, city/state/zip, phone
    if (ownerParts.length >= 1) ownerName = ownerParts[0] ?? "";
    if (ownerParts.length >= 2) ownerAddress = ownerParts[1] ?? "";
    if (ownerParts.length >= 3) {
      const ownerLoc = parseLocation(ownerParts[2] ?? "");
      ownerCity = ownerLoc.city;
      ownerState = ownerLoc.state;
      ownerZip = ownerLoc.zip;
    }
    if (ownerParts.length >= 4) ownerPhone = ownerParts[3] ?? "";

    // Column 4: License info, dates, disciplinary actions
    const col4 = $(tds[3]);
    const col4Text = col4.text();
    const col4Html = col4.html() ?? "";

    // License number
    const licenseMatch = col4Text.match(/Facility License Number:\s*(\d+)/);
    const licenseNumber = licenseMatch?.[1] ?? "";

    // Status
    const statusMatch = col4Text.match(/Status:\s*([^\n]+)/);
    const status = statusMatch?.[1]?.trim() ?? "";

    // Number of beds
    const bedsMatch = col4Text.match(/Number of Beds:\s*(\d+)/);
    const numberOfBeds = parseInt(bedsMatch?.[1] ?? "0", 10);

    // Date of Last Survey
    const surveyMatch = col4Text.match(/Date of Last Survey:\s*(\d{2}\/\d{2}\/\d{4})/);
    const dateOfLastSurvey = surveyMatch?.[1] ?? "";

    // Date of Original Licensure
    const origMatch = col4Text.match(/Date of Original Licensure:\s*(\d{2}\/\d{2}\/\d{4})/);
    const dateOfOriginalLicensure = origMatch?.[1] ?? "";

    // Date of Expiration
    const expMatch = col4Text.match(/Date of Expiration:\s*(\d{2}\/\d{2}\/\d{4})/);
    const dateOfExpiration = expMatch?.[1] ?? "";

    // Accreditation Expires
    const accredMatch = col4Text.match(/Accreditation Expires:\s*(\d{2}\/\d{2}\/\d{4})/);
    const accreditationExpires = accredMatch?.[1] ?? "";

    // Managed By
    let managedBy = "";
    let managedByLocation = "";
    const managedByDiv = col4.find("div.note");
    if (managedByDiv.length > 0) {
      const managedByText = managedByDiv.text();
      const managedMatch = managedByText.match(
        /This Facility is Managed By:\s*([^\n]+)\s+([A-Za-z\s]+\s+[A-Z]{2})\s*$/
      );
      if (managedMatch) {
        managedBy = managedMatch[1]?.trim() ?? "";
        managedByLocation = managedMatch[2]?.trim() ?? "";
      } else {
        // Try extracting from span
        const managedSpan = managedByDiv.find("span");
        if (managedSpan.length > 0) {
          managedBy = managedSpan.text().trim();
          // Get text after span for location
          const spanParent = managedSpan.parent();
          const afterSpan = spanParent.contents().filter((_, el) => {
            return el.type === "text" && $(el).text().trim().length > 0;
          });
          if (afterSpan.length > 0) {
            const fullText = managedByDiv.text();
            const parts = fullText.split(managedBy);
            if (parts[1]) {
              managedByLocation = parts[1].replace("This Facility is Managed By:", "").trim();
            }
          }
        }
      }
      // Alternative parsing: get text nodes after "This Facility is Managed By:"
      if (!managedBy) {
        const noteHtml = managedByDiv.html() ?? "";
        const afterManaged = noteHtml.split("This Facility is Managed By:");
        if (afterManaged[1]) {
          const $managed = cheerio.load(afterManaged[1]);
          const spanText = $managed("span").text().trim();
          if (spanText) {
            managedBy = spanText;
            // Get remaining text
            $managed("span").remove();
            managedByLocation = $managed.text().trim();
          }
        }
      }
    }

    // Disciplinary actions
    let disciplinaryActionCount = 0;
    let disciplinaryActionUrl = "";
    let hasDisciplinaryActions = false;

    const actionDiv = col4.find("div.action");
    if (actionDiv.length > 0) {
      hasDisciplinaryActions = true;
      const actionText = actionDiv.text().trim();
      const countMatch = actionText.match(/^(\d+)/);
      if (countMatch) {
        disciplinaryActionCount = parseInt(countMatch[1] ?? "0", 10);
      }
      const actionLink = actionDiv.find("a.action");
      if (actionLink.length > 0) {
        disciplinaryActionUrl = actionLink.attr("href") ?? "";
      }
    }

    facilities.push({
      rowNumber,
      facilityName,
      address,
      city,
      state: state || "TN",
      zip,
      phone,
      administrator,
      ownerName,
      ownerAddress,
      ownerCity,
      ownerState,
      ownerZip,
      ownerPhone,
      licenseNumber,
      status,
      numberOfBeds,
      dateOfLastSurvey,
      dateOfOriginalLicensure,
      dateOfExpiration,
      accreditationExpires,
      managedBy,
      managedByLocation,
      disciplinaryActionCount,
      disciplinaryActionUrl,
      hasDisciplinaryActions,
    });
  });

  return facilities;
}

/**
 * Extract metadata from the listings page header
 */
export function extractListingsMetadata(html: string): {
  lastUpdated: string;
  facilityType: string;
  county: string;
  totalResults: number;
  totalBeds: number;
} {
  const $ = cheerio.load(html);

  const lastUpdatedMatch = $("h3")
    .text()
    .match(/Last Updated:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  const lastUpdated = lastUpdatedMatch?.[1] ?? "";

  const infoText = $(".medium-6.column").text();

  const typeMatch = infoText.match(/Type\s*=\s*([^\n]+)/);
  const facilityType = typeMatch?.[1]?.trim() ?? "";

  const countyMatch = infoText.match(/County\s*=\s*([^\n]+)/);
  const county = countyMatch?.[1]?.trim() ?? "";

  const resultsMatch = infoText.match(/Results\s*=\s*(\d+)/);
  const totalResults = parseInt(resultsMatch?.[1] ?? "0", 10);

  const bedsMatch = infoText.match(/Total Beds\s*=\s*(\d+)/);
  const totalBeds = parseInt(bedsMatch?.[1] ?? "0", 10);

  return { lastUpdated, facilityType, county, totalResults, totalBeds };
}

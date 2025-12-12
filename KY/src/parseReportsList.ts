import * as cheerio from "cheerio";
import fs from "fs";
import { config } from "./config.js";
import type { FacilityMapping } from "./types.js";

/**
 * Parse reportslist.html to extract facility mappings
 * Maps license_id (header5) to item_id (header2)
 */
export function parseReportsList(): FacilityMapping[] {
  const html = fs.readFileSync(config.paths.reportsListHtml, "utf-8");
  const $ = cheerio.load(html);

  const facilities: FacilityMapping[] = [];

  // Find all data rows (skip header row)
  $("table.dataGrid1 tr").each((_, row) => {
    const $row = $(row);

    // Skip header row
    if ($row.find("th").length > 0) return;

    // Extract cell values by header attribute
    const itemCell = $row.find('td[headers="header2"]');
    const regionCell = $row.find('td[headers="header3"]');
    const nameCell = $row.find('td[headers="header4"]');
    const licenseCell = $row.find('td[headers="header5"]');
    const countyCell = $row.find('td[headers="header6"]');
    const formerNamesCell = $row.find('td[headers="header7"]');

    // Extract itemId from link: <a href="detail.aspx?TK=342&ITEM=100">100</a>
    const itemLink = itemCell.find("a").attr("href") || "";
    const itemIdMatch = itemLink.match(/ITEM=(\d+)/);
    const itemId = itemIdMatch ? itemIdMatch[1] : itemCell.text().trim();

    const licenseId = licenseCell.text().trim();

    if (itemId && licenseId) {
      facilities.push({
        itemId,
        licenseId,
        facilityName: nameCell.text().trim(),
        region: regionCell.text().trim(),
        county: countyCell.text().trim(),
        formerNames: formerNamesCell.text().trim().replace(/\u00a0/g, ""), // Remove &nbsp;
      });
    }
  });

  console.log(`Parsed ${facilities.length} facilities from reportslist.html`);
  return facilities;
}

/**
 * Save facility mappings to JSON for reference
 */
export function saveFacilityMappings(facilities: FacilityMapping[]): void {
  // Ensure data directory exists
  if (!fs.existsSync(config.paths.data)) {
    fs.mkdirSync(config.paths.data, { recursive: true });
  }

  fs.writeFileSync(
    config.paths.facilityItemsJson,
    JSON.stringify(facilities, null, 2)
  );
  console.log(`Saved facility mappings to ${config.paths.facilityItemsJson}`);
}

/**
 * Load facility mappings from JSON (if already parsed)
 */
export function loadFacilityMappings(): FacilityMapping[] | null {
  if (!fs.existsSync(config.paths.facilityItemsJson)) {
    return null;
  }

  const json = fs.readFileSync(config.paths.facilityItemsJson, "utf-8");
  return JSON.parse(json) as FacilityMapping[];
}

/**
 * Get or create facility mappings
 */
export function getFacilityMappings(): FacilityMapping[] {
  // Try to load existing mappings
  const existing = loadFacilityMappings();
  if (existing) {
    console.log(`Loaded ${existing.length} facility mappings from cache`);
    return existing;
  }

  // Parse and save
  const facilities = parseReportsList();
  saveFacilityMappings(facilities);
  return facilities;
}

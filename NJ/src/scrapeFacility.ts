import { CheerioAPI } from 'cheerio';
import { httpClient } from './http.js';
import { config } from './config.js';
import {
  FacilityDetail,
  BedTypeInfo,
  InspectionSummary,
  FacilityInfo,
} from './types.js';

function parseText($: CheerioAPI, selector: string): string | null {
  const text = $(selector).text().trim();
  return text || null;
}

function parseIntSafe(value: string | null): number | null {
  if (!value) return null;
  const num = parseInt(value.replace(/,/g, ''), 10);
  return isNaN(num) ? null : num;
}

function parseFacilityInfo($: CheerioAPI): FacilityInfo {
  // Find facility information table
  const infoTable = $('table.infotable').first();

  // Helper to extract table row value by label (searches ALL tables, not just first)
  const getValueByLabel = (label: string): string | null => {
    // Search all infotable elements
    const allTables = $('table.infotable');

    for (let i = 0; i < allTables.length; i++) {
      const table = allTables.eq(i);
      const row = table.find(`td:contains("${label}")`).parent();

      if (row.length > 0) {
        const valueCell = row.find('td').eq(1);

        // Check if value is in an <a> tag (like Licensed Owner)
        const linkText = valueCell.find('a').first().text().trim();
        if (linkText) {
          return linkText;
        }

        const textValue = valueCell.text().trim();
        if (textValue) {
          return textValue;
        }
      }
    }

    return null;
  };

  const facilityName = $('span[id*="lblFacilityName"]').text().trim() ||
                       getValueByLabel('Licensed Name:') || '';

  const address = getValueByLabel('Address:') || '';

  // Parse address to extract city, state, zip
  const addressMatch = address.match(/^(.+),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  const street = addressMatch ? addressMatch[1] : address;
  const city = addressMatch ? addressMatch[2] : '';
  const state = addressMatch ? addressMatch[3] : 'NJ';
  const zipCode = addressMatch ? addressMatch[4] : '';

  return {
    licenseNumber: getValueByLabel('License Number:') || '',
    facilityName,
    licenseType: getValueByLabel('Facility Type:') || getValueByLabel('License Type:') || '',
    facilityStatus: getValueByLabel('Facility Status:') || 'UNKNOWN',
    licenseStatus: getValueByLabel('License Status:') || 'UNKNOWN',
    address: street,
    city,
    county: getValueByLabel('County:') || '',
    state,
    zipCode,
    phone: getValueByLabel('Phone:'),
    capacity: parseIntSafe(getValueByLabel('Capacity:') || getValueByLabel('Licensed Capacity:')),
    licenseEffectiveDate: getValueByLabel('License Effective Date:'),
    licenseExpirationDate: getValueByLabel('License Expires:') || getValueByLabel('License Expiration Date:'),
    licenseeName: getValueByLabel('Licensed Owner:') || getValueByLabel('Licensee Name:'),
    licenseeAddress: getValueByLabel('Licensee Address:'),
    licenseePhone: getValueByLabel('Licensee Phone:'),
    administrator: getValueByLabel('Administrator:'),
  };
}

function parseBedInformation($: CheerioAPI): BedTypeInfo[] {
  const beds: BedTypeInfo[] = [];

  // Find Bed/Slot Information table
  const bedTable = $('table.infotable:has(td:contains("Bed/Slot Information"))');

  if (bedTable.length === 0) return beds;

  // Extract bed rows (skip the header row)
  const bedRows = bedTable.find('tr').slice(1);

  bedRows.each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 1) {
      const cellText = $(cells[0]).text().trim();

      // Skip empty cells or header
      if (!cellText || cellText.toLowerCase().includes('bed/slot information')) {
        return;
      }

      // Parse format: "Ventilator:\n  16" or "Long Term Care Beds:\n  158"
      // Split on colon and extract label + number
      const colonMatch = cellText.match(/^([^:]+):\s*(\d+)/);
      if (colonMatch) {
        const type = colonMatch[1].trim();
        const count = parseIntSafe(colonMatch[2]);

        if (type && count !== null) {
          beds.push({ type, count });
        }
      }
    }
  });

  return beds;
}

function parseInspectionSummary($: CheerioAPI, summaryType: 'routine' | 'complaint'): InspectionSummary {
  const summaryTitle = summaryType === 'routine' ? 'Routine Inspection Summary' : 'Complaint Inspection Summary';
  const summaryTable = $(`table.infotable:has(span:contains("${summaryTitle}"))`);

  if (summaryTable.length === 0) {
    return {
      inspectionCount: 0,
      deficiencyCount: 0,
      maxScopeAndSeverity: null,
      moreInfoUrl: '',
    };
  }

  // Extract inspection count
  // Format: <td>Number of Routine Inspections: <span class="black13bold">13</span></td>
  const inspectionCell = summaryTable.find('td').filter((_, el) => {
    const text = $(el).text();
    return text.includes('Number of') && text.includes('Inspections');
  }).first();
  const inspectionCountText = inspectionCell.find('span.black13bold').text().trim();
  const inspectionCount = parseIntSafe(inspectionCountText) || 0;

  // Extract deficiency count
  const deficiencyCell = summaryTable.find('td').filter((_, el) => {
    const text = $(el).text();
    return text.includes('Number of Deficiencies');
  }).first();
  const deficiencyCountText = deficiencyCell.find('span.black13bold').text().trim();
  const deficiencyCount = parseIntSafe(deficiencyCountText) || 0;

  // Extract Maximum Scope & Severity
  const scopeCell = summaryTable.find('td').filter((_, el) => {
    const text = $(el).text();
    return text.includes('Maximum') && text.includes('Scope & Severity');
  }).first();
  const maxScopeAndSeverity = scopeCell.find('span.black13bold').text().trim() || null;

  // Extract "More Info" URL
  const moreInfoLink = summaryTable.find('a:contains("More Info")');
  const moreInfoUrl = moreInfoLink.attr('href') || '';

  return {
    inspectionCount,
    deficiencyCount,
    maxScopeAndSeverity,
    moreInfoUrl,
  };
}

function checkTabAvailability($: CheerioAPI, tabName: string): boolean {
  const pageText = $.root().text().toLowerCase();

  // Check for "not applicable" or similar messages
  if (pageText.includes('not applicable') || pageText.includes('no data available')) {
    return false;
  }

  // Check if the tab has content tables beyond the header
  const contentTables = $('table.infotable').length;
  return contentTables > 1;
}

export async function scrapeFacility(facilityId: string): Promise<FacilityDetail> {
  const url = config.urls.facilityDetails(facilityId);

  console.log(`Scraping facility ${facilityId}...`);

  // Step 1: GET Tab 0 (Facility Information)
  const { $: $tab0 } = await httpClient.get(url);

  // Extract ViewState tokens for subsequent requests
  const viewState = httpClient.extractViewState($tab0);

  // Parse Tab 0 data
  const facilityInfo = parseFacilityInfo($tab0);
  const beds = parseBedInformation($tab0);

  // Step 2: POST to Tab 1 (Inspection Summaries)
  const tab1PostData = httpClient.buildTabPostData(viewState, 1);
  const { $: $tab1 } = await httpClient.post(url, tab1PostData);

  const routineInspectionSummary = parseInspectionSummary($tab1, 'routine');
  const complaintInspectionSummary = parseInspectionSummary($tab1, 'complaint');

  // Step 3: POST to Tab 2 (Advisory Standards) - check availability
  const tab2PostData = httpClient.buildTabPostData(viewState, 2);
  const { $: $tab2 } = await httpClient.post(url, tab2PostData);
  const hasAdvisoryData = checkTabAvailability($tab2, 'Advisory Standards');

  // Step 4: POST to Tab 3 (Nursing Home Report Card) - check availability
  const tab3PostData = httpClient.buildTabPostData(viewState, 3);
  const { $: $tab3 } = await httpClient.post(url, tab3PostData);
  const hasReportCard = checkTabAvailability($tab3, 'Report Card');

  return {
    ...facilityInfo,
    facilityId,
    beds,
    inspectionSummaries: {
      routine: routineInspectionSummary,
      complaint: complaintInspectionSummary,
    },
    hasAdvisoryData,
    hasReportCard,
    profileUrl: url,
    reportsPageUrl: config.urls.reportsPage(facilityId),
  };
}

import fs from 'fs';
import * as cheerio from 'cheerio';
import { config } from './config.js';
import type { NursingHomeFacility } from './types.js';

/**
 * Parse the nh.html or hospice.html file and extract facility data.
 *
 * HTML structure:
 * <table>
 *   <tr>
 *     <td>
 *       <b>NAME</b><br>
 *       STREET<br>
 *       CITY, ME ZIP<br>
 *       <b>Phone:</b> PHONE<br>
 *       <b>Fax:</b> FAX
 *     </td>
 *     <td>
 *       <strong>Provider Type:</strong> TYPE<br>
 *       <strong>License:</strong> LICENSE<br>
 *       <form>
 *         <input type="hidden" value="[FACILITY_ID]" name="which">
 *         <input type="submit" value="View Surveys (N)">
 *       </form>
 *     </td>
 *     <td>
 *       <b>Administrator:</b><br>FIRSTNAME LASTNAME
 *     </td>
 *   </tr>
 * </table>
 */
export function parseNursingHomeFacilities(
  filePath: string,
  facilityType: 'nursing_home' | 'hospice'
): NursingHomeFacility[] {
  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(html);
  const facilities: NursingHomeFacility[] = [];

  // Find all data rows (they have 3 tds)
  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    // Parse first cell (address info)
    const addressCell = cells.eq(0);
    const addressHtml = addressCell.html() || '';

    // Extract name from first <b> tag
    const name = addressCell.find('b').first().text().trim();
    if (!name) return;

    // Parse address lines
    const lines = addressHtml
      .replace(/<b>.*?<\/b>/gi, '') // Remove bold tags and their content
      .replace(/<br\s*\/?>/gi, '\n')
      .split('\n')
      .map(line => line.replace(/<[^>]*>/g, '').trim())
      .filter(line => line.length > 0);

    let street = '';
    let city = '';
    let state = 'ME';
    let zip = '';
    let phone = '';
    let fax = '';

    for (const line of lines) {
      if (line.startsWith('Phone:')) {
        phone = line.replace('Phone:', '').trim();
      } else if (line.startsWith('Fax:')) {
        fax = line.replace('Fax:', '').trim();
      } else if (line.includes(', ME')) {
        // City, State Zip line
        const match = line.match(/^(.+),\s*ME\s*(\d{5}(?:-\d{4})?)/);
        if (match) {
          city = match[1]?.trim() || '';
          zip = match[2] || '';
        }
      } else if (!street && line.length > 0) {
        street = line;
      }
    }

    // Parse second cell (provider type, license, surveys)
    const providerCell = cells.eq(1);
    const providerHtml = providerCell.html() || '';

    // Extract provider type
    const providerTypeMatch = providerHtml.match(/Provider Type:<\/strong>\s*([^<]+)/i);
    const providerType = providerTypeMatch?.[1]?.trim() || '';

    // Extract license
    const licenseMatch = providerHtml.match(/License:<\/strong>\s*([^<]*)/i);
    const license = licenseMatch?.[1]?.trim() || '';

    // Extract facility ID from hidden input
    const facilityIdInput = providerCell.find('input[name="which"]');
    const facilityIdRaw = facilityIdInput.val() as string || '';
    // Remove brackets: [249886] -> 249886
    const facilityId = facilityIdRaw.replace(/[\[\]]/g, '');

    // Extract survey count from button text
    const surveyButton = providerCell.find('input[type="submit"]');
    const surveyButtonText = surveyButton.val() as string || '';
    const surveyCountMatch = surveyButtonText.match(/View Surveys \((\d+)\)/);
    const surveyCount = surveyCountMatch ? parseInt(surveyCountMatch[1] || '0', 10) : 0;

    // Extract map URL
    const mapLink = providerCell.find('a[href*="map"]');
    const mapUrl = mapLink.attr('href') || '';

    // Parse third cell (administrator)
    const adminCell = cells.eq(2);
    const adminHtml = adminCell.html() || '';
    // Get text after <br> following "Administrator:"
    const adminMatch = adminHtml.match(/Administrator:<\/b><br>([^<]+)/i);
    let administrator = adminMatch?.[1]?.trim() || '';
    // Clean up &nbsp; entities
    administrator = administrator.replace(/&nbsp;/g, ' ').trim();

    if (facilityId) {
      facilities.push({
        name,
        street,
        city,
        state,
        zip,
        phone,
        fax,
        providerType,
        license,
        administrator,
        facilityId,
        surveyCount,
        mapUrl,
        facilityType,
        scrapedAt: new Date().toISOString(),
      });
    }
  });

  return facilities;
}

/**
 * Parse nursing homes from nh.html
 */
export function parseNursingHomes(): NursingHomeFacility[] {
  return parseNursingHomeFacilities(config.nursingHomeFile, 'nursing_home');
}

/**
 * Parse hospice facilities from hospice.html
 */
export function parseHospiceFacilities(): NursingHomeFacility[] {
  return parseNursingHomeFacilities(config.hospiceFile, 'hospice');
}

/**
 * Get statistics
 */
export function getNursingHomeStats(facilities: NursingHomeFacility[]): {
  total: number;
  totalSurveys: number;
  byProviderType: Record<string, number>;
} {
  const byProviderType: Record<string, number> = {};
  let totalSurveys = 0;

  for (const f of facilities) {
    byProviderType[f.providerType] = (byProviderType[f.providerType] || 0) + 1;
    totalSurveys += f.surveyCount;
  }

  return {
    total: facilities.length,
    totalSurveys,
    byProviderType,
  };
}

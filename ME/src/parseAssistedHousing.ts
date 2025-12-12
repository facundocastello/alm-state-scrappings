import fs from 'fs';
import * as cheerio from 'cheerio';
import { config } from './config.js';
import type { AssistedHousingListing } from './types.js';

/**
 * Parse the assisted-housing.html file and extract facility listings.
 *
 * HTML structure:
 * <table id="gvLicensees">
 *   <tr>
 *     <td><a href="ShowDetail.aspx?SearchResultToken=...">NAME</a></td>
 *     <td>LICENSE_NUMBER</td>
 *     <td>CITY, ME ZIP</td>
 *     <td>PROFESSION</td>
 *     <td>STATUS</td>
 *   </tr>
 * </table>
 */
export function parseAssistedHousingListing(): AssistedHousingListing[] {
  const html = fs.readFileSync(config.assistedHousingFile, 'utf-8');
  const $ = cheerio.load(html);
  const facilities: AssistedHousingListing[] = [];

  // Find all data rows (skip header)
  $('#gvLicensees tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 5) return; // Skip if not enough cells

    const nameCell = cells.eq(0);
    const link = nameCell.find('a');
    const name = link.text().trim();
    const href = link.attr('href');

    if (!name || !href) return;

    const licenseNumber = cells.eq(1).text().trim();
    const location = cells.eq(2).text().trim();
    const profession = cells.eq(3).text().trim();
    const status = cells.eq(4).text().trim();

    // Build full URL
    const detailUrl = `${config.assistedHousingBaseUrl}/${href}`;

    facilities.push({
      name,
      licenseNumber,
      location,
      profession,
      status,
      detailUrl,
    });
  });

  return facilities;
}

/**
 * Filter facilities to only include active ones (optional)
 */
export function filterActiveFacilities(facilities: AssistedHousingListing[]): AssistedHousingListing[] {
  return facilities.filter(f => f.status === 'ACTIVE');
}

/**
 * Get statistics about the listings
 */
export function getListingStats(facilities: AssistedHousingListing[]): {
  total: number;
  byStatus: Record<string, number>;
  byProfession: Record<string, number>;
} {
  const byStatus: Record<string, number> = {};
  const byProfession: Record<string, number> = {};

  for (const f of facilities) {
    byStatus[f.status] = (byStatus[f.status] || 0) + 1;
    byProfession[f.profession] = (byProfession[f.profession] || 0) + 1;
  }

  return {
    total: facilities.length,
    byStatus,
    byProfession,
  };
}

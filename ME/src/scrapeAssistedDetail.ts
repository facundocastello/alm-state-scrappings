import * as cheerio from 'cheerio';
import { httpClient, delay } from './http.js';
import { config } from './config.js';
import type {
  AssistedHousingListing,
  AssistedHousingDetail,
  AssistedHousingFacility,
  LicenseHistoryEntry,
  SpecialtyEntry,
  InspectionEntry,
  InspectionDocument,
} from './types.js';

/**
 * Scrape the detail page for an assisted housing facility.
 *
 * HTML structure is documented in the plan - see comments for each section.
 */
export async function scrapeAssistedHousingDetail(
  listing: AssistedHousingListing
): Promise<AssistedHousingFacility> {
  const response = await httpClient.get(listing.detailUrl);
  const html = response.body as string;
  const $ = cheerio.load(html);

  // Extract basic attributes - handles both direct text and nested div labels
  const getAttributeValue = (label: string): string => {
    const row = $('.attributeRow').filter((_, el) => {
      // Check both direct text and nested div text
      const cellText = $(el).find('.attributeCell').first().text().trim();
      return cellText.includes(label);
    });
    return row.find('.attributeCell').eq(1).text().trim();
  };

  // Parse address from Street attribute
  const streetHtml = getAttributeValue('Street:');
  const addressParts = streetHtml.split('\n').map(s => s.trim()).filter(s => s);

  let street = '';
  let city = '';
  let state = 'ME';
  let zip = '';

  if (addressParts.length >= 1) {
    street = addressParts[0] || '';
  }
  if (addressParts.length >= 2) {
    // Parse "CITY, ME ZIP"
    const cityLine = addressParts[1] || '';
    const cityMatch = cityLine.match(/^(.+),\s*ME\s*(\d{5}(?:-\d{4})?)/);
    if (cityMatch) {
      city = cityMatch[1]?.trim() || '';
      zip = cityMatch[2] || '';
    }
  }

  // Get phone and fax
  const phone = getAttributeValue('Phone:');
  const fax = getAttributeValue('Fax:');

  // Get dates
  const firstLicensure = getAttributeValue('First Licensure:');
  const expirationDate = getAttributeValue('Expiration Date:');

  // Get status note (text after the status link)
  const statusCell = $('.attributeRow').filter((_, el) => {
    return $(el).find('.attributeCell div').first().text().trim().includes('Status:');
  }).find('.attributeCell').eq(1);
  const statusNote = statusCell.text().replace(statusCell.find('a').text(), '').trim();

  // Get total capacity
  const totalCapacityStr = getAttributeValue('Total Capacity:');
  const totalCapacity = totalCapacityStr ? parseInt(totalCapacityStr, 10) : null;

  // Get ADA accessible
  const adaStr = getAttributeValue('ADA Accessible:');
  const adaAccessible = adaStr ? adaStr.toLowerCase() === 'true' : null;

  // Parse contacts
  let primaryAdministrator = '';
  let primaryOwner = '';

  $('.DetailGroup.Contacts tbody tr').each((_, row) => {
    const type = $(row).find('td').eq(0).text().trim();
    const contact = $(row).find('td').eq(1).text().trim();

    if (type.includes('PRIMARY ADMINISTRATOR')) {
      primaryAdministrator = contact;
    } else if (type.includes('PRIMARY OWNER')) {
      primaryOwner = contact;
    }
  });

  // Parse license history
  const licenseHistory: LicenseHistoryEntry[] = [];
  $('.DetailGroup.InterpretedLicenseHistory tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 3) {
      licenseHistory.push({
        licenseType: cells.eq(0).text().trim(),
        startDate: cells.eq(1).text().trim(),
        endDate: cells.eq(2).text().trim(),
      });
    }
  });

  // Parse specialties
  const specialties: SpecialtyEntry[] = [];
  $('.DetailGroup.Authorities tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 4) {
      // Capacity might be in the Additional Information cell
      const additionalInfo = cells.eq(3).text();
      const capacityMatch = additionalInfo.match(/Capacity:\s*(\d+)/);
      const capacity = capacityMatch ? parseInt(capacityMatch[1] || '0', 10) : null;

      specialties.push({
        description: cells.eq(0).text().trim(),
        issueDate: cells.eq(1).text().trim(),
        status: cells.eq(2).text().trim(),
        capacity,
      });
    }
  });

  // Parse inspections
  const inspections: InspectionEntry[] = [];
  const inspectionRows = $('.DetailGroup.InspectionEvents > table > tbody > tr');

  let currentInspection: InspectionEntry | null = null;

  inspectionRows.each((_, row) => {
    const cells = $(row).find('> td');

    // Check if this is a main inspection row (3 cells with date, type, status)
    if (cells.length === 3 && !$(row).find('.InspectionEventCommunications').length) {
      // Save previous inspection if exists
      if (currentInspection) {
        inspections.push(currentInspection);
      }

      currentInspection = {
        date: cells.eq(0).text().trim(),
        type: cells.eq(1).text().trim(),
        status: cells.eq(2).text().trim(),
        documents: [],
      };
    }

    // Check if this row contains documents (nested table)
    const docTable = $(row).find('.InspectionEventCommunications');
    if (docTable.length && currentInspection) {
      docTable.find('tbody tr').each((_, docRow) => {
        const docCells = $(docRow).find('td');
        if (docCells.length >= 3) {
          const docLink = docCells.eq(2).find('a');
          const href = docLink.attr('href');

          if (href && currentInspection) {
            const document: InspectionDocument = {
              type: docCells.eq(0).text().trim(),
              sentDate: docCells.eq(1).text().trim(),
              filename: docLink.text().trim(),
              downloadUrl: `${config.assistedHousingBaseUrl}/${href}`,
            };
            currentInspection.documents.push(document);
          }
        }
      });
    }
  });

  // Don't forget the last inspection
  if (currentInspection) {
    inspections.push(currentInspection);
  }

  const detail: AssistedHousingDetail = {
    street,
    city,
    state,
    zip,
    phone,
    fax,
    firstLicensure,
    expirationDate,
    statusNote,
    totalCapacity,
    adaAccessible,
    primaryAdministrator,
    primaryOwner,
    licenseHistory,
    specialties,
    inspections,
  };

  return {
    ...listing,
    ...detail,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Scrape multiple facilities with concurrency control.
 */
export async function scrapeAssistedHousingFacilities(
  listings: AssistedHousingListing[],
  onProgress?: (completed: number, total: number, current: AssistedHousingListing) => void
): Promise<{ succeeded: AssistedHousingFacility[]; failed: AssistedHousingListing[] }> {
  const succeeded: AssistedHousingFacility[] = [];
  const failed: AssistedHousingListing[] = [];

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]!;

    if (onProgress) {
      onProgress(i, listings.length, listing);
    }

    try {
      const facility = await scrapeAssistedHousingDetail(listing);
      succeeded.push(facility);
    } catch (error) {
      console.error(`  Error scraping ${listing.licenseNumber}: ${error instanceof Error ? error.message : error}`);
      failed.push(listing);
    }

    // Delay between requests
    if (i < listings.length - 1) {
      await delay(config.requestDelayMs);
    }
  }

  return { succeeded, failed };
}

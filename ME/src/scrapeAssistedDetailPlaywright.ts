/**
 * Playwright-based scraper for Maine Assisted Housing detail pages.
 *
 * This scraper uses a single browser session to:
 * 1. Navigate to search page
 * 2. Submit search form (get fresh results with valid session tokens)
 * 3. Click through each facility detail page sequentially
 * 4. Extract all data fields
 * 5. Download PDF reports at the end
 *
 * This approach solves the ASP.NET session token expiration issue
 * that caused 302 redirects with the HTTP-based scraper.
 */

import fs from 'fs';
import path from 'path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { config } from './config.js';
import {
  getAssistedHousingCompletedSet,
  markAssistedHousingCompleted,
  markAssistedHousingFailed,
} from './progressTracker.js';
import type {
  AssistedHousingListing,
  AssistedHousingDetail,
  AssistedHousingFacility,
  LicenseHistoryEntry,
  SpecialtyEntry,
  InspectionEntry,
  InspectionDocument,
} from './types.js';

const BASE_URL = 'https://www.pfr.maine.gov/ALMSOnline/ALMSQuery';

/**
 * Parse detail page HTML using cheerio (reuses logic from scrapeAssistedDetail.ts)
 */
function parseDetailHtml(html: string, listing: AssistedHousingListing): AssistedHousingDetail {
  const $ = cheerio.load(html);

  // Extract basic attributes - handles both direct text and nested div labels
  const getAttributeValue = (label: string): string => {
    const row = $('.attributeRow').filter((_, el) => {
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

  // Get status note
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

    // Check if this is a main inspection row
    if (cells.length === 3 && !$(row).find('.InspectionEventCommunications').length) {
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

    // Check if this row contains documents
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
              downloadUrl: `${BASE_URL}/${href}`,
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

  return {
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
}

/**
 * Extract listings from search results page
 */
function extractListingsFromHtml(html: string): AssistedHousingListing[] {
  const $ = cheerio.load(html);
  const facilities: AssistedHousingListing[] = [];

  $('#gvLicensees tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 5) return;

    const nameCell = cells.eq(0);
    const link = nameCell.find('a');
    const name = link.text().trim();
    const href = link.attr('href');

    if (!name || !href) return;

    const licenseNumber = cells.eq(1).text().trim();
    const location = cells.eq(2).text().trim();
    const profession = cells.eq(3).text().trim();
    const status = cells.eq(4).text().trim();

    const detailUrl = `${BASE_URL}/${href}`;

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
 * Download a PDF document using Playwright's request context
 */
async function downloadPdf(
  context: BrowserContext,
  url: string,
  savePath: string
): Promise<boolean> {
  try {
    const response = await context.request.get(url);
    if (response.ok()) {
      const buffer = await response.body();
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(savePath, buffer);
      return true;
    }
  } catch (error) {
    console.error(`    Failed to download ${url}: ${error instanceof Error ? error.message : error}`);
  }
  return false;
}

export interface ScrapeResult {
  facilities: AssistedHousingFacility[];
  failed: string[];
  documentsDownloaded: number;
}

/**
 * Main scraper function - scrapes all assisted housing facilities using Playwright
 */
export async function scrapeAssistedHousingWithPlaywright(
  onProgress?: (completed: number, total: number, current: string) => void,
  downloadReports: boolean = true
): Promise<ScrapeResult> {
  console.log('Launching Playwright browser...');

  const browser: Browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: config.userAgent,
  });

  const page = await context.newPage();

  // Set longer timeout for slow pages
  page.setDefaultTimeout(60000);

  const facilities: AssistedHousingFacility[] = [];
  const failed: string[] = [];
  let documentsDownloaded = 0;

  // Track what's already completed
  const completedSet = getAssistedHousingCompletedSet();

  try {
    // Step 1: Navigate to search page
    console.log('Step 1: Loading search page...');
    await page.goto(`${BASE_URL}/Query.aspx`, { waitUntil: 'networkidle' });

    // Step 2: Fill and submit search form
    console.log('Step 2: Filling search form...');

    // Select "Assisted Housing Programs" from profession dropdown
    await page.selectOption('#MainContent_ucLicSearchProf_ddProfession', 'Assisted Housing Programs');
    await page.waitForTimeout(500);

    // Make sure Maine is selected
    await page.selectOption('#MainContent_ucLicSearchProf_ddState', 'ME');

    console.log('Step 3: Submitting search...');
    await page.click('#MainContent_ucLicSearchProf_btnSearch');

    // Wait for results
    await page.waitForSelector('#gvLicensees', { timeout: 60000 });
    console.log('Search results loaded.');

    // Step 4: Extract all listings
    console.log('Step 4: Extracting listings...');
    const resultsHtml = await page.content();
    const allListings = extractListingsFromHtml(resultsHtml);

    // Save fresh HTML for reference
    fs.writeFileSync(path.join(config.inputDir, 'assisted-housing-fresh.html'), resultsHtml);

    console.log(`Found ${allListings.length} facilities total.`);

    // Filter to pending only
    const pendingListings = allListings.filter(l => !completedSet.has(l.licenseNumber));
    console.log(`Already completed: ${completedSet.size}`);
    console.log(`Pending: ${pendingListings.length}`);

    if (pendingListings.length === 0) {
      console.log('All facilities already scraped!');
      await browser.close();
      return { facilities, failed, documentsDownloaded };
    }

    // Step 5: Scrape each facility detail page
    console.log('\nStep 5: Scraping detail pages...');
    console.log('-'.repeat(60));

    // Collect all document URLs for batch download later
    const documentsToDownload: { url: string; path: string }[] = [];

    for (let i = 0; i < pendingListings.length; i++) {
      const listing = pendingListings[i]!;
      const progress = `[${i + 1}/${pendingListings.length}]`;

      try {
        if (onProgress) {
          onProgress(i + 1, pendingListings.length, listing.licenseNumber);
        }

        // Click on the facility link
        // We need to find the link by license number since we might have navigated away
        const linkSelector = `#gvLicensees a:has-text("${listing.name.replace(/"/g, '\\"')}")`;

        // Make sure we're on the search results page
        if (!await page.$('#gvLicensees')) {
          // Navigate back to search results if needed
          await page.goto(`${BASE_URL}/Query.aspx`, { waitUntil: 'networkidle' });
          await page.selectOption('#MainContent_ucLicSearchProf_ddProfession', 'Assisted Housing Programs');
          await page.waitForTimeout(300);
          await page.selectOption('#MainContent_ucLicSearchProf_ddState', 'ME');
          await page.click('#MainContent_ucLicSearchProf_btnSearch');
          await page.waitForSelector('#gvLicensees', { timeout: 60000 });
        }

        // Find and click the link
        const link = await page.$(`#gvLicensees td:has-text("${listing.licenseNumber}") ~ td a, #gvLicensees tr:has(td:text("${listing.licenseNumber}")) a`);

        if (!link) {
          // Try alternate: find by license number in the row
          const rows = await page.$$('#gvLicensees tbody tr');
          let found = false;
          for (const row of rows) {
            const rowText = await row.textContent();
            if (rowText?.includes(listing.licenseNumber)) {
              const rowLink = await row.$('a');
              if (rowLink) {
                await rowLink.click();
                found = true;
                break;
              }
            }
          }
          if (!found) {
            throw new Error(`Could not find link for ${listing.licenseNumber}`);
          }
        } else {
          await link.click();
        }

        // Wait for detail page to load
        await page.waitForSelector('.attributeRow, .DetailGroup', { timeout: 30000 });

        // Small delay to ensure page is fully rendered
        await page.waitForTimeout(500);

        // Get detail page HTML
        const detailHtml = await page.content();

        // Parse the detail page
        const detail = parseDetailHtml(detailHtml, listing);

        // Create facility object
        const facility: AssistedHousingFacility = {
          ...listing,
          ...detail,
          scrapedAt: new Date().toISOString(),
        };

        facilities.push(facility);
        markAssistedHousingCompleted(listing.licenseNumber);

        // Collect document URLs for later download
        if (downloadReports && listing.status === 'ACTIVE') {
          for (const inspection of detail.inspections) {
            for (const doc of inspection.documents) {
              const dateStr = doc.sentDate.replace(/\//g, '') || 'unknown';
              const typeSlug = doc.type.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30);
              const filename = `${dateStr}-${typeSlug}.pdf`;
              const savePath = path.join(config.reportsDir, listing.licenseNumber, filename);

              documentsToDownload.push({
                url: doc.downloadUrl,
                path: savePath,
              });
            }
          }
        }

        // Log progress every 25 facilities
        if ((i + 1) % 25 === 0) {
          console.log(`${progress} Scraped ${listing.licenseNumber} - ${listing.name}`);
        }

        // Navigate back to results
        await page.goBack({ waitUntil: 'networkidle' });

        // Wait for results table to be visible again
        await page.waitForSelector('#gvLicensees', { timeout: 30000 });

        // Small delay between facilities
        await page.waitForTimeout(config.requestDelayMs);

      } catch (error) {
        console.error(`${progress} ERROR ${listing.licenseNumber}: ${error instanceof Error ? error.message : error}`);
        failed.push(listing.licenseNumber);
        markAssistedHousingFailed(listing.licenseNumber);

        // Try to recover by going back to search
        try {
          await page.goto(`${BASE_URL}/Query.aspx`, { waitUntil: 'networkidle' });
          await page.selectOption('#MainContent_ucLicSearchProf_ddProfession', 'Assisted Housing Programs');
          await page.waitForTimeout(300);
          await page.selectOption('#MainContent_ucLicSearchProf_ddState', 'ME');
          await page.click('#MainContent_ucLicSearchProf_btnSearch');
          await page.waitForSelector('#gvLicensees', { timeout: 60000 });
        } catch (e) {
          console.error('  Failed to recover, continuing...');
        }
      }
    }

    console.log(`\nDetail scraping complete: ${facilities.length} succeeded, ${failed.length} failed`);

    // Step 6: Download PDF reports
    if (downloadReports && documentsToDownload.length > 0) {
      console.log(`\nStep 6: Downloading ${documentsToDownload.length} PDF reports...`);

      for (let i = 0; i < documentsToDownload.length; i++) {
        const doc = documentsToDownload[i]!;

        // Skip if already exists
        if (fs.existsSync(doc.path)) {
          documentsDownloaded++;
          continue;
        }

        const success = await downloadPdf(context, doc.url, doc.path);
        if (success) {
          documentsDownloaded++;
        }

        if ((i + 1) % 50 === 0) {
          console.log(`  Downloaded ${i + 1}/${documentsToDownload.length} documents`);
        }

        // Small delay between downloads
        await page.waitForTimeout(200);
      }

      console.log(`Downloaded ${documentsDownloaded} documents.`);
    }

  } finally {
    await browser.close();
    console.log('Browser closed.');
  }

  return { facilities, failed, documentsDownloaded };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeAssistedHousingWithPlaywright(
    (completed, total, current) => {
      if (completed % 10 === 0 || completed === total) {
        console.log(`Progress: ${completed}/${total} - ${current}`);
      }
    },
    true // download reports
  )
    .then(result => {
      console.log('\n' + '='.repeat(60));
      console.log('Scraping Complete!');
      console.log('='.repeat(60));
      console.log(`Facilities scraped: ${result.facilities.length}`);
      console.log(`Failed: ${result.failed.length}`);
      console.log(`Documents downloaded: ${result.documentsDownloaded}`);

      // Save results
      const dataPath = path.join(config.dataDir, 'assisted-housing-playwright.json');
      fs.writeFileSync(dataPath, JSON.stringify(result.facilities, null, 2));
      console.log(`\nSaved to ${dataPath}`);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

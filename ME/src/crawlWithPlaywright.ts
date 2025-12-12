import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { config } from './config.js';
import type { AssistedHousingListing } from './types.js';

const BASE_URL = 'https://www.pfr.maine.gov/ALMSOnline/ALMSQuery';

/**
 * Crawl the assisted housing search results using Playwright.
 */
export async function crawlAssistedHousingWithPlaywright(): Promise<AssistedHousingListing[]> {
  console.log('Launching browser...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: config.userAgent,
  });
  const page = await context.newPage();

  try {
    console.log('Step 1: Loading search page...');
    await page.goto(`${BASE_URL}/Query.aspx`, { waitUntil: 'networkidle' });

    console.log('Step 2: Filling search form...');

    // Select "Assisted Housing Programs" from profession dropdown
    await page.selectOption('#MainContent_ucLicSearchProf_ddProfession', 'Assisted Housing Programs');

    // Wait a moment for any JS reactions
    await page.waitForTimeout(500);

    // Make sure Maine is selected
    await page.selectOption('#MainContent_ucLicSearchProf_ddState', 'ME');

    console.log('Step 3: Submitting search...');
    await page.click('#MainContent_ucLicSearchProf_btnSearch');

    // Wait for results
    await page.waitForSelector('#gvLicensees', { timeout: 60000 });

    console.log('Step 4: Extracting results...');

    // Get the HTML
    const html = await page.content();

    // Save for debugging
    fs.writeFileSync(path.join(config.inputDir, 'assisted-housing-fresh.html'), html);
    console.log('  Saved fresh HTML');

    // Parse with cheerio
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

    console.log(`  Found ${facilities.length} facilities`);

    return facilities;
  } finally {
    await browser.close();
  }
}

// Also scrape a single detail page to debug HTML structure
export async function debugDetailPage(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: config.userAgent });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  crawlAssistedHousingWithPlaywright()
    .then(async facilities => {
      console.log(`\nCrawled ${facilities.length} facilities`);

      // Save listings
      const listingsPath = path.join(config.dataDir, 'assisted-housing-listings.json');
      fs.writeFileSync(listingsPath, JSON.stringify(facilities, null, 2));
      console.log(`Saved to ${listingsPath}`);

      // Stats
      const byStatus: Record<string, number> = {};
      facilities.forEach(f => {
        byStatus[f.status] = (byStatus[f.status] || 0) + 1;
      });
      console.log('\nBy status:');
      Object.entries(byStatus).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });

      // Debug: fetch first active facility detail
      const active = facilities.find(f => f.status === 'ACTIVE');
      if (active) {
        console.log(`\nDebug: Fetching detail page for ${active.name}...`);
        const detailHtml = await debugDetailPage(active.detailUrl);
        fs.writeFileSync('/tmp/me-detail-fresh.html', detailHtml);
        console.log('Saved detail HTML to /tmp/me-detail-fresh.html');
      }
    })
    .catch(console.error);
}

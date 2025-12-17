/**
 * Quick test of Playwright scraper - runs for first 3 facilities only
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.pfr.maine.gov/ALMSOnline/ALMSQuery';

async function test() {
  console.log('Testing Playwright workflow...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  try {
    // Step 1: Load search page
    console.log('1. Loading search page...');
    await page.goto(`${BASE_URL}/Query.aspx`, { waitUntil: 'networkidle' });
    console.log('   OK - Search page loaded');

    // Step 2: Submit search form
    console.log('2. Submitting search form...');
    await page.selectOption('#MainContent_ucLicSearchProf_ddProfession', 'Assisted Housing Programs');
    await page.waitForTimeout(500);
    await page.selectOption('#MainContent_ucLicSearchProf_ddState', 'ME');
    await page.click('#MainContent_ucLicSearchProf_btnSearch');
    await page.waitForSelector('#gvLicensees', { timeout: 60000 });
    console.log('   OK - Search submitted');

    // Step 3: Count results
    const html = await page.content();
    const $ = cheerio.load(html);
    const rows = $('#gvLicensees tbody tr').length;
    console.log(`   Found ${rows} facilities`);

    // Step 4: Test first 3 facilities
    console.log('3. Testing first 3 detail pages...');

    for (let i = 0; i < 3; i++) {
      // Get row info
      const row = await page.$(`#gvLicensees tbody tr:nth-child(${i + 1})`);
      if (!row) continue;

      const rowText = await row.textContent();
      const name = rowText?.split('\t')[0]?.trim() || 'Unknown';

      // Click the link
      const link = await row.$('a');
      if (!link) continue;

      await link.click();
      await page.waitForSelector('.attributeRow', { timeout: 30000 });

      // Extract some data
      const detailHtml = await page.content();
      const $detail = cheerio.load(detailHtml);

      const phone = $detail('.attributeRow').filter((_, el) =>
        $detail(el).text().includes('Phone:')
      ).find('.attributeCell').eq(1).text().trim();

      const capacity = $detail('.attributeRow').filter((_, el) =>
        $detail(el).text().includes('Total Capacity:')
      ).find('.attributeCell').eq(1).text().trim();

      console.log(`   [${i + 1}] ${name}`);
      console.log(`       Phone: ${phone || '(not found)'}`);
      console.log(`       Capacity: ${capacity || '(not found)'}`);

      // Go back
      await page.goBack({ waitUntil: 'networkidle' });
      await page.waitForSelector('#gvLicensees', { timeout: 30000 });
    }

    console.log('\n✓ Test passed! Playwright workflow works correctly.');

  } finally {
    await browser.close();
  }
}

test().catch(e => {
  console.error('\n✗ Test failed:', e.message);
  process.exit(1);
});

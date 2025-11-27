import puppeteer, { Page } from 'puppeteer';
import fs from 'fs';

/**
 * Test version - scrapes only 2 facilities to verify everything works
 */

interface FacilityData {
  plainId: string;
  name: string;
  profile?: Record<string, string>;
  services?: Record<string, string>;
}

async function testScraper() {
  console.log('🧪 Starting test scraper...\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 },
  });

  const page = await browser.newPage();
  const facilitiesData: FacilityData[] = [];
  let currentFacility: FacilityData | null = null;

  // Intercept API responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('FacilityProfile') && currentFacility) {
      try {
        const contentType = response.headers()['content-type'];
        if (contentType?.includes('xml') || contentType?.includes('text')) {
          const body = await response.text();
          if (body.includes('<pbres>')) {
            if (body.includes('FACILITY_ID')) {
              console.log('    ✓ Captured profile data');
              currentFacility.profile = parseXml(body);
            } else if (body.includes('SERVICE')) {
              console.log('    ✓ Captured services data');
              currentFacility.services = parseXml(body);
            }
          }
        }
      } catch {}
    }
  });

  function parseXml(xml: string): Record<string, string> {
    const data: Record<string, string> = {};
    const regex = /<s name="([^"]+)"><!\[CDATA\[([^\]]*)\]\]><\/s>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      data[match[1]] = match[2];
    }
    return data;
  }

  async function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  try {
    // Navigate to search page
    console.log('1️⃣ Navigating to search page...');
    await page.goto('https://prod.ltc.age.ohio.gov/FacilitySearch', {
      waitUntil: 'networkidle0',
    });
    console.log('   ✓ Page loaded\n');

    // Select facility type
    console.log('2️⃣ Selecting Nursing Home...');
    await page.click('#ctl00_MainContent_cboFacilityType_ob_CbocboFacilityTypeTB');
    await wait(500);

    await page.evaluate(() => {
      const options = document.querySelectorAll('.ob_iCboICBC li');
      for (const option of options) {
        const iElement = option.querySelector('i');
        if (iElement?.textContent === 'NH') {
          (option as HTMLElement).click();
          return;
        }
      }
    });

    await wait(500);
    console.log('   ✓ Selected\n');

    // Click Search
    console.log('3️⃣ Clicking Search...');
    await page.click('#ctl00_MainContent_btnSubmit');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('   ✓ Search results loaded\n');

    // Get first 2 facilities
    console.log('4️⃣ Getting facility list...');
    const facilities = await page.$$eval('a[facid]', (links) =>
      links.slice(0, 2).map((link) => ({
        plainId: link.getAttribute('facid')!,
        name: link.textContent?.trim() || '',
        controlId: link.getAttribute('id')!,
      }))
    );
    console.log(`   ✓ Found ${facilities.length} facilities to test\n`);

    // Process each facility
    console.log('5️⃣ Scraping facilities...\n');
    for (const facility of facilities) {
      console.log(`  Processing: ${facility.plainId} - ${facility.name}`);

      currentFacility = {
        plainId: facility.plainId,
        name: facility.name,
      };

      try {
        const escapedId = facility.controlId.replace(/\$/g, '\\$');
        await page.click(`a#${escapedId}`);
        await page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle0' });
        await wait(5000); // Wait for AJAX

        facilitiesData.push({ ...currentFacility });
        console.log(`  ✓ Completed\n`);

        await page.goBack();
        await page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle0' });
        await wait(2000);
      } catch (error) {
        console.error(`  ✗ Error: ${error}\n`);
      }
    }

    // Save results
    console.log('6️⃣ Saving data...');
    const output = {
      timestamp: new Date().toISOString(),
      count: facilitiesData.length,
      facilities: facilitiesData,
    };

    fs.writeFileSync('test-output.json', JSON.stringify(output, null, 2));
    console.log('   ✓ Saved to test-output.json\n');

    console.log('✅ Test complete!');
    console.log(`   Scraped ${facilitiesData.length} facilities`);
    console.log(`   Profile fields: ${Object.keys(facilitiesData[0]?.profile || {}).length}`);
    console.log(`   Services fields: ${Object.keys(facilitiesData[0]?.services || {}).length}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testScraper().catch(console.error);

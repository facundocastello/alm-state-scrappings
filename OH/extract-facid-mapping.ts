import puppeteer from 'puppeteer';

/**
 * Extract encrypted facId from URL after clicking facility link
 * Maps: plain ID (04-2104) -> encrypted ID (XmkBHsU855E=)
 */
async function extractFacIdMapping() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const facIdMapping: Record<string, string> = {};

  // Navigate to search results (you'll need to perform search first)
  await page.goto('https://prod.ltc.age.ohio.gov/FacilitySearchResults');

  // TODO: Fill search form and submit to get results
  // For now, assuming we're on a results page like your sl.html

  // Extract all facility links with their plain IDs
  const facilities = await page.$$eval('a[facid]', (links) =>
    links.map((link) => ({
      plainId: link.getAttribute('facid'),
      controlId: link.getAttribute('id'),
    }))
  );

  console.log(`Found ${facilities.length} facilities`);

  // For each facility, click the link and capture the encrypted facId
  for (const facility of facilities.slice(0, 5)) {
    // Only process first 5 for testing
    if (!facility.plainId || !facility.controlId) continue;

    console.log(`\nProcessing: ${facility.plainId}`);

    try {
      // Click the facility link
      await page.click(`a#${facility.controlId.replace(/\$/g, '\\$')}`);

      // Wait for navigation to facility profile
      await page.waitForNavigation({ timeout: 10000 });

      // Extract encrypted facId from URL
      const url = page.url();
      const match = url.match(/facId=([^&]+)/);

      if (match) {
        const encryptedId = decodeURIComponent(match[1]);
        facIdMapping[facility.plainId] = encryptedId;
        console.log(`  Plain: ${facility.plainId} -> Encrypted: ${encryptedId}`);
      }

      // Go back to search results
      await page.goBack();
      await page.waitForSelector('a[facid]', { timeout: 5000 });
    } catch (error) {
      console.error(`Error processing ${facility.plainId}:`, error);
      // Try to recover by going back to search results
      await page.goBack().catch(() => {});
    }
  }

  console.log('\n=== Mapping ===');
  console.log(JSON.stringify(facIdMapping, null, 2));

  await browser.close();

  return facIdMapping;
}

extractFacIdMapping().catch(console.error);

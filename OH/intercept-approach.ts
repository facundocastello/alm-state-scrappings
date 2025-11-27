import puppeteer from 'puppeteer';
import fs from 'fs';

/**
 * EASIER APPROACH: Intercept API responses instead of building facId mapping
 *
 * When you click a facility link, the browser makes multiple AJAX calls:
 * - getFacilityProfile
 * - getServices
 * - getPaymentInformation
 * - getStaffInformation
 * - getQualityMeasures
 *
 * We can intercept these responses and extract the data directly!
 */

interface FacilityData {
  plainId: string;
  name: string;
  profile?: any;
  services?: any;
  payment?: any;
  staff?: any;
  quality?: any;
}

async function scrapeFacilitiesWithIntercept() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const facilitiesData: FacilityData[] = [];
  let currentFacility: FacilityData | null = null;

  // Intercept network responses
  page.on('response', async (response) => {
    const url = response.url();

    // Check if this is one of the facility API calls
    if (url.includes('FacilityProfile')) {
      try {
        const contentType = response.headers()['content-type'];
        if (contentType?.includes('xml') || contentType?.includes('text')) {
          const body = await response.text();

          // Parse the XML response
          if (body.includes('<pbres>') && currentFacility) {
            // Determine which API call this is based on the response content
            if (body.includes('FACILITY_ID')) {
              console.log(`  ✓ Got facility profile`);
              currentFacility.profile = parseXmlResponse(body);
            } else if (body.includes('getServices') || body.includes('SERVICE')) {
              console.log(`  ✓ Got services data`);
              currentFacility.services = parseXmlResponse(body);
            } else if (body.includes('PAYMENT') || body.includes('getPaymentInformation')) {
              console.log(`  ✓ Got payment info`);
              currentFacility.payment = parseXmlResponse(body);
            } else if (body.includes('STAFF') || body.includes('getStaffInformation')) {
              console.log(`  ✓ Got staff info`);
              currentFacility.staff = parseXmlResponse(body);
            } else if (body.includes('QUALITY') || body.includes('getQualityMeasures')) {
              console.log(`  ✓ Got quality measures`);
              currentFacility.quality = parseXmlResponse(body);
            }
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
  });

  // Navigate to search results
  await page.goto('https://prod.ltc.age.ohio.gov/FacilitySearchResults');

  // TODO: Perform search to get results
  // For now, assuming we're on a results page

  // Get all facility links
  const facilities = await page.$$eval('a[facid]', (links) =>
    links.slice(0, 5).map((link) => ({
      plainId: link.getAttribute('facid')!,
      name: link.textContent?.trim() || '',
      controlId: link.getAttribute('id')!,
    }))
  );

  console.log(`Found ${facilities.length} facilities to process\n`);

  // Process each facility
  for (const facility of facilities) {
    console.log(`Processing: ${facility.plainId} - ${facility.name}`);

    // Initialize current facility
    currentFacility = {
      plainId: facility.plainId,
      name: facility.name,
    };

    try {
      // Click the facility link
      const escapedId = facility.controlId.replace(/\$/g, '\\$');
      await page.click(`a#${escapedId}`);

      // Wait for the facility profile page to load and all AJAX calls to complete
      await page.waitForNavigation({ timeout: 10000 });
      await page.waitForTimeout(3000); // Wait for all AJAX calls

      // Save the facility data
      facilitiesData.push({ ...currentFacility });

      console.log(`  ✓ Completed ${facility.plainId}\n`);

      // Go back to search results
      await page.goBack();
      await page.waitForSelector('a[facid]', { timeout: 5000 });
    } catch (error) {
      console.error(`  ✗ Error processing ${facility.plainId}:`, error);
      // Try to recover
      await page.goBack().catch(() => {});
    }
  }

  // Save all collected data
  fs.writeFileSync(
    'facilities-data.json',
    JSON.stringify(facilitiesData, null, 2)
  );

  console.log(`\n✓ Saved data for ${facilitiesData.length} facilities`);

  await browser.close();
}

/**
 * Parse the XML response into a structured object
 */
function parseXmlResponse(xml: string): Record<string, string> {
  const data: Record<string, string> = {};

  // Extract all <s name="..."><![CDATA[...]]></s> elements
  const regex = /<s name="([^"]+)"><!\[CDATA\[([^\]]*)\]\]><\/s>/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const [, name, value] = match;
    data[name] = value;
  }

  return data;
}

// Run the scraper
scrapeFacilitiesWithIntercept().catch(console.error);

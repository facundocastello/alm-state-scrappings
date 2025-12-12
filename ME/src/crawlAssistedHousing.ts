import fs from 'fs';
import path from 'path';
import got from 'got';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { config } from './config.js';
import type { AssistedHousingListing } from './types.js';

const BASE_URL = 'https://www.pfr.maine.gov/ALMSOnline/ALMSQuery';

/**
 * Crawl the assisted housing search results to get fresh tokens.
 * The search is done by submitting a form POST request.
 */
export async function crawlAssistedHousingListings(): Promise<AssistedHousingListing[]> {
  const jar = new CookieJar();
  // @ts-expect-error - got v11 types
  const client = got.extend({
    cookieJar: jar,
    followRedirect: true,
    headers: {
      'User-Agent': config.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    https: { rejectUnauthorized: false },
    timeout: { request: 60000 },
  });

  console.log('Step 1: Loading search page to get session...');

  // First, hit the main query page to establish session
  const queryPageUrl = `${BASE_URL}/Query.aspx`;
  const queryResponse = await client.get(queryPageUrl);
  const $query = cheerio.load(queryResponse.body as string);

  // Extract ASP.NET form fields
  const viewState = $query('#__VIEWSTATE').val() as string || '';
  const viewStateGen = $query('#__VIEWSTATEGENERATOR').val() as string || '';
  const eventValidation = $query('#__EVENTVALIDATION').val() as string || '';

  console.log('  Session established');

  console.log('Step 2: Submitting search form...');

  // Submit the search form
  const searchUrl = `${BASE_URL}/Query.aspx`;
  const formData = new URLSearchParams({
    '__VIEWSTATE': viewState,
    '__VIEWSTATEGENERATOR': viewStateGen,
    '__EVENTVALIDATION': eventValidation,
    'ctl00$MainContent$ucLicSearchProf$ddProfession': 'Assisted Housing Programs',
    'ctl00$MainContent$ucLicSearchProf$txtLicenseNumber': '',
    'ctl00$MainContent$ucLicSearchProf$txtName': '',
    'ctl00$MainContent$ucLicSearchProf$ddState': 'ME',
    'ctl00$MainContent$ucLicSearchProf$txtCity': '',
    'ctl00$MainContent$ucLicSearchProf$ddStatus': '',  // All statuses
    'ctl00$MainContent$ucLicSearchProf$btnSearch': 'Search',
  });

  const searchResponse = await client.post(searchUrl, {
    body: formData.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': queryPageUrl,
    },
  });

  const html = searchResponse.body as string;

  // Save for debugging
  fs.writeFileSync(path.join(config.inputDir, 'assisted-housing-fresh.html'), html);
  console.log('  Saved fresh HTML to input/assisted-housing-fresh.html');

  // Parse results
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
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  crawlAssistedHousingListings()
    .then(facilities => {
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
    })
    .catch(console.error);
}

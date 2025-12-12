import fs from 'fs';
import got from 'got';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';

async function debugCapacity() {
  const jar = new CookieJar();
  const client = got.extend({
    cookieJar: jar,
    followRedirect: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    https: { rejectUnauthorized: false }
  });

  // Parse listing to get fresh URLs
  const listingHtml = fs.readFileSync('./input/assisted-housing.html', 'utf-8');
  const $listing = cheerio.load(listingHtml);

  // Get first ACTIVE facility
  let detailUrl = null;
  $listing('#gvLicensees tbody tr').each((_, row) => {
    if (detailUrl) return;
    const cells = $listing(row).find('td');
    const status = cells.eq(4).text().trim();
    if (status === 'ACTIVE') {
      const link = cells.eq(0).find('a');
      const href = link.attr('href');
      const name = link.text().trim();
      if (href) {
        detailUrl = `https://www.pfr.maine.gov/ALMSOnline/ALMSQuery/${href}`;
        console.log(`Testing: ${name}`);
        console.log(`URL: ${detailUrl}`);
      }
    }
  });

  if (!detailUrl) {
    console.log('No active facility found');
    return;
  }

  // Fetch detail page
  console.log('\nFetching detail page...');
  const response = await client.get(detailUrl);
  const html = response.body;

  // Save for debugging
  fs.writeFileSync('/tmp/me-detail-debug.html', html);
  console.log('Saved to /tmp/me-detail-debug.html');

  // Look for capacity
  const $ = cheerio.load(html);

  console.log('\n--- Looking for Total Capacity ---');

  // Find all attribute rows
  $('.attributeRow').each((i, row) => {
    const cellText = $(row).find('.attributeCell').first().text().trim();
    if (cellText.toLowerCase().includes('capacity')) {
      console.log(`\nFound row with "capacity":`);
      console.log('  Label:', cellText);
      console.log('  Value:', $(row).find('.attributeCell').eq(1).text().trim());
      console.log('  HTML:', $(row).html().substring(0, 500));
    }
  });

  // Also check for any div containing capacity
  console.log('\n--- Any element with "capacity" ---');
  $('*:contains("Capacity")').each((i, el) => {
    const text = $(el).clone().children().remove().end().text().trim();
    if (text.toLowerCase().includes('capacity') && text.length < 100) {
      console.log(`  ${$(el).prop('tagName')}: "${text}"`);
    }
  });
}

debugCapacity().catch(console.error);

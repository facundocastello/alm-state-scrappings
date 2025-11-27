import { httpClient } from './http.js';
import { config } from './config.js';

async function debugReports() {
  const facilityId = 'NJ1A006';
  const url = config.urls.reportsPage(facilityId);

  console.log(`Fetching reports page: ${url}\n`);

  const { $, html } = await httpClient.get(url);

  // Look for all PDF links
  console.log('=== ALL PDF LINKS ===');
  $('a[href$=".pdf"]').each((_, elem) => {
    const $link = $(elem);
    const href = $link.attr('href');
    const text = $link.text().trim();
    console.log(`Text: "${text}" | Href: ${href}`);
  });

  console.log('\n=== ALL SURVEY LINKS (fssurvey.aspx) ===');
  $('a[href*="fssurvey.aspx"]').each((_, elem) => {
    const $link = $(elem);
    const href = $link.attr('href');
    const text = $link.text().trim();
    const $row = $link.closest('tr');
    const rowText = $row.text().replace(/\s+/g, ' ').trim();
    console.log(`Survey ID: "${text}" | Href: ${href}`);
    console.log(`Row context: ${rowText}\n`);
  });

  console.log('\n=== CHECKING FOR ROUTINE INSPECTION SECTION ===');
  const routineSection = $('span:contains("Routine Inspection")');
  console.log(`Found ${routineSection.length} elements containing "Routine Inspection"`);

  if (routineSection.length > 0) {
    console.log('\nRoutine section content:');
    routineSection.each((_, elem) => {
      const $section = $(elem);
      const $table = $section.closest('table');
      console.log($table.html());
    });
  }

  // Look for certification survey links
  console.log('\n=== LOOKING FOR CERTIFICATION/ROUTINE LINKS ===');
  $('a[href*="fsCertDetails"]').each((_, elem) => {
    const $link = $(elem);
    const href = $link.attr('href');
    const text = $link.text().trim();
    console.log(`Cert link: "${text}" | Href: ${href}`);
  });

  // Save full HTML for analysis
  const fs = await import('fs/promises');
  await fs.writeFile('debug-reports-NJ1A006.html', html);
  console.log('\n✓ Saved full HTML to debug-reports-NJ1A006.html');
}

debugReports().catch(console.error);

import got from 'got';
import { CookieJar } from 'tough-cookie';

const cookieJar = new CookieJar();

const client = got.extend({
  cookieJar,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Origin': 'https://weblink.dch.georgia.gov',
  },
});

const API_URL = 'https://weblink.dch.georgia.gov/WebLink/DocumentService.aspx/GetBasicDocumentInfo';

async function main() {
  // Check a few different facility types to see all available fields
  const reports = [
    { id: 214139, name: 'Corso Atlanta (Assisted Living)' },
    { id: 147803, name: 'Lavender Meadows (Adult Day - has phone/email)' },
  ];

  // Let's check one that has phone/email in the CSV
  // From CSV: 147803,ADULT DAY CENTER,ADULT DAY CENTERS,LAVENDER MEADOWS ADULT DAY HEALTH,No,4702104625,lavendermeadowsga@gmail.com
  // Need to find its newest report

  for (const r of reports) {
    console.log(`\n=== ${r.name} (entryId: ${r.id}) ===`);
    try {
      const response = await client.post(API_URL, {
        json: { repoName: 'WEB', entryId: r.id },
        responseType: 'json',
      });

      const data = response.body as any;
      console.log(`Report name: ${data.data.name}`);
      console.log('\nAll metadata fields:');
      for (const field of data.data.metadata.fInfo) {
        console.log(`  ${field.name}: ${field.values.join(', ')}`);
      }
    } catch (e) {
      console.log(`Error: ${e}`);
    }
  }
}

main().catch(console.error);

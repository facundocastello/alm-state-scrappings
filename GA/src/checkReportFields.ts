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
  // Corso Atlanta newest report
  const response = await client.post(API_URL, {
    json: { repoName: 'WEB', entryId: 214139 },
    responseType: 'json',
  });

  const data = response.body as any;
  console.log('=== All fields from newest Corso Atlanta report (214139) ===\n');

  for (const field of data.data.metadata.fInfo) {
    console.log(`${field.name}: ${field.values.join(', ')}`);
  }
}

main().catch(console.error);

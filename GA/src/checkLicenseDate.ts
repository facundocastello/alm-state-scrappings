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

interface DocumentInfoResponse {
  data: {
    name: string;
    metadata: {
      fInfo: Array<{ name: string; values: string[] }>;
    };
  };
}

async function fetchReportInfo(entryId: number) {
  const response = await client.post<DocumentInfoResponse>(API_URL, {
    json: { repoName: 'WEB', entryId },
    responseType: 'json',
  });
  return response.body;
}

// ARCHWAY TRANSITIONAL CARE CENTER (133207) reports to compare:
// INITIAL (2017): entryId 135850 - "1/6/2017 - INITIAL HEALTH SURVEY"
// Recent (2025): entryId 211764 - "09/12/2024 - ROUTINE HEALTH SURVEY"

async function main() {
  console.log('Checking if License Effective Date changes over time...\n');

  // Facility: ARCHWAY TRANSITIONAL CARE CENTER
  const reports = [
    { id: 135850, desc: '2017 INITIAL HEALTH SURVEY' },
    { id: 211764, desc: '2024 ROUTINE HEALTH SURVEY' },
  ];

  for (const r of reports) {
    console.log(`=== ${r.desc} (entryId: ${r.id}) ===`);
    const info = await fetchReportInfo(r.id);
    console.log(`Report name: ${info.data.name}`);

    const licenseDate = info.data.metadata.fInfo.find(f => f.name === 'License Effective Date');
    const surveyDate = info.data.metadata.fInfo.find(f => f.name === 'Survey Date');

    console.log(`Survey Date: ${surveyDate?.values?.[0] || 'N/A'}`);
    console.log(`License Effective Date: ${licenseDate?.values?.[0] || 'N/A'}`);
    console.log('');
  }

  // Let's also check another facility with multiple reports
  console.log('\n--- Checking PRUITTHEALTH - FAIRBURN (135975) ---');
  const pruittReports = [
    { id: 155188, desc: '2017 OTHER HEALTH (old)' },  // From the JSON
    { id: 191709, desc: '2023 ROUTINE HEALTH' },
  ];

  // Actually let me check the facility we know has an INITIAL
  console.log('\n--- Checking BOSTICK NURSING CENTER (134926) ---');
  // Has INITIAL: 4/6/2017 and License: 4/26/2017
  const bostickReports = [
    { id: 134927, desc: 'Oldest report' },  // Guessing ID near facility
  ];

  // Let me just get ALL license dates from different years for one facility
  console.log('\n--- Sampling multiple facilities to compare INITIAL vs RECENT ---');

  // From mismatches: ARCHWAY - Initial: 1/6/2017, License in metadata: 3/8/2017
  // Let's see what the INITIAL report itself says
}

main().catch(console.error);

import { httpClient } from './http.js';
import { config } from './config.js';
import { readFile } from 'fs/promises';

async function checkFacility(facilityId: string): Promise<{
  id: string;
  hasAdvisory: boolean;
  hasReportCard: boolean;
}> {
  try {
    const url = config.urls.facilityDetails(facilityId);

    // Get Tab 0 and extract ViewState
    const { $ } = await httpClient.get(url);
    const viewState = httpClient.extractViewState($);

    // Check Tab 2 (Advisory Standards)
    const tab2Data = httpClient.buildTabPostData(viewState, 2);
    const { $: $tab2 } = await httpClient.post(url, tab2Data);
    const tab2Text = $tab2.root().text().toLowerCase();
    const hasAdvisory = !tab2Text.includes('not applicable') &&
                        !tab2Text.includes('no data available') &&
                        $tab2('table.infotable').length > 2;

    // Check Tab 3 (Report Card)
    const tab3Data = httpClient.buildTabPostData(viewState, 3);
    const { $: $tab3 } = await httpClient.post(url, tab3Data);
    const tab3Text = $tab3.root().text().toLowerCase();
    const hasReportCard = !tab3Text.includes('not applicable') &&
                          !tab3Text.includes('no data available') &&
                          $tab3('table.infotable').length > 2;

    console.log(`${facilityId}: Advisory=${hasAdvisory}, ReportCard=${hasReportCard}`);

    return {
      id: facilityId,
      hasAdvisory,
      hasReportCard
    };
  } catch (error) {
    console.error(`Failed to check ${facilityId}:`, error);
    return {
      id: facilityId,
      hasAdvisory: false,
      hasReportCard: false
    };
  }
}

async function findTabData() {
  console.log('Searching for facilities with Advisory Standards and Report Card data...\n');

  // Load facility IDs
  const content = await readFile('./nj.txt', 'utf-8');
  const allIds = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Test a diverse sample
  const idsToTest = [
    // NJ60* - Nursing homes (likely to have report card)
    'NJ60104', 'NJ60103', 'NJ60102', 'NJ60106', 'NJ60113', 'NJ60115',
    'NJ60201', 'NJ60203', 'NJ60204', 'NJ60205', 'NJ60206', 'NJ60207',
    'NJ60208', 'NJ60210', 'NJ60214', 'NJ60215', 'NJ60217', 'NJ60218',

    // NJAL* - Assisted living (might have advisory)
    'NJAL0101', 'NJAL0103', 'NJAL02000', 'NJAL02005', 'NJAL02007', 'NJAL0209',

    // NJ01A*, NJ1A* - Adult care
    'NJ01A007', 'NJ1A000', 'NJ1A001', 'NJ1A002', 'NJ1A003',

    // Other types
    'NJ02A029', 'NJ02A016', 'NJ02A026', 'NJ5C000', 'NJ5C001'
  ];

  const results = [];

  for (const id of idsToTest) {
    const result = await checkFacility(id);
    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================\n');

  const withAdvisory = results.filter(r => r.hasAdvisory);
  const withReportCard = results.filter(r => r.hasReportCard);

  console.log(`✓ Found ${withAdvisory.length} facilities with Advisory Standards:`);
  withAdvisory.forEach(r => console.log(`  - ${r.id}`));

  console.log(`\n✓ Found ${withReportCard.length} facilities with Report Card:`);
  withReportCard.forEach(r => console.log(`  - ${r.id}`));

  if (withAdvisory.length > 0) {
    console.log(`\n📋 Test Advisory Standards with: ${withAdvisory[0].id}`);
  }
  if (withReportCard.length > 0) {
    console.log(`📋 Test Report Card with: ${withReportCard[0].id}`);
  }
}

findTabData().catch(console.error);

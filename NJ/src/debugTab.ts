import { httpClient } from './http.js';
import { config } from './config.js';
import { writeFile } from 'fs/promises';

async function debugTabs() {
  const facilityId = 'NJ60104'; // Nursing home - most likely to have data
  const url = config.urls.facilityDetails(facilityId);

  console.log(`Debugging tabs for ${facilityId}...\n`);

  // Get Tab 0 and extract ViewState
  const { html: html0, $ } = await httpClient.get(url);
  const viewState = httpClient.extractViewState($);

  console.log('ViewState tokens:');
  console.log(`  __VIEWSTATE: ${viewState.__VIEWSTATE.substring(0, 50)}...`);
  console.log(`  __VIEWSTATEGENERATOR: ${viewState.__VIEWSTATEGENERATOR}`);
  console.log(`  __EVENTVALIDATION: ${viewState.__EVENTVALIDATION.substring(0, 50)}...\n`);

  // Save Tab 0 HTML
  await writeFile('debug-tab0.html', html0);
  console.log('✓ Saved Tab 0 to debug-tab0.html');

  // Check Tab 1 (Inspections)
  console.log('\nFetching Tab 1 (Inspection Summaries)...');
  const tab1Data = httpClient.buildTabPostData(viewState, 1);
  console.log('POST data:', tab1Data);
  const { html: html1, $: $tab1 } = await httpClient.post(url, tab1Data);
  await writeFile('debug-tab1.html', html1);
  console.log('✓ Saved Tab 1 to debug-tab1.html');

  // Look for inspection numbers
  const routineText = $tab1.root().text();
  console.log('\nSearching for "Number of Routine Inspections" in Tab 1...');
  if (routineText.includes('Number of Routine Inspections')) {
    console.log('  ✓ Found inspection text');
    const match = routineText.match(/Number of Routine Inspections[:\s]*(\d+)/);
    if (match) {
      console.log(`  ✓ Extracted count: ${match[1]}`);
    } else {
      console.log('  ✗ Could not extract count');
    }
  } else {
    console.log('  ✗ Inspection text NOT found');
  }

  // Check Tab 2 (Advisory)
  console.log('\nFetching Tab 2 (Advisory Standards)...');
  const tab2Data = httpClient.buildTabPostData(viewState, 2);
  const { html: html2 } = await httpClient.post(url, tab2Data);
  await writeFile('debug-tab2.html', html2);
  console.log('✓ Saved Tab 2 to debug-tab2.html');

  // Check Tab 3 (Report Card)
  console.log('\nFetching Tab 3 (Nursing Home Report Card)...');
  const tab3Data = httpClient.buildTabPostData(viewState, 3);
  const { html: html3 } = await httpClient.post(url, tab3Data);
  await writeFile('debug-tab3.html', html3);
  console.log('✓ Saved Tab 3 to debug-tab3.html');

  console.log('\n✓ Done! Check debug-tab*.html files');
}

debugTabs().catch(console.error);

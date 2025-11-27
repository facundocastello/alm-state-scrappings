import { scrapeFacility } from './scrapeFacility.js';
import { fetchAndDownloadReports } from './reportDownloader.js';
import { expectedNJ1A006, compareResults } from './testExpected.js';

async function test() {
  const testId = 'NJ1A006'; // Heritage Assisted Living - assisted living residence
  console.log(`Testing with facility: ${testId}\n`);

  try {
    // Test scraping
    const facilityDetail = await scrapeFacility(testId);

    console.log('\nFacility Details:');
    console.log('=================');
    console.log(`Name: ${facilityDetail.facilityName}`);
    console.log(`Type: ${facilityDetail.licenseType}`);
    console.log(`Status: ${facilityDetail.facilityStatus}`);
    console.log(`Address: ${facilityDetail.address}, ${facilityDetail.city}, ${facilityDetail.zipCode}`);
    console.log(`County: ${facilityDetail.county}`);
    console.log(`Phone: ${facilityDetail.phone || 'N/A'}`);
    console.log(`Administrator: ${facilityDetail.administrator || 'N/A'}`);
    console.log(`Owner: ${facilityDetail.licenseeName || 'N/A'}`);

    console.log(`\nBeds: ${facilityDetail.beds.length} types`);
    if (facilityDetail.beds.length > 0) {
      facilityDetail.beds.forEach(bed => {
        console.log(`  - ${bed.type}: ${bed.count}`);
      });
    } else {
      console.log('  (no bed information)');
    }

    console.log(`\nRoutine Inspections:`);
    console.log(`  Count: ${facilityDetail.inspectionSummaries.routine.inspectionCount}`);
    console.log(`  Deficiencies: ${facilityDetail.inspectionSummaries.routine.deficiencyCount}`);
    console.log(`  Scope & Severity: ${facilityDetail.inspectionSummaries.routine.maxScopeAndSeverity || '(empty)'}`);

    console.log(`\nComplaint Inspections:`);
    console.log(`  Count: ${facilityDetail.inspectionSummaries.complaint.inspectionCount}`);
    console.log(`  Deficiencies: ${facilityDetail.inspectionSummaries.complaint.deficiencyCount}`);
    console.log(`  Scope & Severity: ${facilityDetail.inspectionSummaries.complaint.maxScopeAndSeverity || '(empty)'}`);

    console.log(`\nAdvisory Data: ${facilityDetail.hasAdvisoryData ? 'Yes' : 'No'}`);
    console.log(`Report Card: ${facilityDetail.hasReportCard ? 'Yes' : 'No'}`);

    // Test report fetching
    console.log(`\n\nFetching reports...`);
    const reports = await fetchAndDownloadReports(testId);

    // Build complete facility record
    const actualRecord = {
      ...facilityDetail,
      reports,
      reportsTotal: reports.length,
      dataCompleteness: 'minimal' as const,
      scrapedAt: new Date().toISOString()
    };

    console.log(`\nFound ${reports.length} reports:`);
    reports.forEach((report, i) => {
      console.log(`${i + 1}. [${report.reportType}] ${report.reportDate} - ${report.fileName}`);
    });

    // Compare with expected output
    compareResults(actualRecord, expectedNJ1A006);

    console.log('\n✓ Test completed!');
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

test();

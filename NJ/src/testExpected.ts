import { FacilityRecord } from './types.js';

/**
 * Expected output for facility NJ60104 based on actual HTML analysis
 */
export const expectedNJ60104: FacilityRecord = {
  // Basic Info (Tab 0)
  facilityId: 'NJ60104',
  licenseNumber: '060104',
  facilityName: 'Complete Care At Linwood, Llc',
  licenseType: 'Long Term Care Facility',
  facilityStatus: 'ACTIVE', // Inferred from having active license
  licenseStatus: 'REGULAR', // Inferred from expiration date

  // Address
  address: '201 New Road And Central Ave',
  city: 'Linwood',
  county: 'Atlantic', // Need to infer or look up by zip
  state: 'NJ',
  zipCode: '08221',
  phone: '(609) 927-6131',

  // License dates
  licenseEffectiveDate: null, // Not shown in HTML
  licenseExpirationDate: '05/31/2026',

  // Owner/Officer (Tab 0 - currently NOT parsed)
  licenseeName: 'COMPLETE CARE AT LINWOOD, LLC',
  licenseeAddress: null, // Not shown
  licenseePhone: null, // Not shown
  administrator: 'Mr. ELIEZER SEEVE',

  // Beds (Tab 0 - currently NOT parsed)
  beds: [
    { type: 'Ventilator', count: 16 },
    { type: 'Long Term Care Beds', count: 158 }
  ],
  capacity: 174, // Sum of all beds

  // Inspection Summaries (Tab 1 via ViewState POST - currently returning zeros)
  inspectionSummaries: {
    routine: {
      inspectionCount: 13,
      deficiencyCount: 37,
      maxScopeAndSeverity: 'K',
      moreInfoUrl: 'fsCertDetails.aspx?item=NJ60104'
    },
    complaint: {
      inspectionCount: 6,
      deficiencyCount: 9,
      maxScopeAndSeverity: 'E',
      moreInfoUrl: 'fsCompDetails.aspx?item=NJ60104'
    }
  },

  // Advisory Standards (Tab 2) - need to check
  hasAdvisoryData: false, // Likely "Not applicable" for this facility

  // Report Card (Tab 3) - need to check
  hasReportCard: true, // NJ60* facilities (nursing homes) should have this

  // Reports from both routine and complaint pages
  // Note: Actual report count will be higher due to routine inspections
  reports: [
    {
      reportType: 'COMPLAINT',
      reportDate: '2023-12-29', // Parsed from complaint table
      fileName: 'ZJHL11.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=ZJHL11.pdf&facid=NJ60104',
      localPath: 'reports/NJ60104/20231229-COMPLAINT-ZJHL11.pdf'
    },
    {
      reportType: 'COMPLAINT',
      reportDate: '2022-06-22',
      fileName: 'TCMH11.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=TCMH11.pdf&facid=NJ60104',
      localPath: 'reports/NJ60104/20220622-COMPLAINT-TCMH11.pdf'
    },
    {
      reportType: 'COMPLAINT',
      reportDate: '2021-10-01',
      fileName: '769W11.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=769W11.pdf&facid=NJ60104',
      localPath: 'reports/NJ60104/20211001-COMPLAINT-769W11.pdf'
    },
    {
      reportType: 'COMPLAINT',
      reportDate: '2021-06-25',
      fileName: 'Z5J011.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=Z5J011.pdf&facid=NJ60104',
      localPath: 'reports/NJ60104/20210625-COMPLAINT-Z5J011.pdf'
    },
    {
      reportType: 'COMPLAINT',
      reportDate: '2021-01-13',
      fileName: 'F47311.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=F47311.pdf&facid=NJ60104',
      localPath: 'reports/NJ60104/20210113-COMPLAINT-F47311.pdf'
    },
    {
      reportType: 'REPORT',
      reportDate: '2025-11-19', // Generic privacy notice, date = today
      fileName: 'notice_of_privacy_practices.pdf',
      downloadUrl: 'https://www.nj.gov/health/documents/notice_of_privacy_practices.pdf',
      localPath: 'reports/NJ60104/20251119-REPORT-notice_of_privacy_practices.pdf'
    }
    // Note: Routine inspection reports not listed here but will be included in actual scraping
  ],
  reportsTotal: 19, // Updated: 13 routine + 5 complaint + 1 privacy notice

  // Metadata
  dataCompleteness: 'full', // Has inspections + likely has report card
  profileUrl: 'https://healthapps.nj.gov/facilities/fsFacilityDetails.aspx?item=NJ60104',
  reportsPageUrl: 'https://healthapps.nj.gov/facilities/fsCompDetails.aspx?item=NJ60104',
  scrapedAt: '2025-11-19T00:00:00.000Z' // Placeholder
};

/**
 * Expected output for facility NJ1A006 (Assisted Living Residence)
 * Based on actual data scraped from live site
 */
export const expectedNJ1A006: FacilityRecord = {
  // Basic Info (Tab 0)
  facilityId: 'NJ1A006',
  licenseNumber: '1a006',
  facilityName: 'Heritage Assisted Living, The',
  licenseType: 'Assisted Living Residence',
  facilityStatus: 'UNKNOWN', // Not shown in assisted living facilities
  licenseStatus: 'REGULAR',

  // Address - actual values from scraping
  address: '45 Route 206',
  city: 'Hammonton',
  county: '', // Not populated for this facility type
  state: 'NJ',
  zipCode: '08037',
  phone: '(609) 561-8977',

  // License dates
  licenseEffectiveDate: null, // Not shown in current HTML
  licenseExpirationDate: null, // Not shown in current HTML

  // Owner/Officer
  licenseeName: 'RT. 206 INC.',
  licenseeAddress: null,
  licenseePhone: null,
  administrator: 'XIOMARA JOHNSON',

  // Beds - Single type for assisted living
  beds: [
    { type: 'Assisted Living Beds', count: 107 }
  ],
  capacity: 107,

  // Inspection Summaries (Tab 1)
  inspectionSummaries: {
    routine: {
      inspectionCount: 4,
      deficiencyCount: 8,
      maxScopeAndSeverity: null, // Empty in HTML: <span class="black13bold"></span>
      moreInfoUrl: 'fsCertDetails.aspx?item=NJ1A006'
    },
    complaint: {
      inspectionCount: 5,
      deficiencyCount: 16,
      maxScopeAndSeverity: null, // Empty in HTML
      moreInfoUrl: 'fsCompDetails.aspx?item=NJ1A006'
    }
  },

  // Advisory Standards (Tab 2)
  hasAdvisoryData: false,

  // Report Card (Tab 3)
  hasReportCard: false,

  // Reports - 9 total (3 routine + 5 complaint + 1 privacy notice)
  // 2 complaint reports were not available electronically
  reports: [
    {
      reportType: 'ROUTINE',
      reportDate: '2021-09-21',
      fileName: 'VDG511.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=VDG511.pdf&facid=NJ1A006',
      localPath: 'reports/NJ1A006/20210921-ROUTINE-VDG511.pdf'
    },
    {
      reportType: 'ROUTINE',
      reportDate: '2021-07-08',
      fileName: 'EJ7E11.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=EJ7E11.pdf&facid=NJ1A006',
      localPath: 'reports/NJ1A006/20210708-ROUTINE-EJ7E11.pdf'
    },
    {
      reportType: 'ROUTINE',
      reportDate: '2020-11-20',
      fileName: 'JHF611.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=JHF611.pdf&facid=NJ1A006',
      localPath: 'reports/NJ1A006/20201120-ROUTINE-JHF611.pdf'
    },
    {
      reportType: 'REPORT',
      reportDate: '2025-11-19',
      fileName: 'notice_of_privacy_practices.pdf',
      downloadUrl: 'https://www.nj.gov/health/documents/notice_of_privacy_practices.pdf',
      localPath: 'reports/NJ1A006/20251119-REPORT-notice_of_privacy_practices.pdf'
    },
    {
      reportType: 'COMPLAINT',
      reportDate: '2025-03-28',
      fileName: 'HZZS11.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=HZZS11.pdf&facid=NJ1A006',
      localPath: '' // Not available electronically
    },
    {
      reportType: 'COMPLAINT',
      reportDate: '2024-12-13',
      fileName: 'BK7111.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=BK7111.pdf&facid=NJ1A006',
      localPath: '' // Not available electronically
    },
    {
      reportType: 'COMPLAINT',
      reportDate: '2023-02-14',
      fileName: 'W5TR11.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=W5TR11.pdf&facid=NJ1A006',
      localPath: 'reports/NJ1A006/20230214-COMPLAINT-W5TR11.pdf'
    },
    {
      reportType: 'COMPLAINT',
      reportDate: '2022-07-22',
      fileName: 'S79011.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=S79011.pdf&facid=NJ1A006',
      localPath: 'reports/NJ1A006/20220722-COMPLAINT-S79011.pdf'
    },
    {
      reportType: 'COMPLAINT',
      reportDate: '2022-06-10',
      fileName: 'ZIT211.pdf',
      downloadUrl: 'https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id=ZIT211.pdf&facid=NJ1A006',
      localPath: 'reports/NJ1A006/20220610-COMPLAINT-ZIT211.pdf'
    }
  ],
  reportsTotal: 9,

  // Metadata
  dataCompleteness: 'full',
  profileUrl: 'https://healthapps.nj.gov/facilities/fsFacilityDetails.aspx?item=NJ1A006',
  reportsPageUrl: 'https://healthapps.nj.gov/facilities/fsCompDetails.aspx?item=NJ1A006',
  scrapedAt: '2025-11-19T00:00:00.000Z'
};

/**
 * Compare actual vs expected output
 */
export function compareResults(actual: FacilityRecord, expected: FacilityRecord): void {
  console.log('\n========================================');
  console.log(`COMPARISON: ${expected.facilityId}`);
  console.log('========================================\n');

  const checks = [
    {
      field: 'Facility Name',
      expected: expected.facilityName,
      actual: actual.facilityName,
      match: actual.facilityName === expected.facilityName
    },
    {
      field: 'License Number',
      expected: expected.licenseNumber,
      actual: actual.licenseNumber,
      match: actual.licenseNumber === expected.licenseNumber
    },
    {
      field: 'Address',
      expected: expected.address,
      actual: actual.address,
      match: actual.address === expected.address
    },
    {
      field: 'City',
      expected: expected.city,
      actual: actual.city,
      match: actual.city === expected.city
    },
    {
      field: 'Phone',
      expected: expected.phone,
      actual: actual.phone,
      match: actual.phone === expected.phone
    },
    {
      field: 'Administrator',
      expected: expected.administrator,
      actual: actual.administrator,
      match: actual.administrator === expected.administrator
    },
    {
      field: 'Licensed Owner',
      expected: expected.licenseeName,
      actual: actual.licenseeName,
      match: actual.licenseeName === expected.licenseeName
    },
    {
      field: 'Beds Count',
      expected: expected.beds.length,
      actual: actual.beds.length,
      match: actual.beds.length === expected.beds.length
    },
    {
      field: 'Ventilator Beds',
      expected: expected.beds.find(b => b.type === 'Ventilator')?.count || 0,
      actual: actual.beds.find(b => b.type === 'Ventilator')?.count || 0,
      match: (expected.beds.find(b => b.type === 'Ventilator')?.count || 0) ===
             (actual.beds.find(b => b.type === 'Ventilator')?.count || 0)
    },
    {
      field: 'Long Term Care Beds',
      expected: expected.beds.find(b => b.type === 'Long Term Care Beds')?.count || 0,
      actual: actual.beds.find(b => b.type === 'Long Term Care Beds')?.count || 0,
      match: (expected.beds.find(b => b.type === 'Long Term Care Beds')?.count || 0) ===
             (actual.beds.find(b => b.type === 'Long Term Care Beds')?.count || 0)
    },
    {
      field: 'Routine Inspections',
      expected: expected.inspectionSummaries.routine.inspectionCount,
      actual: actual.inspectionSummaries.routine.inspectionCount,
      match: actual.inspectionSummaries.routine.inspectionCount ===
             expected.inspectionSummaries.routine.inspectionCount
    },
    {
      field: 'Routine Deficiencies',
      expected: expected.inspectionSummaries.routine.deficiencyCount,
      actual: actual.inspectionSummaries.routine.deficiencyCount,
      match: actual.inspectionSummaries.routine.deficiencyCount ===
             expected.inspectionSummaries.routine.deficiencyCount
    },
    {
      field: 'Routine Scope & Severity',
      expected: expected.inspectionSummaries.routine.maxScopeAndSeverity || '(none)',
      actual: actual.inspectionSummaries.routine.maxScopeAndSeverity || '(none)',
      match: actual.inspectionSummaries.routine.maxScopeAndSeverity ===
             expected.inspectionSummaries.routine.maxScopeAndSeverity
    },
    {
      field: 'Complaint Inspections',
      expected: expected.inspectionSummaries.complaint.inspectionCount,
      actual: actual.inspectionSummaries.complaint.inspectionCount,
      match: actual.inspectionSummaries.complaint.inspectionCount ===
             expected.inspectionSummaries.complaint.inspectionCount
    },
    {
      field: 'Complaint Deficiencies',
      expected: expected.inspectionSummaries.complaint.deficiencyCount,
      actual: actual.inspectionSummaries.complaint.deficiencyCount,
      match: actual.inspectionSummaries.complaint.deficiencyCount ===
             expected.inspectionSummaries.complaint.deficiencyCount
    },
    {
      field: 'Complaint Scope & Severity',
      expected: expected.inspectionSummaries.complaint.maxScopeAndSeverity || '(none)',
      actual: actual.inspectionSummaries.complaint.maxScopeAndSeverity || '(none)',
      match: actual.inspectionSummaries.complaint.maxScopeAndSeverity ===
             expected.inspectionSummaries.complaint.maxScopeAndSeverity
    },
    {
      field: 'Reports Count',
      expected: expected.reportsTotal,
      actual: actual.reportsTotal,
      match: actual.reportsTotal === expected.reportsTotal
    }
  ];

  let passCount = 0;
  let failCount = 0;

  checks.forEach(check => {
    const status = check.match ? '✅ PASS' : '❌ FAIL';
    if (check.match) passCount++;
    else failCount++;

    console.log(`${status} | ${check.field}`);
    if (!check.match) {
      console.log(`       Expected: ${check.expected}`);
      console.log(`       Actual:   ${check.actual}`);
    }
  });

  console.log('\n========================================');
  console.log(`RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log('========================================\n');

  if (failCount > 0) {
    console.log('🔍 FAILURES BREAKDOWN:\n');

    if (actual.beds.length === 0) {
      console.log('❌ BED PARSING FAILED');
      console.log('   - Expected 2 bed types (Ventilator: 16, Long Term Care: 158)');
      console.log('   - Got empty array');
      console.log('   - Issue: HTML has label+count in single <td>, need to parse differently\n');
    }

    if (!actual.licenseeName) {
      console.log('❌ OWNER PARSING FAILED');
      console.log('   - Expected: "COMPLETE CARE AT LINWOOD, LLC"');
      console.log('   - Got: null');
      console.log('   - Issue: Owner name is inside <a> tag, not plain text\n');
    }

    if (actual.inspectionSummaries.routine.inspectionCount === 0) {
      console.log('❌ INSPECTION PARSING FAILED');
      console.log('   - Expected routine: 13 inspections, 37 deficiencies, scope "K"');
      console.log('   - Got: 0 inspections, 0 deficiencies, no scope');
      console.log('   - Issue: ViewState POST to Tab 1 failed OR parsing logic wrong\n');
    }

    if (actual.inspectionSummaries.complaint.inspectionCount === 0) {
      console.log('❌ COMPLAINT PARSING FAILED');
      console.log('   - Expected complaint: 6 inspections, 9 deficiencies, scope "E"');
      console.log('   - Got: 0 inspections, 0 deficiencies, no scope');
      console.log('   - Issue: Same as routine inspection parsing\n');
    }
  }
}

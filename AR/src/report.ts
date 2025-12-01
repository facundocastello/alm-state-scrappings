/**
 * HTML Report Generator for Arizona Facility Inspections
 */
import fs from "fs/promises";
import path from "path";
import type { ScrapedFacility, InspectionDetails, DeficiencyItem, Inspection } from "./types.js";

const REPORTS_DIR = "reports";

/**
 * Decode HTML entities from API and escape for display
 */
function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';
  // First decode any pre-escaped entities from the API
  let decoded = text
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // Then escape for safe HTML display
  return decoded
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert newlines to HTML breaks
 */
function nl2br(text: string | undefined | null): string {
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, "<br>\n");
}

/**
 * Generate HTML for a single deficiency item
 */
function renderDeficiency(item: DeficiencyItem, index: number): string {
  return `
    <div class="deficiency">
      <h4>Deficiency #${index + 1}</h4>
      <div class="deficiency-section">
        <h5>Rule/Regulation Violated:</h5>
        <div class="rule">${nl2br(item.rule)}</div>
      </div>
      <div class="deficiency-section">
        <h5>Evidence/Findings:</h5>
        <div class="evidence">${nl2br(item.evidence)}</div>
      </div>
      ${item.temporarySolution ? `
      <div class="deficiency-section">
        <h5>Temporary Solution:</h5>
        <div class="solution">${nl2br(item.temporarySolution)}</div>
      </div>` : ''}
      ${item.permanentSolution ? `
      <div class="deficiency-section">
        <h5>Permanent Solution:</h5>
        <div class="solution">${nl2br(item.permanentSolution)}</div>
      </div>` : ''}
      ${item.personResponsible ? `
      <div class="deficiency-section">
        <h5>Person Responsible:</h5>
        <div>${escapeHtml(item.personResponsible)}</div>
      </div>` : ''}
    </div>
  `;
}

/**
 * Generate HTML for a single inspection
 */
function renderInspection(
  inspection: Inspection,
  details: InspectionDetails | undefined
): string {
  const deficiencies = details?.inspectionItems || [];
  const hasDeficiencies = deficiencies.length > 0;

  return `
    <div class="inspection ${hasDeficiencies ? 'has-deficiencies' : 'no-deficiencies'}">
      <div class="inspection-header">
        <h3>${escapeHtml(inspection.inspectionName)}</h3>
        <span class="inspection-status ${inspection.inspectionStatus.toLowerCase()}">${escapeHtml(inspection.inspectionStatus)}</span>
      </div>

      <div class="inspection-meta">
        <div class="meta-item">
          <strong>Date:</strong> ${escapeHtml(inspection.inspectionDates)}
        </div>
        <div class="meta-item">
          <strong>Type:</strong> ${escapeHtml(inspection.inspectionType)}
        </div>
        <div class="meta-item">
          <strong>Worksheet:</strong> ${escapeHtml(inspection.worksheetType)}
        </div>
        ${inspection.inspectionSODSentDate ? `
        <div class="meta-item">
          <strong>SOD Sent:</strong> ${escapeHtml(inspection.inspectionSODSentDate)}
        </div>` : ''}
      </div>

      <div class="inspection-comments">
        <h4>Summary:</h4>
        <p>${nl2br(inspection.initialComments)}</p>
      </div>

      ${inspection.federalComment ? `
      <div class="inspection-comments federal">
        <h4>Federal Comments:</h4>
        <p>${nl2br(inspection.federalComment)}</p>
      </div>` : ''}

      ${hasDeficiencies ? `
      <div class="deficiencies">
        <h4>Deficiencies Found: ${deficiencies.length}</h4>
        ${deficiencies.map((d, i) => renderDeficiency(d, i)).join('\n')}
      </div>` : `
      <div class="no-deficiencies-note">
        <p>✓ No deficiencies cited during this inspection.</p>
      </div>`}
    </div>
  `;
}

/**
 * Generate full HTML report for a facility
 */
export function generateFacilityReport(facility: ScrapedFacility): string {
  const details = facility.details;
  const inspections = facility.inspections;

  // Sort inspections by date (newest first)
  const sortedInspections = [...inspections].sort((a, b) => {
    const dateA = new Date(a.inspectionStartDate);
    const dateB = new Date(b.inspectionStartDate);
    return dateB.getTime() - dateA.getTime();
  });

  // Count deficiencies
  let totalDeficiencies = 0;
  for (const insp of inspections) {
    const inspDetails = facility.inspectionDetails.get(insp.inspectionId);
    totalDeficiencies += inspDetails?.inspectionItems?.length || 0;
  }

  // Services list
  const servicesHtml = details?.facilityServices?.length
    ? `<ul>${details.facilityServices.map(s =>
        `<li>${escapeHtml(s.Service_Type__c)}${s.Capacity__c ? ` (Capacity: ${s.Capacity__c})` : ''}</li>`
      ).join('')}</ul>`
    : '<p>No services listed</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(details?.legalName || 'Facility Report')} - Inspection Report</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: radial-gradient(143.01% 143.03% at 52.48% 3.98%,#fc8fb8 17%,#ff649e 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .header h1 { margin: 0 0 10px 0; font-size: 1.8em; }
    .header .subtitle { opacity: 0.9; font-size: 1.1em; }
    .facility-info {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
    }
    .info-item { padding: 10px; background: #f8f9fa; border-radius: 4px; }
    .info-item strong { color: #fc8fb8; display: block; margin-bottom: 5px; }
    .summary-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stat-card .number { font-size: 2em; font-weight: bold; color: #fc8fb8; }
    .stat-card .label { color: #666; }
    .stat-card.warning .number { color: #c53030; }
    .stat-card.success .number { color: #2f855a; }
    .inspection {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-left: 4px solid #2f855a;
    }
    .inspection.has-deficiencies { border-left-color: #c53030; }
    .inspection-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .inspection-header h3 { margin: 0; color: #fc8fb8; }
    .inspection-status {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 500;
    }
    .inspection-status.complete { background: #c6f6d5; color: #22543d; }
    .inspection-status.pending { background: #feebc8; color: #744210; }
    .inspection-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 15px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .meta-item { font-size: 0.9em; }
    .inspection-comments { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 4px; }
    .inspection-comments h4 { margin: 0 0 10px 0; color: #fc8fb8; }
    .inspection-comments.federal { background: #ebf8ff; }
    .deficiencies { margin-top: 20px; }
    .deficiencies > h4 { color: #c53030; border-bottom: 2px solid #c53030; padding-bottom: 10px; }
    .deficiency {
      background: #fff5f5;
      border: 1px solid #feb2b2;
      border-radius: 8px;
      padding: 20px;
      margin: 15px 0;
    }
    .deficiency h4 { color: #c53030; margin: 0 0 15px 0; }
    .deficiency-section { margin: 15px 0; }
    .deficiency-section h5 { color: #fc8fb8; margin: 0 0 8px 0; font-size: 0.95em; }
    .rule { background: #feebc8; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
    .evidence { background: white; padding: 15px; border-radius: 4px; border: 1px solid #e2e8f0; }
    .solution { background: #c6f6d5; padding: 15px; border-radius: 4px; }
    .no-deficiencies-note {
      background: #c6f6d5;
      padding: 15px;
      border-radius: 4px;
      color: #22543d;
      text-align: center;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 0.85em;
    }
    @media (max-width: 600px) {
      .inspection-header { flex-direction: column; align-items: flex-start; }
      .info-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(details?.legalName || 'Unknown Facility')}</h1>
    ${details?.dba ? `<div class="subtitle">DBA: ${escapeHtml(details.dba)}</div>` : ''}
    <div class="subtitle">${escapeHtml(details?.facilityType || '')} | ${escapeHtml(details?.bureau || '')}</div>
  </div>

  <div class="facility-info">
    <h2>Facility Information</h2>
    <div class="info-grid">
      <div class="info-item">
        <strong>Address</strong>
        ${escapeHtml(details?.address || 'N/A')}
      </div>
      <div class="info-item">
        <strong>Phone</strong>
        ${escapeHtml(details?.phone || 'N/A')}
      </div>
      <div class="info-item">
        <strong>License</strong>
        ${escapeHtml(details?.license || 'N/A')} (${escapeHtml(details?.licenseStatus || 'Unknown')})
      </div>
      <div class="info-item">
        <strong>License Owner</strong>
        ${escapeHtml(details?.licenseOwner || 'N/A')}
      </div>
      <div class="info-item">
        <strong>Administrator</strong>
        ${escapeHtml(details?.chiefAdministrativeOfficer || 'N/A')}
      </div>
      <div class="info-item">
        <strong>Capacity</strong>
        ${details?.totalCapacity || 'N/A'}
      </div>
      <div class="info-item">
        <strong>License Effective</strong>
        ${escapeHtml(details?.effectiveDate || 'N/A')} - ${escapeHtml(details?.expirationDate || 'N/A')}
      </div>
      ${details?.qualityRating ? `
      <div class="info-item">
        <strong>Quality Rating</strong>
        ${escapeHtml(details.qualityRating)}
      </div>` : ''}
      ${details?.ccn ? `
      <div class="info-item">
        <strong>CCN (Medicare)</strong>
        ${escapeHtml(details.ccn)}
      </div>` : ''}
    </div>
    <div style="margin-top: 15px;">
      <strong>Services:</strong>
      ${servicesHtml}
    </div>
  </div>

  <div class="summary-stats">
    <div class="stat-card">
      <div class="number">${inspections.length}</div>
      <div class="label">Total Inspections</div>
    </div>
    <div class="stat-card ${totalDeficiencies > 0 ? 'warning' : 'success'}">
      <div class="number">${totalDeficiencies}</div>
      <div class="label">Total Deficiencies</div>
    </div>
    <div class="stat-card">
      <div class="number">${inspections.filter(i => i.inspectionType.includes('Complaint')).length}</div>
      <div class="label">Complaint Inspections</div>
    </div>
  </div>

  <h2>Inspection History</h2>

  ${sortedInspections.length > 0
    ? sortedInspections.map(insp =>
        renderInspection(insp, facility.inspectionDetails.get(insp.inspectionId))
      ).join('\n')
    : '<p>No inspections on record.</p>'
  }

  <div class="footer">
    <p>Data sourced from <a href="https://azcarecheck.azdhs.gov/">AZ CareCheck</a> - Arizona Department of Health Services</p>
    <p>Report generated: ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;
}

/**
 * Save HTML report for a facility
 */
export async function saveFacilityReport(facility: ScrapedFacility): Promise<string> {
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const html = generateFacilityReport(facility);
  const filename = `${facility.facilityId}.html`;
  const filepath = path.join(REPORTS_DIR, filename);

  await fs.writeFile(filepath, html);
  return filepath;
}

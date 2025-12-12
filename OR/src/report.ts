/**
 * HTML Report Generator for Oregon Facility Inspections
 * Pink gradient theme matching AR/Arizona style
 */
import fs from "fs/promises";
import path from "path";
import { REPORTS_DIR, ENDPOINTS } from "./config.js";
import type { ScrapedFacility, Survey, SurveyCitation } from "./types.js";

/**
 * Escape HTML entities
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert newlines to HTML breaks
 */
function nl2br(text: string | null | undefined): string {
  if (!text) return "";
  return escapeHtml(text).replace(/\n/g, "<br>\n");
}

/**
 * Format boolean flag as Yes/No
 */
function boolFlag(value: number | null | undefined): string {
  return value === 1 ? "Yes" : "No";
}

/**
 * Format date from API format
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Render a single survey with its citations
 */
function renderSurvey(
  survey: Survey,
  citations: SurveyCitation[] | undefined
): string {
  const hasDeficiencies = survey.deficiencyCount > 0;

  return `
    <div class="inspection ${hasDeficiencies ? "has-deficiencies" : "no-deficiencies"}">
      <div class="inspection-header">
        <h3>Survey ${escapeHtml(survey.reportNumber)}</h3>
        <span class="inspection-status ${hasDeficiencies ? "warning" : "complete"}">
          ${survey.deficiencyCount} Deficiencies
        </span>
      </div>

      <div class="inspection-meta">
        <div class="meta-item">
          <strong>Date:</strong> ${escapeHtml(survey.date)}
        </div>
        <div class="meta-item">
          <strong>Type:</strong> ${escapeHtml(survey.categoryTypes.join(", ") || "N/A")}
        </div>
      </div>

      ${
        citations && citations.length > 0
          ? `
      <div class="deficiencies">
        <h4>Citations: ${citations.length}</h4>
        ${citations.map((c, i) => renderCitation(c, i)).join("\n")}
      </div>`
          : `
      <div class="no-deficiencies-note">
        <p>✓ No deficiencies cited during this inspection.</p>
      </div>`
      }
    </div>
  `;
}

/**
 * Render a single citation with detailed information
 */
function renderCitation(citation: SurveyCitation, index: number): string {
  const d = citation.details;

  // Build visit details HTML
  let visitsHtml = "";
  if (d?.visitDetails && d.visitDetails.length > 0) {
    visitsHtml = d.visitDetails
      .map((v) => {
        const corrected = v.correctedDate ? `<span class="corrected">Corrected: ${v.correctedDate}</span>` : `<span class="not-corrected">Not Corrected</span>`;
        return `<div class="visit-detail"><strong>${escapeHtml(v.visitType)}</strong> Visit: ${escapeHtml(v.visitDate)} | ${corrected}</div>`;
      })
      .join("");
  } else if (citation.visits.length > 0) {
    visitsHtml = citation.visits
      .map((v) => `<div class="visit-detail">Visit ${v.visitNum}: ${escapeHtml(v.date)}</div>`)
      .join("");
  }

  return `
    <div class="deficiency">
      <h4>Citation #${index + 1}: ${escapeHtml(citation.tagId)} - ${escapeHtml(d?.tagTitle || citation.tagTitle)}</h4>

      ${visitsHtml ? `
      <div class="deficiency-section visits-section">
        <h5>Visit History:</h5>
        <div class="visits-list">${visitsHtml}</div>
      </div>` : ""}

      ${d?.ruleText ? `
      <div class="deficiency-section">
        <h5>Regulation:</h5>
        <div class="rule">${nl2br(d.ruleText)}</div>
      </div>` : ""}

      ${d?.findings ? `
      <div class="deficiency-section">
        <h5>Inspection Findings:</h5>
        <div class="findings">${nl2br(d.findings)}</div>
      </div>` : ""}

      ${d?.planOfCorrection ? `
      <div class="deficiency-section">
        <h5>Plan of Correction:</h5>
        <div class="poc">${nl2br(d.planOfCorrection)}</div>
      </div>` : ""}

      ${!d ? `
      <div class="deficiency-section">
        <h5>Tag Title:</h5>
        <div class="rule">${nl2br(citation.tagTitle)}</div>
      </div>
      <div class="deficiency-section">
        <h5>Level:</h5>
        <div>${citation.level || "N/A"}</div>
      </div>` : ""}
    </div>
  `;
}

/**
 * Generate full HTML report for a facility
 */
export function generateFacilityReport(data: ScrapedFacility): string {
  const f = data.facility;
  const surveys = data.surveys;
  const violations = data.violations;
  const notices = data.notices;

  // Sort surveys by date (newest first)
  const sortedSurveys = [...surveys].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  // Calculate totals
  const totalDeficiencies = surveys.reduce((sum, s) => sum + s.deficiencyCount, 0);
  const abuseViolations = violations.filter((v) => v.type === "abuse").length;
  const licensingViolations = violations.filter((v) => v.type === "licensing").length;

  // Services list
  const services = [];
  if (f.AlzheimerDementia) services.push("Alzheimer/Dementia Care");
  if (f.Bariatric) services.push("Bariatric Care");
  if (f.TraumaticBrainInjury) services.push("Traumatic Brain Injury");
  if (f.Ventilator) services.push("Ventilator Care");
  if (f.Daycare) services.push("Daycare");
  if (f.AlternativeLanguage) services.push("Alternative Language");
  if (f.Pets) services.push("Pets Allowed");
  if (f.Smoking) services.push("Smoking Allowed");

  const servicesHtml =
    services.length > 0
      ? `<ul>${services.map((s) => `<li>${s}</li>`).join("")}</ul>`
      : "<p>No special services listed</p>";

  // Funding sources
  const funding = [];
  if (f.MedicaidFlg) funding.push("Medicaid");
  if (f.MedicareFlg) funding.push("Medicare");
  if (f.PrivatePayFlg) funding.push("Private Pay");
  const fundingHtml = funding.length > 0 ? funding.join(", ") : f.FundingSource || "N/A";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(f.FacilityName)} - Oregon Facility Report</title>
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
    .inspection-status.warning { background: #fed7d7; color: #c53030; }
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
    .rule { background: #feebc8; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 0.9em; white-space: pre-wrap; }
    .findings { background: #fff5f5; padding: 15px; border-radius: 4px; border-left: 3px solid #c53030; }
    .poc { background: #e6fffa; padding: 15px; border-radius: 4px; border-left: 3px solid #38a169; }
    .visits-list { background: #f8f9fa; padding: 10px; border-radius: 4px; }
    .visit-detail { padding: 5px 0; border-bottom: 1px solid #e2e8f0; }
    .visit-detail:last-child { border-bottom: none; }
    .corrected { color: #2f855a; font-weight: 500; }
    .not-corrected { color: #c53030; font-weight: 500; }
    .no-deficiencies-note {
      background: #c6f6d5;
      padding: 15px;
      border-radius: 4px;
      color: #22543d;
      text-align: center;
    }
    .violations-section, .notices-section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .violations-section h2, .notices-section h2 {
      color: #fc8fb8;
      border-bottom: 2px solid #fc8fb8;
      padding-bottom: 10px;
    }
    .violation-item, .notice-item {
      padding: 10px;
      margin: 10px 0;
      background: #f8f9fa;
      border-radius: 4px;
      border-left: 3px solid #c53030;
    }
    .notice-item { border-left-color: #ed8936; }
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
    <h1>${escapeHtml(f.FacilityName)}</h1>
    <div class="subtitle">${escapeHtml(f.FacilityTypeDesc)} ${f.AFHClass ? `(Class ${escapeHtml(f.AFHClass)})` : ""}</div>
    <div class="subtitle">${escapeHtml(f.Address)}, ${escapeHtml(f.City)}, ${escapeHtml(f.State)} ${escapeHtml(f.Zip)}</div>
  </div>

  <div class="facility-info">
    <h2>Facility Information</h2>
    <div class="info-grid">
      <div class="info-item">
        <strong>Facility ID</strong>
        ${escapeHtml(f.FacilityID)}
      </div>
      <div class="info-item">
        <strong>Status</strong>
        ${escapeHtml(f.OperatingStatusDesc)}
      </div>
      <div class="info-item">
        <strong>County</strong>
        ${escapeHtml(f.County)}
      </div>
      <div class="info-item">
        <strong>Licensed Beds</strong>
        ${f.TotalBed ?? "N/A"}
      </div>
      <div class="info-item">
        <strong>Phone</strong>
        ${escapeHtml(f.Phone) || "N/A"}
      </div>
      <div class="info-item">
        <strong>Email</strong>
        ${escapeHtml(f.Email) || "N/A"}
      </div>
      <div class="info-item">
        <strong>Administrator</strong>
        ${escapeHtml(f.AdministratorName) || "N/A"}
      </div>
      <div class="info-item">
        <strong>Active Date</strong>
        ${formatDate(f.ActiveDate)}
      </div>
      ${
        f.OwnerName
          ? `
      <div class="info-item">
        <strong>Owner</strong>
        ${escapeHtml(f.OwnerName)}<br>
        ${escapeHtml(f.OwnerAddress || "")}<br>
        ${escapeHtml(f.OwnerCity || "")} ${escapeHtml(f.OwnerState || "")} ${escapeHtml(f.OwnerZip || "")}
      </div>`
          : ""
      }
      <div class="info-item">
        <strong>Funding</strong>
        ${fundingHtml}
      </div>
    </div>
    <div style="margin-top: 15px;">
      <strong>Services:</strong>
      ${servicesHtml}
    </div>
  </div>

  <div class="summary-stats">
    <div class="stat-card">
      <div class="number">${surveys.length}</div>
      <div class="label">Total Surveys</div>
    </div>
    <div class="stat-card ${totalDeficiencies > 0 ? "warning" : "success"}">
      <div class="number">${totalDeficiencies}</div>
      <div class="label">Total Deficiencies</div>
    </div>
    <div class="stat-card ${abuseViolations > 0 ? "warning" : "success"}">
      <div class="number">${abuseViolations}</div>
      <div class="label">Abuse Violations</div>
    </div>
    <div class="stat-card ${licensingViolations > 0 ? "warning" : "success"}">
      <div class="number">${licensingViolations}</div>
      <div class="label">Licensing Violations</div>
    </div>
    <div class="stat-card">
      <div class="number">${notices.length}</div>
      <div class="label">Notices</div>
    </div>
  </div>

  ${
    violations.length > 0
      ? `
  <div class="violations-section">
    <h2>Violations</h2>
    ${violations
      .map(
        (v) => `
    <div class="violation-item">
      <strong>${v.type === "abuse" ? "Abuse" : "Licensing"}:</strong> ${escapeHtml(v.description || "No details available")}
    </div>`
      )
      .join("")}
  </div>`
      : ""
  }

  ${
    notices.length > 0
      ? `
  <div class="notices-section">
    <h2>Notices</h2>
    ${notices
      .map(
        (n) => `
    <div class="notice-item">
      <strong>${escapeHtml(n.type)}:</strong> ${escapeHtml(n.description || "No details available")}
    </div>`
      )
      .join("")}
  </div>`
      : ""
  }

  <h2>Survey History</h2>

  ${
    sortedSurveys.length > 0
      ? sortedSurveys
          .map((survey) =>
            renderSurvey(survey, data.surveyCitations.get(survey.reportNumber))
          )
          .join("\n")
      : "<p>No surveys on record.</p>"
  }

  <div class="footer">
    <p>Data sourced from <a href="${ENDPOINTS.facilityDetails(f.FacilityID)}">Oregon Long-Term Care Licensing</a></p>
    <p>Report generated: ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;
}

/**
 * Save HTML report for a facility
 */
export async function saveFacilityReport(data: ScrapedFacility): Promise<string> {
  const facilityId = data.facility.FacilityID;
  const reportDir = path.join(REPORTS_DIR, facilityId);
  await fs.mkdir(reportDir, { recursive: true });

  const html = generateFacilityReport(data);
  const filename = `report.html`;
  const filepath = path.join(reportDir, filename);

  await fs.writeFile(filepath, html);
  return filepath;
}

import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import got from 'got';
import { CheerioAPI } from 'cheerio';
import { httpClient } from './http.js';
import { config } from './config.js';
import { Report } from './types.js';

function parseReportDate(text: string): string {
  // Try to extract date in format MM/DD/YYYY
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const month = dateMatch[1].padStart(2, '0');
    const day = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Default to current date if not found
  return new Date().toISOString().split('T')[0];
}

function inferReportType(text: string, url: string): string {
  const lowerText = text.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (lowerText.includes('complaint') || lowerUrl.includes('complaint')) {
    return 'COMPLAINT';
  }
  if (lowerText.includes('routine') || lowerText.includes('inspection')) {
    return 'ROUTINE';
  }
  if (lowerText.includes('deficiency') || lowerUrl.includes('deficiency')) {
    return 'DEFICIENCY';
  }
  if (lowerText.includes('enforcement') || lowerUrl.includes('enforcement')) {
    return 'ENFORCEMENT';
  }

  return 'REPORT';
}

function parseReports($: CheerioAPI, baseUrl: string): Report[] {
  const reports: Report[] = [];

  // Look for complaint inspection table with survey links
  // Format: <a href="fssurvey.aspx?survey-id=ZJHL11.pdf&facid=NJ60104">ZJHL11</a>
  $('a[href*="fssurvey.aspx"]').each((_, elem) => {
    const $link = $(elem);
    const href = $link.attr('href');
    const surveyId = $link.text().trim(); // e.g., "ZJHL11"

    if (!href || !surveyId) return;

    // Find the date in the same row
    const $row = $link.closest('tr');
    const dateText = $row.find('td').first().text().trim();
    const reportDate = parseReportDate(dateText);

    // Build proper filename: {surveyId}.pdf
    const fileName = surveyId.endsWith('.pdf') ? surveyId : `${surveyId}.pdf`;

    // Build full download URL
    const downloadUrl = href.startsWith('http')
      ? href
      : new URL(href, baseUrl).toString();

    reports.push({
      reportType: 'COMPLAINT',
      reportDate,
      fileName,
      downloadUrl,
    });
  });

  // Also look for other PDF links (privacy notice, etc.)
  $('a[href$=".pdf"]').each((_, elem) => {
    const $link = $(elem);
    const href = $link.attr('href');
    const text = $link.text().trim();

    if (!href) return;

    // Skip if already processed as survey
    if (href.includes('fssurvey.aspx')) return;

    // Build full URL
    const downloadUrl = href.startsWith('http')
      ? href
      : new URL(href, baseUrl).toString();

    // Extract filename from URL
    const urlParts = href.split('/');
    const fileName = urlParts[urlParts.length - 1] || `report_${Date.now()}.pdf`;

    // Extract report date from text or use today
    const reportDate = parseReportDate(text);

    reports.push({
      reportType: 'REPORT',
      reportDate,
      fileName,
      downloadUrl,
    });
  });

  return reports;
}

async function downloadReport(report: Report, facilityId: string): Promise<string> {
  const facilityDir = join(config.paths.reports, facilityId);
  await mkdir(facilityDir, { recursive: true });

  // Build local filename: YYYYMMDD-{TYPE}-{originalName}
  const datePrefix = report.reportDate.replace(/-/g, '');
  const localFileName = `${datePrefix}-${report.reportType}-${report.fileName}`;
  const localPath = join(facilityDir, localFileName);

  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= config.retry.limit; attempt++) {
    try {
      // Download the file
      const response = await got(report.downloadUrl, {
        timeout: {
          request: config.timeout,
          lookup: 5000,
          connect: 10000,
        },
        headers: {
          'User-Agent': config.userAgent,
          'Accept': 'application/pdf,*/*',
        },
        responseType: 'buffer',
        retry: { limit: 0 }, // Handle retries manually here
      });

      // Check if it's actually a PDF
      const contentType = response.headers['content-type'] || '';
      const buffer = response.body;

      // PDF files start with %PDF
      const isPDF = buffer.toString('utf8', 0, 4) === '%PDF';

      if (!isPDF && contentType.includes('text/html')) {
        // Got HTML instead of PDF - likely "not available" page
        const html = buffer.toString('utf8');
        if (html.includes('not currently available') || html.includes('not available in electronic format')) {
          console.log(`  Skipped: ${report.fileName} (not available electronically)`);
          return '';
        }
      }

      if (!isPDF) {
        console.warn(`  Warning: ${report.fileName} may not be a valid PDF (Content-Type: ${contentType})`);
      }

      // Save the file
      const { writeFile: writeFileAsync } = await import('fs/promises');
      await writeFileAsync(localPath, buffer);

      console.log(`  Downloaded: ${localFileName}`);
      return localPath;
    } catch (error) {
      lastError = error as Error;

      if (attempt < config.retry.limit) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), config.retry.backoffLimit);
        console.log(`  ⚠️  Download failed for ${report.fileName}, retrying (${attempt}/${config.retry.limit}) after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error(`  ✗ Failed to download ${report.fileName} after ${config.retry.limit} attempts: ${lastError?.message}`);
  return '';
}

export async function fetchAndDownloadReports(facilityId: string): Promise<Report[]> {
  console.log(`  Fetching reports for ${facilityId}...`);

  const allReports: Report[] = [];
  const seenUrls = new Set<string>(); // Deduplicate by URL

  try {
    // Fetch routine inspection reports (certification surveys)
    const routineUrl = config.urls.routineReportsPage(facilityId);
    console.log(`    - Routine inspections page...`);
    const { $: $routine } = await httpClient.get(routineUrl);
    const routineReports = parseReports($routine, routineUrl);

    // Mark these as ROUTINE type
    routineReports.forEach(report => {
      if (report.reportType === 'COMPLAINT') {
        report.reportType = 'ROUTINE';
      }
      if (!seenUrls.has(report.downloadUrl)) {
        seenUrls.add(report.downloadUrl);
        allReports.push(report);
      }
    });

    console.log(`      Found ${routineReports.length} routine reports`);
  } catch (error) {
    console.error(`    Failed to fetch routine reports: ${error}`);
  }

  try {
    // Fetch complaint inspection reports
    const complaintUrl = config.urls.complaintReportsPage(facilityId);
    console.log(`    - Complaint inspections page...`);
    const { $: $complaint } = await httpClient.get(complaintUrl);
    const complaintReports = parseReports($complaint, complaintUrl);

    // Deduplicate by URL (privacy notice appears on both pages)
    complaintReports.forEach(report => {
      if (!seenUrls.has(report.downloadUrl)) {
        seenUrls.add(report.downloadUrl);
        allReports.push(report);
      }
    });

    console.log(`      Found ${complaintReports.length} complaint reports`);
  } catch (error) {
    console.error(`    Failed to fetch complaint reports: ${error}`);
  }

  console.log(`  Total: ${allReports.length} reports (after deduplication) for ${facilityId}`);

  // Download each report
  for (const report of allReports) {
    const localPath = await downloadReport(report, facilityId);
    if (localPath) {
      report.localPath = localPath;
    }
  }

  return allReports;
}

/**
 * Survey Fetcher using Playwright
 *
 * The gateway.maine.gov survey endpoint has Incapsula bot protection
 * that blocks standard HTTP requests. This module uses Playwright
 * to automate a real browser and bypass that protection.
 *
 * Usage: Run this after the main scraper to fetch survey reports
 * for nursing homes and hospice facilities.
 */

import fs from 'fs';
import path from 'path';
import { chromium, Browser, Page } from 'playwright';
import { config } from './config.js';
import type { NursingHomeFacility, SurveyEntry } from './types.js';

const SURVEY_URL = 'https://gateway.maine.gov/dhhs-apps/aspen/aspen_survey_request.asp';

/**
 * Fetch survey links for a single facility using Playwright
 */
async function fetchSurveyLinks(
  page: Page,
  facilityId: string
): Promise<SurveyEntry[]> {
  const surveys: SurveyEntry[] = [];

  try {
    // Navigate to the survey request page via form POST
    // We'll simulate a form submission by going to a base page first
    await page.goto('https://gateway.maine.gov/dhhs-apps/aspen/aspen_details.asp', {
      waitUntil: 'domcontentloaded',
    });

    // Now submit the survey form
    await page.evaluate((id) => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'aspen_survey_request.asp';
      form.target = '_self';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'which';
      input.value = `[${id}]`;

      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }, facilityId);

    // Wait for navigation
    await page.waitForLoadState('domcontentloaded');

    // Parse survey links from the page
    const surveyData = await page.evaluate(() => {
      const results: Array<{ date: string; type: string; reportUrl?: string }> = [];

      // Look for survey links - the structure varies, so we try multiple selectors
      const links = document.querySelectorAll('a[href*=".pdf"], a[href*="survey"], a[href*="report"]');

      links.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim() || '';

        if (href && text) {
          // Try to extract date from the text or filename
          const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          const date = dateMatch ? dateMatch[1] : '';

          results.push({
            date: date || 'Unknown',
            type: text,
            reportUrl: href.startsWith('http') ? href : `https://gateway.maine.gov/dhhs-apps/aspen/${href}`,
          });
        }
      });

      return results;
    });

    for (const s of surveyData) {
      surveys.push({
        date: s.date || '',
        type: s.type,
        reportUrl: s.reportUrl,
      });
    }
  } catch (error) {
    console.error(`  Error fetching surveys for facility ${facilityId}: ${error instanceof Error ? error.message : error}`);
  }

  return surveys;
}

/**
 * Download a survey PDF
 */
async function downloadSurveyPdf(
  page: Page,
  facilityId: string,
  survey: SurveyEntry
): Promise<string | null> {
  if (!survey.reportUrl) return null;

  const folderPath = path.join(config.reportsDir, `nh-${facilityId}`);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Create filename
  const dateStr = survey.date.replace(/\//g, '') || 'unknown';
  const typeSlug = survey.type
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 30);
  const filename = `${dateStr}-${typeSlug}.pdf`;
  const filePath = path.join(folderPath, filename);

  // Skip if exists
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  try {
    // Download the PDF using Playwright's request context
    const response = await page.context().request.get(survey.reportUrl);

    if (response.ok()) {
      const buffer = await response.body();
      fs.writeFileSync(filePath, buffer);
      return filePath;
    }
  } catch (error) {
    console.error(`  Failed to download: ${error instanceof Error ? error.message : error}`);
  }

  return null;
}

/**
 * Process all nursing home/hospice facilities to fetch surveys
 */
export async function fetchAllSurveys(
  facilities: NursingHomeFacility[],
  onProgress?: (completed: number, total: number, current: NursingHomeFacility) => void
): Promise<NursingHomeFacility[]> {
  console.log('Launching browser...');

  const browser: Browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: config.userAgent,
  });

  const page = await context.newPage();

  const results: NursingHomeFacility[] = [];

  try {
    for (let i = 0; i < facilities.length; i++) {
      const facility = facilities[i]!;

      if (onProgress) {
        onProgress(i, facilities.length, facility);
      }

      // Skip if no surveys
      if (facility.surveyCount === 0) {
        results.push(facility);
        continue;
      }

      console.log(`  Fetching surveys for ${facility.name} (${facility.facilityId})...`);

      const surveys = await fetchSurveyLinks(page, facility.facilityId);

      // Download PDFs
      for (const survey of surveys) {
        const localPath = await downloadSurveyPdf(page, facility.facilityId, survey);
        if (localPath) {
          survey.localPath = localPath;
        }
      }

      results.push({
        ...facility,
        surveys,
      });

      // Small delay between facilities
      await page.waitForTimeout(1000);
    }
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }

  return results;
}

/**
 * Main function for running survey fetcher standalone
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Maine NH/Hospice Survey Fetcher (Playwright)');
  console.log('='.repeat(60));
  console.log();

  // Load nursing home and hospice data
  const nhDataPath = path.join(config.dataDir, 'nursing-homes.json');
  const hospiceDataPath = path.join(config.dataDir, 'hospice.json');

  if (!fs.existsSync(nhDataPath) || !fs.existsSync(hospiceDataPath)) {
    console.error('ERROR: Run the main scraper first to generate nursing home/hospice data.');
    process.exit(1);
  }

  const nursingHomes = JSON.parse(fs.readFileSync(nhDataPath, 'utf-8')) as NursingHomeFacility[];
  const hospiceFacilities = JSON.parse(fs.readFileSync(hospiceDataPath, 'utf-8')) as NursingHomeFacility[];

  console.log(`Loaded ${nursingHomes.length} nursing homes`);
  console.log(`Loaded ${hospiceFacilities.length} hospice facilities`);

  // Process nursing homes
  console.log('\nFetching nursing home surveys...');
  const nhWithSurveys = await fetchAllSurveys(
    nursingHomes,
    (completed, total, current) => {
      if (completed % 10 === 0) {
        console.log(`  Progress: ${completed}/${total}`);
      }
    }
  );

  // Save updated data
  fs.writeFileSync(
    path.join(config.dataDir, 'nursing-homes-with-surveys.json'),
    JSON.stringify(nhWithSurveys, null, 2)
  );

  // Process hospice
  console.log('\nFetching hospice surveys...');
  const hospiceWithSurveys = await fetchAllSurveys(
    hospiceFacilities,
    (completed, total, current) => {
      if (completed % 10 === 0) {
        console.log(`  Progress: ${completed}/${total}`);
      }
    }
  );

  // Save updated data
  fs.writeFileSync(
    path.join(config.dataDir, 'hospice-with-surveys.json'),
    JSON.stringify(hospiceWithSurveys, null, 2)
  );

  console.log('\n' + '='.repeat(60));
  console.log('Survey fetching complete!');
  console.log('='.repeat(60));
}

// Run if called directly
const isMainModule = process.argv[1]?.endsWith('surveyFetcher.js') ||
                    process.argv[1]?.endsWith('surveyFetcher.ts');

if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

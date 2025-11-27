import puppeteer, { Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';

/**
 * Ohio Long-Term Care Facility Scraper
 *
 * Workflow:
 * 1. Start at https://prod.ltc.age.ohio.gov/FacilitySearch
 * 2. Select facility type (NH, RC, ACF, RTF)
 * 3. Click Search
 * 4. Set records per page to 500
 * 5. For each facility, click and intercept API responses
 * 6. Handle pagination if needed
 */

const FACILITY_TYPES = {
  NH: 'Nursing Home (NH)',
  RC: 'Assisted Living(RCF)',
  ACF: 'Supportive Living',
  RTF: 'Residential Treatment Facilities',
} as const;

type FacilityType = keyof typeof FACILITY_TYPES;

interface FacilityData {
  plainId: string;
  name: string;
  facilityType: FacilityType;
  profile?: Record<string, string>;
  services?: Record<string, string>;
  payment?: Record<string, string>;
  staff?: Record<string, string>;
  quality?: Record<string, string>;
  raw?: {
    profileXml?: string;
    servicesXml?: string;
    paymentXml?: string;
    staffXml?: string;
    qualityXml?: string;
  };
}

class OhioFacilityScraper {
  private page!: Page;
  private currentFacility: FacilityData | null = null;
  private facilitiesData: FacilityData[] = [];

  /**
   * Helper method to wait for a specified duration
   */
  private async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async initialize() {
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1400, height: 900 },
    });

    this.page = await browser.newPage();

    // Set up network interception
    this.page.on('response', async (response) => {
      await this.handleResponse(response);
    });

    console.log('✓ Browser initialized');
  }

  /**
   * Intercept and parse API responses
   */
  private async handleResponse(response: any) {
    const url = response.url();

    if (url.includes('FacilityProfile') && this.currentFacility) {
      try {
        const contentType = response.headers()['content-type'];
        if (contentType?.includes('xml') || contentType?.includes('text')) {
          const body = await response.text();

          if (body.includes('<pbres>')) {
            // Determine which API call based on content
            if (body.includes('FACILITY_ID') || body.includes('FACILITY_KEY')) {
              console.log('    → Captured: Facility Profile');
              this.currentFacility.profile = this.parseXmlResponse(body);
              if (!this.currentFacility.raw) this.currentFacility.raw = {};
              this.currentFacility.raw.profileXml = body;
            } else if (body.includes('SERVICE')) {
              console.log('    → Captured: Services');
              this.currentFacility.services = this.parseXmlResponse(body);
              if (!this.currentFacility.raw) this.currentFacility.raw = {};
              this.currentFacility.raw.servicesXml = body;
            } else if (body.includes('PAYMENT')) {
              console.log('    → Captured: Payment Info');
              this.currentFacility.payment = this.parseXmlResponse(body);
              if (!this.currentFacility.raw) this.currentFacility.raw = {};
              this.currentFacility.raw.paymentXml = body;
            } else if (body.includes('STAFF') || body.includes('NURSE')) {
              console.log('    → Captured: Staff Info');
              this.currentFacility.staff = this.parseXmlResponse(body);
              if (!this.currentFacility.raw) this.currentFacility.raw = {};
              this.currentFacility.raw.staffXml = body;
            } else if (body.includes('QUALITY')) {
              console.log('    → Captured: Quality Measures');
              this.currentFacility.quality = this.parseXmlResponse(body);
              if (!this.currentFacility.raw) this.currentFacility.raw = {};
              this.currentFacility.raw.qualityXml = body;
            }
          }
        }
      } catch (error) {
        // Silently ignore parsing errors
      }
    }
  }

  /**
   * Parse XML response into key-value object
   */
  private parseXmlResponse(xml: string): Record<string, string> {
    const data: Record<string, string> = {};
    const regex = /<s name="([^"]+)"><!\[CDATA\[([^\]]*)\]\]><\/s>/g;
    let match;

    while ((match = regex.exec(xml)) !== null) {
      const [, name, value] = match;
      data[name] = value;
    }

    return data;
  }

  /**
   * Navigate to search page and select facility type
   */
  async selectFacilityType(facilityType: FacilityType) {
    console.log(`\n=== Scraping: ${FACILITY_TYPES[facilityType]} ===\n`);

    // Navigate to search page
    await this.page.goto('https://prod.ltc.age.ohio.gov/FacilitySearch', {
      waitUntil: 'networkidle0',
    });

    console.log('✓ Loaded search page');

    // Click on the facility type dropdown
    await this.page.click('#ctl00_MainContent_cboFacilityType_ob_CbocboFacilityTypeTB');
    await this.wait(500);

    // Select the facility type from dropdown
    const typeValue = facilityType;
    await this.page.evaluate((value) => {
      const options = document.querySelectorAll('.ob_iCboICBC li');
      for (const option of options) {
        const iElement = option.querySelector('i');
        if (iElement?.textContent === value) {
          (option as HTMLElement).click();
          return;
        }
      }
    }, typeValue);

    await this.wait(500);
    console.log(`✓ Selected facility type: ${FACILITY_TYPES[facilityType]}`);

    // Click Search button
    await this.page.click('#ctl00_MainContent_btnSubmit');
    await this.page.waitForNavigation({ waitUntil: 'networkidle0' });

    console.log('✓ Search results loaded');
  }

  /**
   * Set records per page to 500
   */
  async setRecordsPerPage() {
    try {
      // Click on records per page dropdown
      await this.page.click('#ob_iDdlob_gFacilityPageSizeSelector_TopTB');
      await this.wait(500);

      // Select 500
      await this.page.evaluate(() => {
        const options = document.querySelectorAll('.ob_iDdlICBC li');
        for (const option of options) {
          const iElement = option.querySelector('i');
          if (iElement?.textContent === '500') {
            (option as HTMLElement).click();
            return;
          }
        }
      });

      await this.wait(2000); // Wait for page reload
      console.log('✓ Set records per page to 500');
    } catch (error) {
      console.log('⚠ Could not set records per page (might already be 500)');
    }
  }

  /**
   * Extract facility list from current page
   */
  async extractFacilityList(facilityType: FacilityType): Promise<Array<{
    plainId: string;
    name: string;
    controlId: string;
  }>> {
    console.log('🔍 Extracting facility list from page...');

    // Debug: Check if the selector exists
    const linkCount = await this.page.$$eval('a[facid]', links => links.length);
    console.log(`   Found ${linkCount} links with facid attribute`);

    if (linkCount === 0) {
      console.log('⚠️  No facilities found! Possible reasons:');
      console.log('   - Page still loading');
      console.log('   - Different HTML structure');
      console.log('   - Search returned no results');

      // Debug: Save HTML for inspection
      const html = await this.page.content();
      const fs = await import('fs');
      fs.writeFileSync('debug-page.html', html);
      console.log('   💾 Saved page HTML to debug-page.html');
    }

    const facilities = await this.page.$$eval('a[facid]', (links) =>
      links.map((link) => ({
        plainId: link.getAttribute('facid')!,
        name: link.textContent?.trim() || '',
        controlId: link.getAttribute('id')!,
      }))
    );

    console.log(`✓ Found ${facilities.length} facilities on this page`);

    // Show first 3 as examples
    if (facilities.length > 0) {
      console.log('   Example facilities:');
      facilities.slice(0, 3).forEach(f => {
        console.log(`   - ${f.plainId}: ${f.name}`);
      });
    }

    return facilities;
  }

  /**
   * Scrape a single facility
   */
  async scrapeFacility(facility: {
    plainId: string;
    name: string;
    controlId: string;
  }, facilityType: FacilityType) {
    console.log(`\n  Processing: ${facility.plainId} - ${facility.name}`);

    // Initialize current facility
    this.currentFacility = {
      plainId: facility.plainId,
      name: facility.name,
      facilityType: facilityType,
    };

    try {
      // Click the facility link
      const escapedId = facility.controlId.replace(/\$/g, '\\$');
      await this.page.click(`a#${escapedId}`);

      // Wait for navigation and AJAX calls
      await this.page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle0' });
      await this.wait(5000); // Wait for all AJAX calls to complete

      // Save the facility data
      this.facilitiesData.push({ ...this.currentFacility });

      console.log(`  ✓ Completed ${facility.plainId}`);

      // Go back to search results
      await this.page.goBack();
      await this.page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle0' });
      await this.wait(2000);
    } catch (error) {
      console.error(`  ✗ Error: ${error}`);
      // Try to recover by going back
      try {
        await this.page.goBack();
        await this.page.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle0' });
        await this.wait(2000);
      } catch {
        console.error('  ✗ Failed to recover, skipping this facility');
      }
    }
  }

  /**
   * Check if there's a next page
   */
  async hasNextPage(): Promise<boolean> {
    const nextButton = await this.page.$('.ob_gFP img[alt=""][src*="next_normal"]');
    return nextButton !== null;
  }

  /**
   * Navigate to next page
   */
  async goToNextPage() {
    const nextButton = await this.page.$('.ob_gFP img[alt=""][src*="next_normal"]');
    if (nextButton) {
      await nextButton.click();
      await this.wait(2000);
      console.log('\n✓ Navigated to next page');
    }
  }

  /**
   * Scrape all facilities for a given type
   */
  async scrapeAllFacilities(facilityType: FacilityType) {
    console.log('📋 Starting facility scraping process...\n');

    await this.selectFacilityType(facilityType);

    console.log('\n⏳ Waiting 2 seconds for page to fully load...');
    await this.wait(2000);

    await this.setRecordsPerPage();

    let pageNumber = 1;

    do {
      console.log(`\n--- Page ${pageNumber} ---`);

      const facilities = await this.extractFacilityList(facilityType);

      if (facilities.length === 0) {
        console.log('❌ No facilities found on this page. Stopping.');
        break;
      }

      for (const facility of facilities) {
        await this.scrapeFacility(facility, facilityType);
      }

      const hasNext = await this.hasNextPage();
      if (hasNext) {
        await this.goToNextPage();
        pageNumber++;
      } else {
        console.log('\n✓ No more pages');
        break;
      }
    } while (true);
  }

  /**
   * Save collected data
   */
  saveData() {
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `facilities-${timestamp}.json`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(this.facilitiesData, null, 2));

    console.log(`\n✓ Saved ${this.facilitiesData.length} facilities to ${filename}`);
  }

  /**
   * Run the complete scraping workflow
   */
  async run(facilityTypes: FacilityType[] = ['NH'], testMode: boolean = false) {
    await this.initialize();

    for (const facilityType of facilityTypes) {
      await this.scrapeAllFacilities(facilityType);

      // In test mode, stop after first type
      if (testMode) {
        console.log('\n🧪 Test mode: stopping after first facility type');
        break;
      }
    }

    this.saveData();

    console.log('\n=== Scraping Complete ===');
    console.log(`Total facilities scraped: ${this.facilitiesData.length}`);
  }
}

// Run the scraper
const scraper = new OhioFacilityScraper();

// Scrape Nursing Homes first (you can add more types later)
scraper.run(['NH']).catch(console.error);

// To scrape all facility types:
// scraper.run(['NH', 'RC', 'ACF', 'RTF']).catch(console.error);

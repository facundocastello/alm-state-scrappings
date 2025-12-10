import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { httpClient, delay } from './http.js';
import { config } from './config.js';
import type { FacilityFromListing } from './types.js';

function parseUnits(text: string): number | null {
  const match = text.match(/(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

function parseLowIncome(text: string): boolean | null {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('yes')) return true;
  if (lowerText.includes('no')) return false;
  return null;
}

function parseListingItem($item: cheerio.Cheerio<AnyNode>, $: cheerio.CheerioAPI): FacilityFromListing | null {
  const nameLink = $item.find('.ma__image-promo__title a');
  const name = nameLink.text().trim().replace(/\s+/g, ' ');
  const href = nameLink.attr('href');

  if (!name || !href) return null;

  const profileUrl = href.startsWith('/') ? `${config.baseUrl}${href}` : href;
  const address = $item.find('.ma__image-promo__location').clone().children('span').remove().end().text().trim();
  const phone = $item.find('.ma__image-promo__phone-link').text().trim();
  const businessHours = $item.find('.ma__image-promo__label--hours').text().trim();

  // Parse unit info from description
  const descriptionHtml = $item.find('.ma__image-promo__description .ma__rich-text').html() || '';
  const descriptionText = descriptionHtml.replace(/<br\s*\/?>/gi, '\n');

  let totalUnits: number | null = null;
  let traditionalUnits: number | null = null;
  let specialCareUnits: number | null = null;
  let lowIncomeOptions: boolean | null = null;

  const lines = descriptionText.split('\n').map(line => line.trim());
  for (const line of lines) {
    if (line.toLowerCase().includes('total number of units')) {
      totalUnits = parseUnits(line);
    } else if (line.toLowerCase().includes('number of traditional units')) {
      traditionalUnits = parseUnits(line);
    } else if (line.toLowerCase().includes('number of special care units')) {
      specialCareUnits = parseUnits(line);
    } else if (line.toLowerCase().includes('low income options')) {
      lowIncomeOptions = parseLowIncome(line);
    }
  }

  return {
    name,
    profileUrl,
    address,
    phone,
    businessHours,
    totalUnits,
    traditionalUnits,
    specialCareUnits,
    lowIncomeOptions,
  };
}

export async function crawlListingPage(pageNumber: number): Promise<FacilityFromListing[]> {
  const url = `${config.listingUrl}?page=${pageNumber}`;
  console.log(`Fetching listing page ${pageNumber}: ${url}`);

  const response = await httpClient.get(url);
  const $ = cheerio.load(response.body);

  const facilities: FacilityFromListing[] = [];
  const items = $('li.ma__image-promo.js-location-listing-link');

  items.each((_, element) => {
    const facility = parseListingItem($(element), $);
    if (facility) {
      facilities.push(facility);
    }
  });

  console.log(`  Found ${facilities.length} facilities on page ${pageNumber}`);
  return facilities;
}

export async function crawlAllListings(): Promise<FacilityFromListing[]> {
  const allFacilities: FacilityFromListing[] = [];

  for (let page = 0; page < config.totalPages; page++) {
    const facilities = await crawlListingPage(page);
    allFacilities.push(...facilities);
    await delay(config.requestDelayMs);
  }

  console.log(`\nTotal facilities crawled: ${allFacilities.length}`);
  return allFacilities;
}

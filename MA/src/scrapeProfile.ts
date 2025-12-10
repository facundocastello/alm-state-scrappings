import * as cheerio from 'cheerio';
import { httpClient } from './http.js';
import type { FacilityProfile } from './types.js';

interface LeafletMarkerInfo {
  name?: string;
  phone?: string;
  fax?: string;
  email?: string | null;
  address?: string;
  directions?: string;
}

interface LeafletMapData {
  markers?: Array<{
    position?: { lat?: number; lng?: number };
    infoWindow?: LeafletMarkerInfo;
  }>;
}

interface JsonLdPlace {
  '@type'?: string;
  name?: string;
  description?: string;
  disambiguatingDescription?: string;
  address?: Array<{
    '@type'?: string;
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  }>;
}

interface JsonLdGraph {
  '@context'?: string;
  '@graph'?: JsonLdPlace[];
}

function extractLeafletData(html: string): LeafletMapData | null {
  // Extract ma.leafletMapData.push({...}) JSON
  const match = html.match(/ma\.leafletMapData\.push\((\{[\s\S]*?\})\);/);
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]) as LeafletMapData;
  } catch {
    return null;
  }
}

function extractJsonLd(html: string): JsonLdPlace | null {
  // Extract first application/ld+json that contains Place
  const regex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const jsonContent = match[1];
      if (!jsonContent) continue;
      const data = JSON.parse(jsonContent) as JsonLdGraph | JsonLdPlace;
      if ('@graph' in data && Array.isArray(data['@graph'])) {
        const place = data['@graph'].find(item => item['@type'] === 'Place');
        if (place) return place;
      }
      if ('@type' in data && data['@type'] === 'Place') {
        return data;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function parseYearOpened(text: string): number | null {
  const match = text.match(/opened in (\d{4})/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

function parseBoolean(text: string, keyword: string): boolean | null {
  const regex = new RegExp(`${keyword}:\\s*(yes|no)`, 'i');
  const match = text.match(regex);
  if (!match) return null;
  return match[1]?.toLowerCase() === 'yes';
}

function extractWebsiteUrl($: cheerio.CheerioAPI): string | null {
  // Look for website link in the "More info" section
  const moreInfoSection = $('#more-info').closest('.ma__rich-text__container');
  const websiteLink = moreInfoSection.find('a[href^="http"]').not('[href*="mass.gov"]');
  return websiteLink.attr('href') || null;
}

function extractNodeId(html: string): string | null {
  // Extract Drupal node ID from window.dataLayer entityIdentifier
  const match = html.match(/"entityIdentifier"\s*:\s*"(\d+)"/);
  return match?.[1] || null;
}

export async function scrapeProfile(profileUrl: string): Promise<FacilityProfile> {
  console.log(`  Scraping profile: ${profileUrl}`);

  const response = await httpClient.get(profileUrl);
  const html = response.body;
  const $ = cheerio.load(html);

  // Extract data from leaflet map JSON
  const leafletData = extractLeafletData(html);
  const marker = leafletData?.markers?.[0];
  const infoWindow = marker?.infoWindow;

  // Extract data from JSON-LD
  const jsonLd = extractJsonLd(html);
  const addressData = jsonLd?.address?.[0];

  // Extract "More info" section text
  const moreInfoText = $('#more-info').closest('.ma__rich-text__container').find('.ma__rich-text').text();

  const profile: FacilityProfile = {
    // Drupal node ID
    nodeId: extractNodeId(html),

    // From leaflet map data
    fax: infoWindow?.fax || null,
    email: infoWindow?.email || null,
    latitude: marker?.position?.lat || null,
    longitude: marker?.position?.lng || null,

    // From "More info" section
    yearOpened: parseYearOpened(moreInfoText),
    website: extractWebsiteUrl($),
    nonprofitOwnership: parseBoolean(moreInfoText, 'Nonprofit Ownership'),
    continuingCareRetirementCommunity: parseBoolean(moreInfoText, 'Part of a Continuing Care Retirement Community'),
    coLocatedWithNursingHome: parseBoolean(moreInfoText, 'Co-Located with a Nursing Home'),

    // From JSON-LD address
    streetAddress: addressData?.streetAddress || null,
    city: addressData?.addressLocality || null,
    state: addressData?.addressRegion || null,
    postalCode: addressData?.postalCode || null,
  };

  return profile;
}

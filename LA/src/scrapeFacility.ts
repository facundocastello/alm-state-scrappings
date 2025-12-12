import * as cheerio from "cheerio";

import { httpClient } from "./http.js";
import { cleanText, parseNumber } from "./utils.js";
import type { FacilitySummary, FacilityRecord } from "./types.js";

/**
 * Parse the license info string from div.notes.wysi
 * Format: "License #: 2203782576--Level 3-Assisted Living --Capacity-32"
 */
const parseLicenseInfo = (
  text: string
): { licenseNumber: string | null; licenseLevel: string | null; capacity: number | null } => {
  const cleaned = cleanText(text);

  // Extract license number
  const licenseMatch = cleaned.match(/License\s*#?\s*:?\s*(\d+)/i);
  const licenseNumber = licenseMatch ? licenseMatch[1] || null : null;

  // Extract license level - between first -- and second --
  const levelMatch = cleaned.match(/--(.+?)(?:--|\s*Capacity)/i);
  const licenseLevel = levelMatch ? cleanText(levelMatch[1] || "") || null : null;

  // Extract capacity
  const capacityMatch = cleaned.match(/Capacity\s*[-:]?\s*(\d+)/i);
  const capacity = capacityMatch ? parseNumber(capacityMatch[1]) : null;

  return { licenseNumber, licenseLevel, capacity };
};

/**
 * Parse address components from the address element
 * Format: "Street Address, City, ST ZIP"
 */
const parseFullAddress = (
  addressHtml: string
): { street: string; city: string; state: string; zip: string } => {
  const cleaned = cleanText(addressHtml.replace(/<[^>]+>/g, " "));

  // Pattern: Street, City, ST ZIP
  const match = cleaned.match(/^(.+?),\s*([A-Za-z\s]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (match) {
    return {
      street: cleanText(match[1] || ""),
      city: cleanText(match[2] || ""),
      state: match[3] || "LA",
      zip: match[4] || "",
    };
  }

  return { street: cleaned, city: "", state: "LA", zip: "" };
};

/**
 * Extract latitude/longitude from Google Maps directions URL
 * Format: https://www.google.com/maps/dir/?api=1&destination=29.9811,-92.1095
 */
const parseCoordinates = (
  mapsUrl: string | undefined
): { latitude: number | null; longitude: number | null } => {
  if (!mapsUrl) return { latitude: null, longitude: null };

  const match = mapsUrl.match(/destination=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match) {
    const lat = parseFloat(match[1] || "");
    const lng = parseFloat(match[2] || "");
    return {
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
    };
  }

  return { latitude: null, longitude: null };
};

/**
 * Scrape a single facility profile page
 */
export const scrapeFacility = async (summary: FacilitySummary): Promise<FacilityRecord> => {
  console.log(`Scraping facility ${summary.id}: ${summary.name}`);

  const response = await httpClient.get(summary.profileUrl);
  const $ = cheerio.load(response.body as string);

  // Extract facility name (more accurate from profile page)
  const name = cleanText($(".title-col h1").text()) || summary.name;

  // Extract physical address
  let street = summary.address;
  let city = summary.city;
  let state = summary.state;
  let zip = summary.zip;

  const addressElem = $("ul.address li h3:contains('Physical Address')").parent();
  const addressSpan = addressElem.find("span em");
  if (addressSpan.length) {
    const parsed = parseFullAddress(addressSpan.html() || "");
    street = parsed.street || street;
    city = parsed.city || city;
    state = parsed.state || state;
    zip = parsed.zip || zip;
  }

  // Extract phone and fax
  let phone = summary.phone;
  let fax: string | null = null;

  $("ul.address a[href^='tel:']").each((_, el) => {
    const $el = $(el);
    const text = $el.text();
    const number = cleanText(text.replace(/\(tel\)|\(fax\)/gi, ""));

    if (text.toLowerCase().includes("fax")) {
      fax = number;
    } else if (text.toLowerCase().includes("tel") || !fax) {
      phone = number || phone;
    }
  });

  // Extract license info from notes
  let licenseNumber: string | null = null;
  let licenseLevel: string | null = null;
  let capacity: number | null = null;

  const notesText = $("div.notes.wysi").text();
  if (notesText) {
    const parsed = parseLicenseInfo(notesText);
    licenseNumber = parsed.licenseNumber;
    licenseLevel = parsed.licenseLevel;
    capacity = parsed.capacity;
  }

  // Extract services
  const services: string[] = [];
  $("div.secondary-col ul li").each((_, el) => {
    const service = cleanText($(el).text());
    if (service) {
      services.push(service);
    }
  });

  // Extract contact person
  const contactPerson = cleanText($("div.contact span em").text()) || null;

  // Extract coordinates from Google Maps link
  const mapsUrl = $("a.btn.directions").attr("href");
  const { latitude, longitude } = parseCoordinates(mapsUrl);

  const record: FacilityRecord = {
    id: summary.id,
    name,
    address: street,
    city,
    state,
    zip,
    phone,
    profileUrl: summary.profileUrl,
    fax,
    licenseNumber,
    licenseLevel,
    capacity,
    services,
    contactPerson,
    latitude,
    longitude,
  };

  return record;
};

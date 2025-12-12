import * as cheerio from "cheerio";
import { writeFile } from "fs/promises";
import PQueue from "p-queue";

import { httpClient } from "./http.js";
import {
  BASE_URL,
  LISTING_URL,
  TOTAL_PAGES,
  CONCURRENCY_PAGES,
  RAW_FACILITIES_PATH,
  DATA_DIR,
} from "./config.js";
import { ensureDir, cleanText } from "./utils.js";
import type { FacilitySummary } from "./types.js";

/**
 * Parse city/state/zip string
 * Format: "Lafayette, LA 70508"
 */
const parseCityStateZip = (
  text: string
): { city: string; state: string; zip: string } => {
  const cleaned = cleanText(text);

  // Pattern: City, ST ZIP
  const match = cleaned.match(/^([A-Za-z\s]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (match) {
    return {
      city: cleanText(match[1] || ""),
      state: match[2] || "LA",
      zip: match[3] || "",
    };
  }

  return { city: cleaned, state: "LA", zip: "" };
};

/**
 * Crawl a single listing page and extract facility summaries
 *
 * HTML structure:
 * <li>
 *   <h2>Facility Name</h2>
 *   <address>
 *     <span>123 Street Address</span>
 *     <span>City, LA 70000</span>
 *   </address>
 *   <span>337-123-4567</span>
 *   <a href="/directory/detail/12345" class="info" aria-label="..."></a>
 * </li>
 */
export const crawlPage = async (pageNum: number): Promise<FacilitySummary[]> => {
  const url = `${LISTING_URL}?pn=${pageNum}`;
  console.log(`Crawling page ${pageNum}: ${url}`);

  const response = await httpClient.get(url);
  const $ = cheerio.load(response.body as string);

  const facilities: FacilitySummary[] = [];

  // Find all list items in the results section
  $("section.directory-results ul.results > li").each((_, el) => {
    const $li = $(el);

    // Find the link to get the ID
    const $link = $li.find('a[href^="/directory/detail/"]').first();
    const href = $link.attr("href");
    if (!href) return;

    // Extract facility ID from URL
    const idMatch = href.match(/\/directory\/detail\/(\d+)/);
    if (!idMatch) return;
    const id = idMatch[1]!;

    // Get facility name from h2
    const name = cleanText($li.find("h2").first().text());
    if (!name) return;

    // Get address components from address element
    const $address = $li.find("address");
    const addressSpans = $address.find("span");

    let street = "";
    let city = "";
    let state = "LA";
    let zip = "";

    if (addressSpans.length >= 2) {
      // First span is street address
      street = cleanText($(addressSpans[0]).text());
      // Second span is city, state, zip
      const cityStateZip = parseCityStateZip($(addressSpans[1]).text());
      city = cityStateZip.city;
      state = cityStateZip.state;
      zip = cityStateZip.zip;
    } else if (addressSpans.length === 1) {
      street = cleanText($(addressSpans[0]).text());
    }

    // Get phone number - it's in a span outside address, before the link
    // Look for a span that contains a phone number pattern
    let phone = "";
    $li.find("span").each((_, spanEl) => {
      const text = $(spanEl).text();
      const phoneMatch = text.match(/^\s*(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\s*$/);
      if (phoneMatch) {
        phone = phoneMatch[1] || "";
      }
    });

    const facility: FacilitySummary = {
      id,
      name,
      address: street,
      city,
      state,
      zip,
      phone: cleanText(phone),
      profileUrl: `${BASE_URL}${href}`,
    };

    // Avoid duplicates within same page
    if (!facilities.some((f) => f.id === id)) {
      facilities.push(facility);
    }
  });

  console.log(`  Found ${facilities.length} facilities on page ${pageNum}`);
  return facilities;
};

/**
 * Crawl all listing pages and collect facility summaries
 */
export const crawlAllPages = async (): Promise<FacilitySummary[]> => {
  console.log(`Starting crawl of ${TOTAL_PAGES} pages with concurrency ${CONCURRENCY_PAGES}`);

  await ensureDir(DATA_DIR);

  const queue = new PQueue({ concurrency: CONCURRENCY_PAGES });
  const allFacilities: FacilitySummary[] = [];

  // Queue all pages
  const pageNumbers = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

  await Promise.all(
    pageNumbers.map((pageNum) =>
      queue.add(async () => {
        try {
          const facilities = await crawlPage(pageNum);
          allFacilities.push(...facilities);
        } catch (error) {
          console.error(`Error crawling page ${pageNum}:`, error);
        }
      })
    )
  );

  // Deduplicate by facility ID
  const uniqueFacilities = Array.from(
    new Map(allFacilities.map((f) => [f.id, f])).values()
  );

  console.log(`Total unique facilities found: ${uniqueFacilities.length}`);

  // Save raw results
  await writeFile(RAW_FACILITIES_PATH, JSON.stringify(uniqueFacilities, null, 2), "utf8");
  console.log(`Saved raw facilities to ${RAW_FACILITIES_PATH}`);

  return uniqueFacilities;
};

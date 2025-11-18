import { load, type CheerioAPI } from "cheerio";
import PQueue from "p-queue";
import { writeFile } from "fs/promises";
import { URL } from "url";

import { COUNTIES } from "./constants.js";
import type { County } from "./constants.js";
import {
  CONCURRENCY_COUNTIES,
  DATA_DIR,
  RAW_FACILITIES_PATH,
  RESULTS_URL,
} from "./config.js";
import { httpClient } from "./http.js";
import type { FacilitySummary } from "./types.js";
import { cleanText, ensureDir } from "./utils.js";

const buildProfileUrl = (href: string): string => {
  try {
    return new URL(href, RESULTS_URL).toString();
  } catch {
    return href;
  }
};

const extractFid = (href: string): string => {
  try {
    const url = new URL(href, RESULTS_URL);
    return url.searchParams.get("fid") ?? "";
  } catch {
    return "";
  }
};

const parseCountyTable = ($: CheerioAPI, county: County): FacilitySummary[] => {
  const rows: FacilitySummary[] = [];
  const table = $(`table#${county.replace(/\s+/g, "")}`);
  const tbodyRows = table.find("tbody > tr");

  tbodyRows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 8) {
      return;
    }

    const starImgAlt = cleanText(cells.eq(0).find("img").attr("alt") ?? cells.eq(0).text());
    const starValue = cleanText(cells.eq(1).text());
    const scoreRaw = cleanText(cells.eq(2).text());

    const link = cells.eq(3).find("a");
    if (!link.length) {
      return;
    }

    const profileHref = link.attr("href") ?? "";
    const profileUrl = buildProfileUrl(profileHref);
    const fid = extractFid(profileHref);

    const scoreNumber = scoreRaw ? Number(scoreRaw) : null;

    rows.push({
      county,
      name: cleanText(link.text()),
      license: cleanText(cells.eq(4).text()),
      address: cleanText(cells.eq(5).text()),
      city: cleanText(cells.eq(6).text()),
      zip: cleanText(cells.eq(7).text()),
      score: scoreNumber != null && scoreNumber < 0 ? Math.abs(scoreNumber) : scoreNumber,
      starsLabel: starImgAlt || undefined,
      starsValue: starValue || undefined,
      profileUrl,
      fid,
    });
  });

  return rows;
};

export const crawlCounty = async (county: County): Promise<FacilitySummary[]> => {
  const form = new URLSearchParams({
    type: "County",
    county,
    submit: "Search by County",
    faccity: "",
    facname: "",
  });

  const response = await httpClient.post(RESULTS_URL, {
    body: form.toString(),
  });

  const $ = load(response.body);
  return parseCountyTable($, county);
};

export const crawlAllCounties = async (): Promise<FacilitySummary[]> => {
  const queue = new PQueue({ concurrency: Math.max(1, CONCURRENCY_COUNTIES) });
  const allFacilities: FacilitySummary[] = [];

  await ensureDir(DATA_DIR);

  await Promise.all(
    COUNTIES.map((county: County) =>
      queue.add(async () => {
        try {
          const facilities = await crawlCounty(county);
          allFacilities.push(...facilities);
          console.log(
            `✓ ${county} — ${facilities.length} facilities (running total: ${allFacilities.length})`
          );
        } catch (err) {
          console.error(`✗ Failed to crawl ${county}: ${(err as Error).message}`);
        }
      })
    )
  );

  await queue.onIdle();

  await writeFile(RAW_FACILITIES_PATH, JSON.stringify(allFacilities, null, 2), "utf8");
  console.log(`Saved ${allFacilities.length} facilities to ${RAW_FACILITIES_PATH}`);

  return allFacilities;
};


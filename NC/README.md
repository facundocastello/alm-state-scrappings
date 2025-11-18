# NC DHSR ACLS Scraper

This Node.js + TypeScript scraper crawls the NC Division of Health Service Regulation (DHSR) Adult Care Licensure Section (ACLS) search portal and produces a flat CSV with rich facility metadata. It also downloads every available Statement of Deficiency PDF into `reports/{license}/{date}-{type}.pdf`.

## Prerequisites

- Node.js 18+
- `npm` (or your preferred package manager)

## Setup

```bash
cd /Users/facundo/projects/jobs/state-scrapping
npm install
cp env.example .env   # optional: edit with concurrency overrides
```

### Environment variables

Create a `.env` file with (all optional):

```
ACLS_COUNTY_CONCURRENCY=3        # optional
ACLS_FACILITY_CONCURRENCY=2      # optional
ACLS_USER_AGENT=Mozilla/5.0 ...  # optional
```

- Concurrency values throttle county and facility requests to respect the remote server.

## Running the scraper

```bash
npm start
```

What happens:

1. **County crawl** – submits a POST to `results.asp` for every county and saves the raw facility list to `data/facilities.raw.json`.
2. **Profile scrape** – visits each `facility.asp?fid=...` page, parses facility info, star ratings, inspection history, and counts inspections with/without deficiencies.
3. **Report download** – fetches every available Statement of Deficiency PDF into `reports/{license}/{date}-{document-type}.pdf`.
4. **CSV export** – writes a comprehensive row per facility to `output/facilities.csv`.

## Output

- `data/facilities.raw.json` – concatenated facility listings straight from the county search results (useful for debugging or resuming).
- `data/url-in-progress.csv` – log of facilities queued for scraping (timestamp, fid, URL).
- `data/url-finished.csv` – log of facilities successfully scraped; used to skip duplicates on future runs.
- `reports/<license>/YYYYMMDD-document-type.pdf` – raw Statements of Deficiency grouped by license.
- `output/facilities.csv` – flat file with columns for contact info, latest rating, inspection counts, document references, worksheet counts, and profile URL.

## Notes

- The script logs progress every ~10 facilities. If a request fails, it will continue and print the failed facility URL.
- Re-running the script reuses existing report PDFs (files are skipped when already present).
- Adjust concurrency or introduce delays if you encounter rate limiting (HTTP 429/503). The defaults are intentionally conservative.


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-state facility scraping framework. The NC (North Carolina) implementation serves as the reference implementation for scraping state healthcare facility databases. Each state scraper follows a two-phase workflow:

1. **GATHER INFO STEP**: Crawl facility profile URLs, scrape facility data, download reports
2. **GENERATE SUMMARY STEP**: Organize collected data and generate AI-powered summaries

## Development Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Run the scraper (builds then executes)
npm start

# Run in development mode (no build step)
npm run dev

# Type-check without compilation
npm run lint
```

## Architecture: Two-Phase Scraping Pattern

### Phase 1: Data Collection (Implemented in NC)

The NC implementation demonstrates the complete data collection workflow:

**1. Crawl Search Results** (`crawl.ts`)
- Submit search queries (by county, region, etc.)
- Extract facility summary data from result tables
- Save raw facility list to `data/facilities.raw.json`
- Extract facility identifiers and profile URLs

**2. Scrape Individual Profiles** (`scrapeFacility.ts`)
- Visit each facility's detail page
- Parse structured data (license, address, capacity, ratings)
- Extract inspection history and deficiency records
- Calculate statistics (inspections with/without deficiencies)

**3. Download Reports** (`reportDownloader.ts`)
- Fetch PDFs/documents referenced in facility profiles
- Organize by facility ID: `reports/{license}/{date}-{type}.pdf`
- Skip existing files to enable resume capability

**4. Export to CSV** (`csv.ts`)
- Flatten nested data structures for analysis
- Include document references and summary statistics
- Write to `output/facilities.csv`

### Phase 2: Summary Generation (To Be Implemented)

After data collection, the framework should:
- Load facility data and downloaded reports
- Send to GPT/Claude API for summarization
- Extract key insights per facility
- Generate comparative analysis across facilities

## Core Components

### Progress Tracking System (`progressTracker.ts`)

The framework uses CSV-based progress tracking to enable resume capability:

- `data/url-in-progress.csv`: Facilities currently being scraped
- `data/url-finished.csv`: Successfully completed facilities

On restart, the scraper:
1. Loads finished facility IDs
2. Filters them from the crawl results
3. Only processes remaining facilities

### HTTP Client Pattern (`http.ts`)

Uses `got` library with custom headers. When implementing new states:
- Inspect target site's request headers
- Replicate User-Agent and other headers in config
- Consider rate limiting and respectful crawling practices

### Configuration System (`config.ts`)

Environment variables control scraper behavior:
- `{STATE}_COUNTY_CONCURRENCY`: Parallel county crawl requests
- `{STATE}_FACILITY_CONCURRENCY`: Parallel facility scrape requests
- `{STATE}_USER_AGENT`: Custom User-Agent string

## Data Flow

```
Search Portal
    ↓
crawl.ts → data/facilities.raw.json
    ↓
scrapeFacility.ts (parallel, throttled)
    ├→ reportDownloader.ts → reports/{license}/...
    └→ csv.ts → output/facilities.csv
```

## Implementing a New State

When creating a scraper for a new state, replicate this structure:

1. **Create state-specific constants** (`constants.ts`)
   - Define geographic divisions (counties, regions, districts)
   - Create search parameter mappings

2. **Implement crawl function** (`crawl.ts`)
   - Study the search page's form submission
   - Replicate POST/GET parameters
   - Parse result tables into `FacilitySummary[]`

3. **Implement facility scraper** (`scrapeFacility.ts`)
   - Parse the profile page structure
   - Extract all data points (license, address, capacity, ratings, inspections)
   - Map to `FacilityRecord` type or create state-specific extension

4. **Configure report downloads** (`reportDownloader.ts`)
   - Identify document URLs on profile pages
   - Handle pagination if reports are listed separately
   - Determine appropriate file naming convention

5. **Define CSV schema** (`csv.ts`)
   - Map facility data to flat CSV structure
   - Include document references and summary statistics

6. **Set up environment config**
   - Copy `env.example` to `.env`
   - Set concurrency limits appropriate for the target site
   - Configure User-Agent if needed

## Type System

The framework uses TypeScript interfaces for type safety:

- `FacilitySummary`: Basic info from search results (name, license, address)
- `FacilityDetail`: Additional info from profile page (capacity, inspection history)
- `FacilityRecord`: Combined summary + detail data
- `StatementOfDeficiency`: Individual inspection/report record
- `StarRatingEntry`: Rating history entry (if applicable)

When adding new states, extend or adapt these types to match the state's data structure.

## Output Files

- `data/facilities.raw.json`: Raw crawl results (for debugging, resuming)
- `data/url-in-progress.csv`: Progress tracker
- `data/url-finished.csv`: Completed facilities (used to skip on re-run)
- `reports/{license}/YYYYMMDD-{type}.pdf`: Downloaded documents
- `output/facilities.csv`: Final flattened dataset

## Key Design Patterns

**Resumable Execution**: Progress tracking enables safe restart after failures

**Parallel Processing**: Uses `p-queue` for controlled concurrency

**Incremental CSV Writing**: Writes CSV after each facility to preserve partial results

**Conservative Rate Limiting**: Default concurrency values are intentionally low; increase carefully

**Error Isolation**: Individual facility failures don't abort the entire run

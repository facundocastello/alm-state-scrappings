# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-state healthcare facility scraping project. Each state has its own implementation that follows a standardized two-phase workflow:

**Phase 1: GATHER INFO**
- Crawl facility profile URLs from search portal
- Scrape facility data (ID, address, name, license info, bed count, inspections, ratings)
- Download reports (inspection reports, statements of deficiency, etc.)

**Phase 2: GENERATE SUMMARY**
- Organize collected data
- Send to LLM (ChatGPT/Claude) for summarization
- Extract key insights and generate facility summaries

## Repository Structure

```
state-scrapping/
├── NC/          # North Carolina - REFERENCE IMPLEMENTATION (Phase 1 complete)
├── MI/          # Michigan - (to be implemented)
└── [other states as needed]
```

### NC (North Carolina) - Reference Implementation

The NC directory contains the complete Phase 1 implementation and serves as the template for other states. See `NC/CLAUDE.md` for detailed documentation.

**Status**: Phase 1 complete, Phase 2 pending

**What it does**:
- Crawls NC DHSR ACLS (Adult Care Licensure Section) portal
- Searches all 100 counties in North Carolina
- Scrapes ~1000+ adult care facilities
- Downloads statements of deficiency (PDFs)
- Exports comprehensive CSV with ratings, inspections, and document references

**Key files**:
- `src/crawl.ts` - County-based search crawler
- `src/scrapeFacility.ts` - Individual facility profile scraper
- `src/reportDownloader.ts` - PDF report downloader
- `src/csv.ts` - CSV export with flattened data

## Starting a New State Implementation

When implementing a new state scraper, follow these steps:

### 1. Research Phase
- Identify the state's facility search portal
- Study the search mechanism (form POST, GET parameters, etc.)
- Examine facility profile page structure
- Locate report/document download links
- Document any API endpoints or data sources

### 2. Create State Directory
```bash
mkdir [STATE_CODE]
cd [STATE_CODE]
```

### 3. Copy NC Template Structure
```bash
# Copy package.json, tsconfig.json
cp ../NC/package.json .
cp ../NC/tsconfig.json .
cp ../NC/env.example .

# Create src/ directory structure
mkdir src data output reports
```

### 4. Define State-Specific Constants
Create `src/constants.ts` with:
- Geographic divisions (counties, regions, districts)
- Search parameter mappings
- Any state-specific enums or lookup tables

### 5. Implement Core Functions

**crawl.ts**: Search portal crawler
- Replicate search form submissions
- Parse result tables
- Extract facility summaries

**scrapeFacility.ts**: Profile page scraper
- Parse facility detail pages
- Extract all data points
- Handle state-specific fields

**reportDownloader.ts**: Document downloader
- Download inspection reports, deficiency statements
- Organize by facility identifier

**csv.ts**: Data export
- Flatten nested structures
- Map to state-specific schema

**types.ts**: TypeScript interfaces
- Define data models matching state's structure
- Extend base types if needed

**config.ts**: Configuration
- URLs and endpoints
- Concurrency settings
- Environment variable mappings

### 6. Test Incrementally
- Start with single county/region
- Verify data extraction accuracy
- Test progress tracking and resume capability
- Gradually scale to full state

### 7. Document State-Specific Details
Create a README.md for the state with:
- Data source URL
- Special considerations
- Concurrency recommendations
- Known limitations

## Common Patterns Across States

### Progress Tracking
All states should implement resumable execution using CSV tracking:
- `data/url-in-progress.csv` - Currently processing
- `data/url-finished.csv` - Completed facilities
- Enables safe restart after failures

### Concurrency Control
Use environment variables for rate limiting:
```
[STATE]_SEARCH_CONCURRENCY=3
[STATE]_FACILITY_CONCURRENCY=2
[STATE]_USER_AGENT=Mozilla/5.0 ...
```

### Error Handling
- Individual facility failures should not abort the run
- Log errors with facility identifier and URL
- Continue processing remaining facilities

### Data Organization
```
data/
  facilities.raw.json      # Raw crawl results
  url-in-progress.csv      # Progress tracking
  url-finished.csv         # Completion tracking

reports/
  {facility_id}/
    YYYYMMDD-{type}.pdf    # Organized by facility

output/
  facilities.csv           # Final flattened dataset
```

## Technology Stack

- **Language**: TypeScript with strict mode
- **Runtime**: Node.js 18+
- **HTTP Client**: `got` (v11.8.6)
- **HTML Parsing**: `cheerio` (v1.0.0)
- **Concurrency**: `p-queue` (v8.1.1)
- **CSV Export**: `csv-writer` (v1.6.0)
- **Module System**: ES modules (`"type": "module"`)

## Development Workflow

### Initial Setup (Any State)
```bash
npm install
cp env.example .env
# Edit .env with concurrency settings
```

### Running a Scraper
```bash
npm start              # Build and run
npm run dev            # Run without build (faster iteration)
npm run lint           # Type-check only
```

### Resuming After Failure
Simply re-run `npm start`. The progress tracker automatically skips completed facilities.

### Force Full Re-run
```bash
rm data/url-finished.csv
npm start
```

## Phase 2: Summary Generation (To Be Implemented)

After data collection is complete for a state, Phase 2 should:

1. Load facility data from CSV
2. Load associated reports from `reports/` directory
3. For each facility:
   - Prepare structured prompt with facility data + report excerpts
   - Send to LLM API (OpenAI/Anthropic)
   - Extract summary, key findings, risk indicators
4. Export enhanced CSV with summary fields
5. Optionally generate aggregate state-level analysis

**Implementation considerations**:
- Batch API calls efficiently
- Handle rate limits
- Cache summaries to avoid re-processing
- Consider token limits when including report text
- Implement cost tracking for API usage

## State-Specific Variations

Different states may have:
- **Different search mechanisms**: Form POST, REST API, GraphQL
- **Different geographic divisions**: Counties, regions, districts, zones
- **Different facility types**: Adult care, child care, hospitals, nursing homes
- **Different rating systems**: Stars, scores, letter grades, compliance levels
- **Different report formats**: PDFs, HTML, CSV downloads
- **Different data fields**: Capacity, ownership, complaint history, financial data

The NC implementation provides a solid foundation but should be adapted to each state's unique structure.

## Common Tasks

### Adding a new field to extraction
1. Update type definitions in `types.ts`
2. Parse the field in `scrapeFacility.ts`
3. Add column to CSV headers in `csv.ts`
4. Map the field in CSV record transformation

### Adjusting rate limiting
Edit `.env`:
```
[STATE]_SEARCH_CONCURRENCY=5      # Increase search parallelism
[STATE]_FACILITY_CONCURRENCY=3    # Increase facility scraping
```

### Debugging a specific facility
Edit `src/index.ts` to filter for specific facility ID before processing.

### Handling pagination
If reports are paginated, implement in `scrapeFacility.ts`:
- Detect pagination elements
- Loop through pages
- Aggregate results before returning

## Next Steps

1. **Complete NC Phase 2**: Implement summary generation for NC dataset
2. **Implement MI**: Use NC as template for Michigan facilities
3. **Generalize Framework**: Extract common patterns into shared library
4. **Add State Queue**: Track which states are pending/in-progress/complete
5. **Implement Monitoring**: Add dashboards for tracking progress across all states

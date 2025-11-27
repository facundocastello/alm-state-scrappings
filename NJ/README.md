# New Jersey Healthcare Facilities Scraper

Scrapes facility data and inspection reports from the NJ Department of Health portal.

## 3-Phase Workflow

The scraper runs in 3 distinct phases for better efficiency and resume capability:

### Phase 1: Scrape Facility Details
- Scrapes facility information from 4 tabs
- Saves JSON files (without reports)
- Tracks progress in `data/url-json-finished.csv`
- **Fast**: No report downloads, just facility data

### Phase 2: Download Reports  
- Downloads routine and complaint inspection PDFs
- Updates JSON files with report metadata
- Tracks progress in `data/url-reports-finished.csv`
- **Resumable**: Can restart after Phase 1 completes

### Phase 3: Generate CSV
- Loads all JSON files
- Exports comprehensive CSV  
- Marks overall completion in `data/url-finished.csv`

## Quick Start

\`\`\`bash
npm install
cp env.example .env
npm start
\`\`\`

## Progress Tracking

Three progress files enable fine-grained resumption:

\`\`\`
data/
├── url-json-finished.csv      # Phase 1: Facility data scraped
├── url-reports-finished.csv   # Phase 2: Reports downloaded
└── url-finished.csv            # Phase 3: Overall completion
\`\`\`

## Configuration

Edit \`.env\` to configure:

\`\`\`bash
# Concurrency
NJ_FACILITY_CONCURRENCY=2      # Parallel facilities (default: 2)

# Timeouts
NJ_TIMEOUT_MS=60000            # Request timeout in ms (default: 60s)

# Retries
NJ_RETRY_LIMIT=3               # Max retry attempts (default: 3)
NJ_RETRY_BACKOFF_LIMIT=5000    # Max delay between retries (default: 5s)
\`\`\`

## Output Structure

\`\`\`
NJ/
├── data/
│   ├── json/                  # Individual facility JSON files
│   └── url-*.csv             # Progress tracking
├── reports/
│   └── {facility_id}/        # Facility-specific PDFs
└── output/
    └── facilities.csv        # Final comprehensive CSV
\`\`\`

## Data Extracted

- Facility info (license, name, type, status, address, phone, admin)
- Bed types and counts (flexible array)
- Routine & complaint inspection summaries
- Downloaded PDFs for both routine and complaint reports

## Retry & Error Handling

- **Network Issues**: Automatic retry with exponential backoff (1s → 2s → 4s)
- **Timeouts**: Granular timeouts for DNS, connection, response
- **Invalid PDFs**: Validates PDF magic bytes, skips HTML error pages
- **Individual Failures**: Continues processing even if one facility fails

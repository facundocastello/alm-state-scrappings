# Michigan Adult Foster Care Facility Scraper

This scraper extracts facility data and reports from the Michigan LARA Adult Foster Care database.

## Overview

Unlike the NC implementation, this scraper does not crawl search results. Instead, it reads facility data from an input CSV file (`input/AdultFosterCare.csv`) and then scrapes individual facility profile pages to extract detailed information and download reports.

## Data Source

- **Base URL**: https://adultfostercare.apps.lara.state.mi.us
- **Profile URL Format**: `{BASE_URL}/Home/FacilityProfile/{LicenseNumber}`
- **Input CSV**: `input/AdultFosterCare.csv` (contains ~4,200+ facilities)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp env.example .env
```

3. Edit `.env` to adjust concurrency settings if needed:
```
MI_FACILITY_CONCURRENCY=2
MI_USER_AGENT=Mozilla/5.0 ...
```

## Usage

```bash
# Build and run
npm start

# Run in development mode (no build step)
npm run dev

# Type-check only
npm run lint
```

## Data Flow

1. **Read Input CSV**: Loads facility summaries from `input/AdultFosterCare.csv`
2. **Scrape Profiles**: For each facility, visits the profile page and extracts:
   - Facility Information (name, address, status, license dates, capacity)
   - Services Provided (serves, special certification)
   - Licensee Information (name, address, phone)
   - Reports Available (inspection reports, renewal reports, etc.)
3. **Download Reports**: Downloads PDF reports to `reports/{license_number}/`
4. **Export CSV**: Writes flattened data to `output/MI.csv`

## Output Structure

```
MI/
├── data/
│   ├── url-in-progress.csv    # Progress tracking (currently processing)
│   └── url-finished.csv        # Completed facilities
├── output/
│   └── MI.csv                  # Final flattened dataset
└── reports/
    └── {license_number}/
        └── YYYYMMDD-{type}-{filename}.pdf
```

## Progress Tracking

The scraper uses CSV-based progress tracking to enable resume capability:
- On restart, it automatically skips facilities already in `url-finished.csv`
- To force a full re-run, delete `data/url-finished.csv`

## CSV Output Fields

- `facility_id`: License/Exemption Number
- `license_number`: License/Exemption Number
- `facility_name`: Facility Name
- `license_type`: License Type
- `address`, `city`, `county`, `zip_code`, `phone`: Location info
- `capacity`: Facility capacity
- `facility_status`: ACTIVE, INACTIVE, etc.
- `license_status`: REGULAR, PROVISIONAL, etc.
- `license_effective_date`, `license_expiration_date`: License dates
- `license_facility_type`: Facility type description
- `serves`: Semicolon-separated list of populations served
- `special_certification`: Semicolon-separated certifications
- `licensee_name`, `licensee_address`, `licensee_phone`: Licensee info
- `reports_total`: Number of reports found
- `profile_url`: Link to facility profile page
- `reports`: Pipe-separated list of reports with dates and file paths

## Notes

- **VPN Required**: The Michigan LARA site requires a VPN connection to access
- **Rate Limiting**: Default concurrency is 2 facilities at a time. Adjust in `.env` if needed
- **Resume Capability**: The scraper can be safely stopped and restarted; it will skip completed facilities


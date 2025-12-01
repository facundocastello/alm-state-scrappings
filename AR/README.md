# Arizona Healthcare Facility Scraper

Scrapes healthcare facility data from [AZ CareCheck](https://azcarecheck.azdhs.gov/) - Arizona Department of Health Services licensing portal.

## Data Source

- **Website**: https://azcarecheck.azdhs.gov/
- **API**: Salesforce Aura (Lightning Web Components)
- **Coverage**: 7,498 healthcare facilities in Arizona

## Facility Types

| Type | Count |
|------|-------|
| Outpatient Treatment Center | 2,877 |
| Assisted Living Home | 1,823 |
| Behavioral Health Residential Facility | 814 |
| Assisted Living Center | 333 |
| Hospice Service Agency | 290 |
| Outpatient Surgical Center | 283 |
| Home Health Agency | 222 |
| Counseling Facility | 172 |
| Nursing Care Institution | 139 |
| + 16 more types | 545 |

## Data Collected

### Facility Details (42 fields)
- Basic: name, DBA, address, phone, type, bureau, program
- Location: city, state, zip, coordinates
- License: number, owner, status, effective/expiration dates
- Capacity: total beds, services with individual capacities
- Management: administrator, manager, manager license
- Quality: rating (A/B/C for nursing homes), CCN (Medicare number)
- URLs: license certificate download

### Inspections
- List of all inspections with dates, types, status
- Detailed deficiency items with:
  - Rule citation
  - Evidence/findings
  - Corrective actions

### Attachments
- Notice of Inspection PDFs
- Other inspection documents

## Output

### CSV (`output/facilities.csv`)
One row per facility with all fields flattened:
- IDs, names, types
- Location and contact info
- License details
- Capacity and services (JSON)
- Inspection summary (count, last date, deficiency count)
- Downloaded report paths

### JSON (`data/{facility_id}.json`)
Full scraped data per facility including:
- Complete facility details
- All inspections with full deficiency text
- Attachment metadata

### PDFs (`reports/{facility_id}/`)
Downloaded inspection reports organized by facility.

## Usage

### Setup
```bash
npm install
cp env.example .env
```

### Run Full Scrape
```bash
npm start
```

### Test with Sample
```bash
npm run dev -- --sample 10
```

### Options
```bash
# Skip downloading PDFs (faster)
npm run dev -- --no-attachments

# Skip inspection details (only get list)
npm run dev -- --no-details

# Combine options
npm run dev -- --sample 50 --no-attachments
```

### Resume After Failure
Simply re-run `npm start`. Progress is tracked in `data/progress.csv`.

### Force Full Re-run
```bash
rm data/progress.csv
npm start
```

## Configuration

Edit `.env` or set environment variables:

```bash
# Concurrent API requests (default: 3)
AZ_CONCURRENCY=5
```

## API Details

The scraper uses the Salesforce Aura API endpoints:

| Endpoint | Description |
|----------|-------------|
| `AZCCFacilityDetailsTabController.getFacilityDetails` | Facility details |
| `AZCCInspectionHistoryController.getFacilityOrLicenseInspections` | Inspection list |
| `AZCCInspectionHistoryController.getInspectionAndFacilityDetailsForPrintView` | Inspection details with deficiencies |
| `AttachFilesModalController.getFilesFromRecordPublicSite` | Inspection attachments |

## Performance

- ~8-10 seconds per facility (with details + attachments)
- ~2-3 seconds per facility (no details)
- Full scrape (7,498 facilities): ~15-20 hours with concurrency=3

## Notes

- Quality ratings (A/B/C) only available for Nursing Care Institutions
- CCN (CMS Certification Number) only for Medicare-certified facilities
- Some facilities may have 0 inspections (newly licensed or exempt)
- Inspection PDFs are only available for some inspections

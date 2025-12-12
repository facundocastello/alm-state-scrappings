# Oregon Scraper - CLAUDE.md

## Project Status

**Phase 1**: ✅ Complete - Data scraping implemented
**Phase 2**: 🔲 Pending - LLM summarization

## Architecture

This scraper uses:
1. **ArcGIS REST API** - Fetches all ~4,484 facility records with full metadata
2. **Web Portal Scraping** - Scrapes surveys, violations, notices from HTML pages
3. **HTML Report Generation** - Creates styled reports with pink gradient theme

### Data Sources

| Source | URL | Data |
|--------|-----|------|
| ArcGIS API | `services.arcgis.com/.../webFACILITY/FeatureServer` | 82 fields per facility |
| Surveys | `/Surveys/Index/{id}` | Inspection history, deficiency counts |
| Violations | `/Violations/Index/{id}` | Abuse & licensing violations |
| Notices | `/Notices/Index/{id}` | License conditions, revocations |
| Survey Details | `/SurveyCites/Index/{reportNum}` | Citation details per survey |

### Key Files

```
OR/
├── src/
│   ├── index.ts      # Main orchestrator, queue management
│   ├── api.ts        # ArcGIS API client (pagination)
│   ├── scraper.ts    # Web scraping (surveys, violations, notices)
│   ├── report.ts     # HTML report generator (pink theme)
│   ├── csv.ts        # CSV export (50+ columns)
│   ├── progress.ts   # Resume tracking
│   ├── config.ts     # URLs, concurrency settings
│   ├── http.ts       # HTTP client wrapper
│   └── types.ts      # TypeScript interfaces
├── data/
│   ├── facilities.json  # Cached API response (4,484 facilities)
│   └── progress.csv     # Resume tracking
├── output/
│   └── facilities.csv   # Final dataset (50+ columns)
└── reports/
    └── {facility_id}/
        └── report.html  # Styled HTML report
```

## Data Structure

### From ArcGIS API (82 fields)

**Identification**: FacilityID, CCMUNum, MedicareID, MedicaidID
**Basic Info**: FacilityName, FacilityTypeDesc, AFHClass, OperatingStatusDesc
**Address**: Address, City, State, County, Zip
**Contact**: Phone, Fax, Email, Website, AdministratorName
**Capacity**: TotalBed
**Dates**: ActiveDate, InactiveDate, FacilityCloseDate
**Owner/Operator/Management**: Full contact info for each
**Services**: AlzheimerDementia, Bariatric, Ventilator, TraumaticBrainInjury, etc.
**Funding**: MedicaidFlg, MedicareFlg, PrivatePayFlg

### From Web Scraping

**Surveys**: date, reportNumber, categoryTypes[], deficiencyCount
**Survey Citations**: tagId, tagTitle, level, visits[]
**Violations**: type (abuse/licensing), description
**Notices**: type, description

## Facility Types

| Code | Description | Count (approx) |
|------|-------------|----------------|
| AFH | Adult Foster Home | ~3,700 |
| ALF | Assisted Living Facility | ~350 |
| NF | Nursing Facility | ~130 |
| RCF | Residential Care Facility | ~300 |

## Common Tasks

### Fetch fresh facility data
```bash
npm run fetch-facilities
```

### Run full scraper
```bash
npm start
```

### Resume after interruption
Simply re-run `npm start` - progress tracker auto-skips completed facilities.

### Force re-scrape all
```bash
rm data/progress.csv
npm start
```

### Adjust concurrency
```bash
OR_CONCURRENCY=5 npm start
```

### Debug single facility
```typescript
// In src/index.ts, add filter:
const pendingFacilities = allFacilities
  .filter(f => f.FacilityID === "9977609451")
  .filter(f => !completedIds.has(f.FacilityID));
```

## CSV Output

The output CSV contains **50+ columns** including:

- All facility identification and basic info
- Full address details
- Contact information
- Capacity (beds)
- All dates (active, inactive, close)
- Owner name, address, phone
- Operator name, address, phone
- Management name, address, phone
- Service flags (Yes/No for 8 services)
- Funding flags (Medicaid, Medicare, Private Pay)
- Scraped data: surveyCount, totalDeficiencies, violationCounts, noticeCount
- Latest survey info
- Report file path and profile URL

## API Notes

### ArcGIS Pagination
The API returns max 2000 records per request. With ~4,484 facilities, 3 requests are needed:
- Offset 0: records 1-2000
- Offset 2000: records 2001-4000
- Offset 4000: records 4001-4484

### Web Portal Rate Limiting
Small delays (200ms) between requests to be respectful. Concurrency default is 3.

## Phase 2 Implementation Notes

For LLM summarization:

1. Load scraped data from `data/` directory
2. Extract survey citations with deficiency details
3. Send to LLM with structured prompt
4. Generate summary fields:
   - Overall compliance assessment
   - Key concerns identified
   - Improvement trends
   - Risk indicators
5. Add summary columns to CSV

## Troubleshooting

### "No surveys found"
The surveys table structure may have changed. Check `/Surveys/Index/{id}` HTML.

### API returns empty
Check if ArcGIS service is up: query with `returnCountOnly=true` first.

### Progress not resuming
Ensure `data/progress.csv` exists and has valid entries.

# Arizona Scraper - CLAUDE.md

## Project Status

**Phase 1**: ✅ Complete - Data scraping implemented
**Phase 2**: 🔲 Pending - LLM summarization

## Architecture

This scraper uses a Salesforce Aura API (Lightning Web Components) to extract data from AZ CareCheck.

### Key Files

```
AR/
├── src/
│   ├── index.ts      # Main entry point, CLI, queue management
│   ├── api.ts        # Salesforce Aura API client
│   ├── scraper.ts    # Facility scraping logic
│   ├── csv.ts        # CSV export
│   ├── progress.ts   # Progress tracking for resume
│   └── types.ts      # TypeScript interfaces
├── input/
│   └── facilities.json  # Pre-loaded facility list from search
├── output/
│   └── facilities.csv   # Scraped data (one row per facility)
├── data/
│   ├── {facility_id}.json  # Full scraped data per facility
│   └── progress.csv        # Resume tracking
└── reports/
    └── {facility_id}/      # Downloaded PDFs per facility
```

### API Endpoints

The Salesforce Aura API requires specific message format:

```typescript
// Example API call
const message = {
  actions: [{
    id: "1;a",
    descriptor: "aura://ApexActionController/ACTION$execute",
    params: {
      classname: "AZCCFacilityDetailsTabController",
      method: "getFacilityDetails",
      params: { facilityId: "001cs00000Wo4UdAAJ" }
    }
  }]
};
```

### Controllers Used
- `AZCCFacilityDetailsTabController.getFacilityDetails` - Facility details
- `AZCCInspectionHistoryController.getFacilityOrLicenseInspections` - List inspections
- `AZCCInspectionHistoryController.getInspectionAndFacilityDetailsForPrintView` - Inspection + deficiencies
- `AttachFilesModalController.getFilesFromRecordPublicSite` - Attachments
- `AZCCFacilityHeaderController.getCustomMetadataInfo` - Feature flags

## Data Structure

### Facility Details
- 42 fields including: legalName, dba, address, license info, capacity, administrator
- Special fields: `qualityRating` (A/B/C), `ccn` (Medicare number)
- Services array with individual capacities

### Inspections
- List with: inspectionId, inspectionName, inspectionType, dates, status, comments
- Details include: `inspectionItems` array with deficiencies
  - Each deficiency has: `rule`, `evidence`, `hasAttachments`

### Attachments
- PDFs: `Notice_of_Inspection.pdf` typically
- Downloaded to `reports/{facilityId}/{inspectionName}_{filename}`

## Common Tasks

### Add new field to output
1. Add to `FacilityDetails` interface in `types.ts`
2. Map in `toCSVRow()` in `csv.ts`
3. Add header in `CSV_HEADERS` array

### Increase concurrency
```bash
AZ_CONCURRENCY=5 npm start
```

### Debug single facility
```typescript
// In src/index.ts, filter facilities:
facilities = facilities.filter(f => f["5"] === "001cs00000Wo4UdAAJ");
```

### Test API call
```bash
# Use the explore-data.py or test-api.py scripts from examples/
python3 test-api.py 001cs00000Wo4UdAAJ
```

## Phase 2 Implementation Notes

For LLM summarization:

1. Load `data/{facility_id}.json` files
2. Extract inspection deficiencies from `inspectionDetails`
3. Optionally load PDFs from `reports/` (will need PDF parsing)
4. Send to LLM with prompt template
5. Extract structured summary
6. Add summary fields to CSV

Key data for summaries:
- `inspectionItems[].evidence` - Detailed findings
- `inspectionItems[].rule` - Regulatory citation
- `initialComments` - Summary statement
- `qualityRating` - Letter grade (nursing homes only)

## API Context

The `fwuid` and `app` context may need updating if the API changes:

```typescript
const AURA_CONTEXT = {
  mode: "PROD",
  fwuid: "MXg4UmtXaFlzZ0JoYTJBejdMZEtWdzFLcUUxeUY3ZVB6dE9hR0VheDVpb2cxMy4zMzU1NDQzMi41MDMzMTY0OA",
  app: "siteforce:communityApp",
  loaded: { "APPLICATION@markup://siteforce:communityApp": "1414_JnVqyfJtnxwn08WU8yKzPg" }
};
```

If API calls start failing, capture fresh values from browser DevTools Network tab.

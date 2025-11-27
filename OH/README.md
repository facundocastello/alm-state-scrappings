# Ohio Long-Term Care Facility Scraper

Comprehensive scraper for Ohio's long-term care facility database using network interception to capture API responses.

## Overview

This scraper extracts data from Ohio's Department of Aging facility search system at `https://prod.ltc.age.ohio.gov/`.

### Facility Types Supported

- **NH** - Nursing Homes
- **RC** - Assisted Living (RCF)
- **ACF** - Supportive Living
- **RTF** - Residential Treatment Facilities

## How It Works

### Workflow

1. **Navigate to search page** (`/FacilitySearch`)
2. **Select facility type** from dropdown
3. **Click Search** to get results
4. **Set pagination** to 500 records per page
5. **For each facility**:
   - Click facility name link
   - Intercept all API responses (profile, services, payment, staff, quality)
   - Go back to search results
6. **Handle pagination** if more than 500 facilities
7. **Save data** to JSON

### Network Interception Approach

Instead of trying to reverse-engineer the encrypted `facId` parameter, we use Puppeteer's network interception to capture the API responses directly:

```typescript
page.on('response', async (response) => {
  if (response.url().includes('FacilityProfile')) {
    const data = await response.text();
    // Parse and save XML response
  }
});
```

### API Endpoints Captured

Each facility profile makes these AJAX calls:

- `getFacilityProfile` - Basic facility information
- `getServices` - Services offered
- `getPaymentInformation` - Payment types accepted
- `getStaffInformation` - Staffing levels and ratios
- `getQualityMeasures` - Quality ratings and scores

All responses are XML format:
```xml
<s name="FACILITY_ID"><![CDATA[OH00826]]></s>
<s name="NAME"><![CDATA[FACILITY NAME]]></s>
<s name="ADDRESS_1"><![CDATA[123 MAIN ST]]></s>
```

## Installation

```bash
cd OH
npm install
```

## Usage

### Scrape Nursing Homes Only

```bash
npm start
```

### Scrape All Facility Types

Edit `src/scraper.ts` and change:
```typescript
scraper.run(['NH', 'RC', 'ACF', 'RTF']).catch(console.error);
```

### Development Mode (faster iteration)

```bash
npm run dev
```

## Output

Data is saved to `output/facilities-[timestamp].json`:

```json
[
  {
    "plainId": "04-2104",
    "name": "4608 Place",
    "facilityType": "NH",
    "profile": {
      "FACILITY_ID": "OH00826",
      "NAME": "FACILITY NAME",
      "ADDRESS_1": "123 MAIN ST",
      "CITY": "COLUMBUS",
      "PHONE": "6145551234",
      ...
    },
    "services": { ... },
    "payment": { ... },
    "staff": { ... },
    "quality": { ... },
    "raw": {
      "profileXml": "...",
      "servicesXml": "...",
      ...
    }
  }
]
```

## Configuration

### Adjust Scraping Speed

In `src/scraper.ts`, modify wait times:

```typescript
await this.page.waitForTimeout(4000); // Wait for AJAX calls (adjust as needed)
```

### Headless Mode

For faster scraping without browser UI:

```typescript
const browser = await puppeteer.launch({
  headless: true, // Change to true
  ...
});
```

### Error Recovery

The scraper automatically handles:
- Navigation timeouts
- Missing data
- Network errors
- Goes back to results page on failure

## Data Fields

### Facility Profile
- Facility ID, Name, DBA Name
- Address, City, State, Zip
- Phone, Fax, Email, Website
- Owner information
- License information
- Bed counts and capacity

### Services
- Services offered
- Waiver programs
- Specialized care

### Payment Information
- Payment types accepted
- Rates (if available)
- Medicaid/Medicare status

### Staff Information
- Registered Nurses (RN)
- Licensed Practical Nurses (LPN)
- Nurse Aides
- Hours per patient day
- Staff retention rates

### Quality Measures
- Survey scores
- Quality ratings
- Inspection results

## Project Structure

```
OH/
├── src/
│   └── scraper.ts          # Main scraper implementation
├── output/                 # Generated data files
├── test-responses/         # Sample API responses for testing
├── package.json
├── tsconfig.json
└── README.md
```

## Advantages Over ID Mapping Approach

✅ **Simpler** - No need to reverse-engineer encrypted IDs
✅ **More reliable** - Works even if encryption changes
✅ **Complete data** - Captures all API responses automatically
✅ **Less code** - Network interception is built-in to Puppeteer

## Troubleshooting

### Scraper stops working
- Check if website structure changed
- Increase timeout values
- Check browser console for errors

### Missing data for some facilities
- Some fields may be empty in the source
- Check `raw.profileXml` for original response

### Pagination not working
- Verify the pagination selector hasn't changed
- Check console output for navigation errors

## Performance

- **Speed**: ~5-10 seconds per facility (including navigation and AJAX calls)
- **Expected runtime**:
  - ~900 Nursing Homes: ~2-3 hours
  - All facility types: ~6-8 hours

## Notes

- The encrypted `facId` parameter (e.g., `XmkBHsU855E=`) is server-generated and we don't need it
- Browser automation is required due to ASP.NET WebForms architecture
- Data is captured from actual API responses, ensuring accuracy
- Raw XML responses are preserved for debugging

## Next Steps

After data collection:
1. Parse JSON to CSV for analysis
2. Implement Phase 2 (LLM summarization) as per parent CLAUDE.md
3. Generate facility reports

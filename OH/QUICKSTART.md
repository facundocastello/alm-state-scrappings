# Ohio Scraper - Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Install Dependencies
```bash
cd /Users/facundo/projects/jobs/state-scrapping/OH
npm install
```

### 2. Run the Scraper
```bash
npm run dev
```

### 3. Check Output
Data saved to: `output/facilities-[timestamp].json`

## 🎯 What It Does

1. Opens browser to Ohio facility search
2. Selects "Nursing Home (NH)" facility type
3. Searches and sets 500 records per page
4. For each facility:
   - Clicks facility name
   - Captures all API responses
   - Saves complete data
   - Goes back to list
5. Handles pagination automatically
6. Saves everything to JSON

## 📊 Expected Results

### Nursing Homes (NH)
- **Count**: ~900 facilities
- **Time**: 2-3 hours
- **Data**: Complete profiles, services, payment, staff, quality

## ⚙️ Customize

### Scrape Different Facility Types

Edit `src/scraper.ts` (last line):

```typescript
// Just Nursing Homes (default)
scraper.run(['NH']).catch(console.error);

// All facility types
scraper.run(['NH', 'RC', 'ACF', 'RTF']).catch(console.error);

// Just Assisted Living
scraper.run(['RC']).catch(console.error);
```

### Run Headless (No Browser Window)

Edit `src/scraper.ts` line ~51:

```typescript
const browser = await puppeteer.launch({
  headless: true,  // Change to true
  ...
});
```

### Adjust Speed

Edit wait times in `src/scraper.ts`:

```typescript
// Line ~143: Wait after clicking facility
await this.page.waitForTimeout(4000); // Increase if missing data

// Line ~202: Wait after navigation
await this.page.waitForTimeout(2000); // Adjust pagination speed
```

## 📁 Output Format

```json
[
  {
    "plainId": "04-2104",
    "name": "Example Nursing Home",
    "facilityType": "NH",
    "profile": {
      "FACILITY_ID": "OH00826",
      "NAME": "Example Nursing Home",
      "ADDRESS_1": "123 Main St",
      "CITY": "Columbus",
      "STATE": "OH",
      "ZIP": "43215",
      "PHONE": "6145551234",
      "EMAIL": "info@example.com",
      "WEB_SITE": "www.example.com",
      ...
    },
    "services": { ... },
    "payment": { ... },
    "staff": {
      "NUMBER_OF_REGISTERED_NURSES": "5",
      "NUMBER_OF_PRACTICAL_NURSES": "13",
      "NUMBER_OF_NURSE_AIDES": "28",
      "RN_HRS_CARE_PER_PAT_DAY": "0.61",
      ...
    },
    "quality": { ... },
    "raw": {
      "profileXml": "...",
      "servicesXml": "...",
      ...
    }
  }
]
```

## 🔧 Troubleshooting

### Scraper stops after a few facilities
→ Increase timeout values (see "Adjust Speed" above)

### Browser keeps crashing
→ Close other applications to free up memory

### Missing data for some facilities
→ Normal - not all facilities have complete data

### Want to start over
→ Delete `output/` directory and run again

## 💡 Tips

- **First run**: Test with `['NH']` to verify everything works
- **Monitor progress**: Watch console output for status
- **Check data**: Open JSON file to verify data quality
- **Background running**: Enable headless mode for unattended runs

## 📝 Console Output

```
=== Scraping: Nursing Home (NH) ===

✓ Loaded search page
✓ Selected facility type: Nursing Home (NH)
✓ Search results loaded
✓ Set records per page to 500

--- Page 1 ---
✓ Found 500 facilities on this page

  Processing: 04-2104 - Example Nursing Home
    → Captured: Facility Profile
    → Captured: Services
    → Captured: Payment Info
    → Captured: Staff Info
    → Captured: Quality Measures
  ✓ Completed 04-2104

  Processing: 04-2365 - Another Facility
  ...

✓ No more pages

✓ Saved 927 facilities to facilities-2024-11-19T12-30-45.json

=== Scraping Complete ===
Total facilities scraped: 927
```

## 🎓 Understanding the Code

### Main Components

1. **OhioFacilityScraper class** - Core scraper logic
2. **Network interceptor** - Captures API responses
3. **XML parser** - Extracts data from responses
4. **Pagination handler** - Navigates multiple pages

### Flow

```
initialize() → selectFacilityType() → setRecordsPerPage()
    ↓
extractFacilityList() → for each facility:
    ↓
scrapeFacility() → [intercept responses] → save data
    ↓
hasNextPage()? → goToNextPage() → repeat
    ↓
saveData()
```

## 🚨 Important Notes

- **Time commitment**: Full NH scrape takes 2-3 hours
- **Network required**: Continuous internet connection
- **Browser automation**: Browser window will be visible (unless headless)
- **Data accuracy**: Reflects current state of Ohio database

## ✅ Ready to Run

Everything is configured and ready. Just run:

```bash
npm run dev
```

And watch the magic happen! ✨

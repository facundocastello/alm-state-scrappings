# The EASIER Way - Network Interception

## Problem Recap

When you click a facility name in search results:
1. Browser submits form with VIEWSTATE
2. Server redirects to `FacilityProfile?facId=XmkBHsU855E=` (encrypted ID)
3. Page loads and makes AJAX calls to fetch facility data
4. Data comes back as XML responses

## The Easier Solution: Intercept the API Responses

**Instead of building an ID mapping**, just intercept the network responses!

### How It Works

```typescript
// 1. Set up network interception
page.on('response', async (response) => {
  if (response.url().includes('FacilityProfile')) {
    const data = await response.text();
    // Parse the XML and save it
    saveData(parseXml(data));
  }
});

// 2. Click facility links
await page.click('a[facid="04-2104"]');

// 3. Wait for all AJAX calls to complete
await page.waitForTimeout(3000);

// 4. Data is automatically captured via interception!
```

### Advantages

✅ **No need to figure out facId encoding** - we don't care about the encrypted ID
✅ **Get all facility data automatically** - all AJAX responses captured
✅ **Simpler code** - less complexity than building ID mapping
✅ **More reliable** - works even if ID encoding changes

### What Gets Intercepted

Each facility profile page makes these AJAX calls:
- `getFacilityProfile` → Basic info (name, address, phone, etc.)
- `getServices` → Services offered
- `getPaymentInformation` → Payment types accepted
- `getStaffInformation` → Staffing data
- `getQualityMeasures` → Quality ratings

All responses are XML like your `test2.html`:
```xml
<s name="NAME"><![CDATA[FACILITY NAME]]></s>
<s name="ADDRESS_1"><![CDATA[123 MAIN ST]]></s>
<s name="PHONE"><![CDATA[5551234567]]></s>
```

### Implementation

See `intercept-approach.ts` for complete code.

**Key steps:**
1. Use Puppeteer's `page.on('response')` to intercept network calls
2. Check if URL contains `FacilityProfile`
3. Parse XML response
4. Associate with current facility being scraped
5. Save to JSON

### Comparison

**Old Approach (ID Mapping):**
```
Click facility → Capture encrypted facId → Build mapping → Make HTTP requests
```

**New Approach (Interception):**
```
Click facility → Intercept responses → Done!
```

### Full Workflow

```
1. Navigate to search results
2. Extract facility IDs and names from table (04-2104, etc.)
3. For each facility:
   a. Click facility link
   b. Network interceptor auto-captures all AJAX responses
   c. Go back to search results
4. Save all collected data to JSON
```

### No Manual Decryption Needed!

The encrypted `facId` is **irrelevant** when using this approach. The browser handles it automatically, and we just capture what comes back.

## Next Steps

1. ✅ Test network interception with one facility
2. ✅ Verify all API responses are captured
3. ✅ Implement full scraping loop
4. ✅ Parse XML responses into structured data
5. ✅ Export to CSV/JSON

This is much simpler than trying to reverse-engineer the ID encryption!

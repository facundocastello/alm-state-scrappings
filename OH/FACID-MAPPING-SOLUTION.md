# Ohio Facility ID Mapping Solution

## Problem

Ohio's system uses **two different facility ID formats**:

1. **Plain ID** (in search results): `04-2104`, `04-2365`, etc.
2. **Encrypted ID** (in profile URLs): `XmkBHsU855E=`, etc.

The encrypted ID is **server-generated** and cannot be computed client-side. It appears to be encrypted/signed data.

## Discovery

### Search Results Page
- Facility links have attribute: `facid="04-2104"`
- Links trigger ASP.NET postback: `javascript:__doPostBack(...)`
- Server processes postback and redirects to: `FacilityProfile?facId=XmkBHsU855E=&FAC_TYPE=NH`

### API Endpoints (from curls.yaml)
Once you have the encrypted `facId`, these AJAX APIs work:

```bash
# Base URL pattern
https://prod.ltc.age.ohio.gov/FacilityProfile?facId=${ENCRYPTED_ID}&FAC_TYPE=NH

# API calls (POST with XML body)
- getFacilityProfile
- getServices
- getPaymentInformation
- getServicesNR
- getStaffInformation
- getALWaiverBeds
- getQualityMeasures
```

## Solution: Two-Phase Approach

### Phase 1: Build ID Mapping (Puppeteer Required)

```typescript
// For each facility in search results:
1. Extract plain ID from facid attribute
2. Click facility name link
3. Wait for redirect to FacilityProfile page
4. Capture URL → extract encrypted facId parameter
5. Store mapping: { "04-2104": "XmkBHsU855E=" }
6. Go back to results
```

**Why Puppeteer?**
- Server generates encrypted ID during postback
- No client-side algorithm to convert plain → encrypted
- Must simulate user clicking to trigger server-side encoding

### Phase 2: Use API with Encrypted IDs

Once you have the mapping, you can use fast HTTP requests:

```typescript
import got from 'got';

async function fetchFacilityData(encryptedFacId: string) {
  const baseUrl = `https://prod.ltc.age.ohio.gov/FacilityProfile?facId=${encryptedFacId}&FAC_TYPE=NH`;

  // Fetch facility profile
  const profile = await got.post(baseUrl, {
    headers: {
      'Content-Type': 'text/xml',
      'OBPostReq': 'true',
      'OBPostSync': 'true',
    },
    body: `<ob_post eventname="getFacilityProfile"><param name="CSRFCheck"><![CDATA[${Math.random()}]]></param></ob_post>`,
  }).text();

  // Fetch services
  const services = await got.post(baseUrl, {
    headers: { /* same */ },
    body: `<ob_post eventname="getServices"><param name="CSRFCheck"><![CDATA[${Math.random()}]]></param></ob_post>`,
  }).text();

  // Fetch quality measures
  const quality = await got.post(baseUrl, {
    headers: { /* same */ },
    body: `<ob_post eventname="getQualityMeasures"><param name="CSRFCheck"><![CDATA[${Math.random()}]]></param></ob_post>`,
  }).text();

  return { profile, services, quality };
}
```

## Implementation Strategy

### Step 1: Perform Search & Build Mapping
```typescript
const mapping = await extractFacIdMapping();
// Save to JSON file
fs.writeFileSync('facid-mapping.json', JSON.stringify(mapping, null, 2));
```

### Step 2: Fast Data Collection
```typescript
const mapping = JSON.parse(fs.readFileSync('facid-mapping.json', 'utf-8'));

for (const [plainId, encryptedId] of Object.entries(mapping)) {
  const data = await fetchFacilityData(encryptedId);
  // Save data for this facility
}
```

## Alternative: Full Puppeteer Scraping

If building the mapping is too complex, you could:

1. Use Puppeteer for the entire scraping process
2. Click each facility link
3. Wait for profile page to load
4. Use `page.evaluate()` to trigger AJAX calls
5. Intercept network responses for API data

**Trade-off**: Slower but simpler (no need for ID mapping).

## Key Findings

✅ **API endpoints are discoverable** - Your curls.yaml shows all available endpoints
✅ **Session cookies may be required** - Test if calls work without cookies or if you need to maintain session
✅ **CSRFCheck parameter** - Appears to accept any random number (test this)
✅ **Plain IDs available in search results** - Easy to extract from HTML
✅ **Encrypted IDs are server-generated** - Must capture during navigation

## Next Steps

1. ✅ Test API calls with valid session to confirm they return data
2. ✅ Verify if CSRFCheck validation is strict or accepts random values
3. ✅ Implement Puppeteer mapping extraction
4. ✅ Cache mapping to avoid re-extracting
5. ✅ Use mapping for fast API-based scraping

## File Created

See `extract-facid-mapping.ts` for starter code to build the ID mapping using Puppeteer.

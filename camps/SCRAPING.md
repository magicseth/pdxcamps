# Camp Scraping System

This document describes how to add and maintain scrapers for camp websites.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  scrapeSources  │────▶│    executor.ts   │────▶│  scrapeRawData  │
│  (DB config)    │     │  (runs scrapers) │     │  (stored JSON)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │              ┌──────────────────┐
         │              │  Built-in OR     │
         │              │  Dynamic scraper │
         └──────────────┴──────────────────┘
```

### Key Tables
- `scrapeSources` - Camp provider config (URL, scraper code/module)
- `scrapeJobs` - Each scrape run
- `scrapeRawData` - Raw JSON from each scrape (non-destructive history)
- `scrapeChanges` - Detected changes between scrapes

## Adding a New Scraper

### Step 1: Add Source to Database

```bash
npx convex run scraping/seedSources:addScrapeSource '{
  "name": "Camp Name",
  "url": "https://example.com/camps",
  "scrapeType": "html"
}'
```

Or add to the seed file: `convex/scraping/seedSources.ts`

### Step 2: Analyze the Website

1. Open the camp's website in browser
2. Open DevTools (F12) → Network tab
3. Look for:
   - API calls that return camp data (check XHR/Fetch)
   - HTML structure of camp listings
   - Any JavaScript rendering requirements

### Step 3: Generate Scraper Code

For **API-based sites** (like OMSI with Salesforce):
- Find the API endpoint
- Identify required headers/auth
- Create scraper that calls API directly

For **HTML sites**:
- Identify CSS selectors for camp containers
- Map selectors to data fields (name, dates, price, etc.)

### Step 4: Store Scraper Code

**Option A: Built-in scraper (for complex scrapers)**

Create file: `convex/scraping/scrapers/{name}.ts`

```typescript
import { ScraperConfig, ScraperLogger, ScrapeResult, ScraperRegistryEntry } from "./types";

async function scrape(config: ScraperConfig, log: ScraperLogger): Promise<ScrapeResult> {
  // Your scraper logic here
  return {
    success: true,
    sessions: [...],
    scrapedAt: Date.now(),
    durationMs: 0,
    pagesScraped: 1,
  };
}

export const myScraper: ScraperRegistryEntry = {
  name: "my-scraper",
  description: "Description here",
  scrape,
  domains: ["example.com"],
};

export default myScraper;
```

Then add to executor.ts BUILTIN_SCRAPERS and run:
```bash
npx convex run scraping/mutations:updateScraperModule '{"sourceId": "...", "module": "my-scraper"}'
```

**Option B: Dynamic scraper (stored in DB)**

```bash
npx convex run scraping/scrapers/executor:testScraperCode '{
  "url": "https://example.com/camps",
  "code": "const response = await fetch(config.url); const html = await response.text(); const $ = cheerio.load(html); const sessions = []; $(\"selector\").each((i, el) => { sessions.push({ name: $(el).find(\".title\").text() }); }); return { success: true, sessions, scrapedAt: Date.now(), durationMs: 0, pagesScraped: 1 };"
}'
```

If test passes, save it:
```bash
npx convex run scraping/mutations:updateScraperCode '{"sourceId": "...", "code": "..."}'
```

### Step 5: Activate and Test

```bash
# Activate the source
npx convex run scraping/mutations:activateScrapeSource '{"sourceId": "..."}'

# Run the scraper
npx convex run scraping/scrapers/executor:executeScraper '{"sourceId": "..."}'
```

## Dynamic Scraper Code Template

Dynamic scrapers receive these parameters:
- `config` - { sourceId, url, name, organizationId, customConfig }
- `log` - function(level, message, data) for logging
- `fetch` - standard fetch API
- `cheerio` - cheerio library for HTML parsing

```javascript
// Example dynamic scraper code
const response = await fetch(config.url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; PDXCampsBot/1.0)",
    "Accept": "text/html"
  }
});

if (!response.ok) {
  return { success: false, error: `HTTP ${response.status}`, sessions: [], scrapedAt: Date.now(), durationMs: 0, pagesScraped: 0 };
}

const html = await response.text();
const $ = cheerio.load(html);
const sessions = [];

$(".camp-item").each((i, el) => {
  const name = $(el).find(".title").text().trim();
  const dateRaw = $(el).find(".dates").text().trim();
  const priceRaw = $(el).find(".price").text().trim();

  if (name) {
    sessions.push({
      name,
      dateRaw,
      priceRaw,
      registrationUrl: $(el).find("a").attr("href"),
    });
  }
});

log("INFO", "Found sessions", { count: sessions.length });

return {
  success: true,
  sessions,
  scrapedAt: Date.now(),
  durationMs: 0,
  pagesScraped: 1,
};
```

## ScrapedSession Fields

```typescript
interface ScrapedSession {
  name: string;                    // Required

  // Dates
  startDate?: string;              // ISO: YYYY-MM-DD
  endDate?: string;
  dateRaw?: string;                // Original string

  // Times
  dropOffHour?: number;
  dropOffMinute?: number;
  pickUpHour?: number;
  pickUpMinute?: number;
  timeRaw?: string;

  // Pricing (cents)
  priceInCents?: number;
  memberPriceInCents?: number;
  priceRaw?: string;

  // Age/Grade
  minAge?: number;
  maxAge?: number;
  minGrade?: number;
  maxGrade?: number;
  ageGradeRaw?: string;

  // Other
  location?: string;
  isAvailable?: boolean;
  registrationUrl?: string;
  imageUrls?: string[];
  description?: string;
  category?: string;
  sourceProductId?: string;
}
```

## Troubleshooting

### "A pending job already exists"
A previous scrape didn't complete. Check scrapeJobs table and mark stale jobs as failed.

### Scraper timeout
Dynamic scrapers have 60-second timeout. For slow sites, consider:
- Reducing data fetched
- Using built-in scraper with chunked processing

### CORS/fetch errors
Some sites block server-side requests. Options:
- Check for API endpoints instead of HTML
- Use Stagehand for browser-based scraping (see below)

## Stagehand Integration (Future)

Many camp websites use JavaScript frameworks (React, Angular, Vue) that render content client-side. For these sites, we need browser-based scraping via Stagehand.

### When to Use Stagehand
- Site uses Angular, React, Vue, or similar frameworks
- Camp data is loaded via JavaScript after page load
- Site has interactive filters that load content dynamically
- Content is served from a headless CMS (Contentful, Sanity, etc.)

### How to Identify JS-Heavy Sites
1. View page source (Ctrl+U) - if you see `<div id="root"></div>` or `ng-app`, it's JS-heavy
2. Disable JavaScript in DevTools - if content disappears, it's JS-rendered
3. Check Network tab for XHR/Fetch requests that return JSON data

### Stagehand Setup (TODO)
```bash
# Install Stagehand dependencies
npm install @anthropic-ai/stagehand puppeteer

# Create browser-based scraper
# (implementation pending)
```

### Priority Sites for Stagehand
1. Trackers Earth (Angular + Contentful)
2. School of Rock (dynamic inventory)
3. Coding With Kids (dynamic filters)

## Real Example: Trackers Earth Scraper

This is a step-by-step walkthrough of how the Trackers Earth scraper was created.

### Step 1: Discover the API

1. Opened https://trackerspdx.com/youth/camps/summer-camp/ in browser
2. Viewed page source, found `ng-app="trackersApp"` - Angular app
3. Found JavaScript files: `app.js`, `directoryWidget.js`, `listingWidget.js`
4. Fetched `directoryWidget.js` and found the API endpoint pattern:
   ```
   /api/directory/sessions/{directoryId}
   ```
5. Found `directory-id="242"` in the HTML

### Step 2: Explore the API

```bash
# Test the API endpoint
curl -s "https://trackerspdx.com/api/directory/sessions/242" | head -c 1000

# Count entries across directories
for id in 240 241 242 243 244 245 246 247 248; do
  count=$(curl -s "https://trackerspdx.com/api/directory/sessions/$id" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(len(c.get('entries',[]))for loc in d for c in loc.get('containers',[])))")
  echo "Directory $id: $count entries"
done
```

**Results:**
- Directory 242: 1207 entries (Portland summer camps, June start)
- Directory 243: 1207 entries (Portland summer, August continuation)
- Directory 248: 237 entries (Portland spring break)
- Other directories: Seattle, Bay Area, etc.

### Step 3: Understand the Data Structure

```json
{
  "location_id": 2,
  "location_name": "SE Portland",
  "containers": [{
    "title": "Week 1",
    "display_date": "June 15-19, 2026",
    "entries": [{
      "theme_name": "Rangers: Stealth, Archery & Wilderness Survival",
      "path": "/youth/camps/summer-camp/rangers/",
      "open_grades": [3, 4, 5],
      "grade_range_displays": ["3-5"],
      "time_start": "9:00 am",
      "time_end": "3:30 pm",
      "theme_id": 123,
      "tag": "Rangers"
    }]
  }]
}
```

### Step 4: Write and Test the Scraper Code

```bash
# Test the scraper code
npx convex run scraping/scrapers/executor:testScraperCode '{
  "url": "https://trackerspdx.com/youth/camps/summer-camp/",
  "code": "const response = await fetch(\"https://trackerspdx.com/api/directory/sessions/242\"); ..."
}'
```

### Step 5: Save and Activate

```bash
# Save the scraper code to the source
npx convex run scraping/scrapers/executor:saveScraperCode '{
  "sourceId": "m57f2h2hprdrpahsspn0k6nq0980cqf8",
  "code": "..."
}'

# Activate the source
npx convex run scraping/mutations:activateScrapeSource '{"sourceId": "..."}'
```

**Result:** 904 Portland camp sessions scraped successfully.

---

## Current Status

### Working Scrapers
- **OMSI** (omsi module) - Salesforce Visualforce API, 250+ sessions
- **Trackers Earth** (dynamic code) - Directory API, 904 sessions

### Site Analysis Results

We analyzed 65 camp providers from PDXParent.com. Most modern camp sites use JavaScript frameworks that require browser-based scraping (Stagehand) rather than simple HTML parsing.

#### Sites Requiring Stagehand (JavaScript-heavy)
| Site | Technology | Notes |
|------|------------|-------|
| Trackers Earth | Angular + Contentful CMS | Data loaded client-side via Angular |
| School of Rock | React/Dynamic | Camp inventory loaded via JavaScript |
| Coding With Kids | Dynamic filters | JavaScript-dependent camp listings |
| NW Children's Theater | Unknown | URL structure unclear, needs investigation |

#### Sites with Simpler HTML (potential for direct scraping)
| Site | Notes |
|------|-------|
| PDX Fencing | Has basic camp info in HTML, registration via email |
| Oregon JCC/MJCC | Has dates/hours visible, calendar may have more detail |

#### Sites with API Potential
| Site | Notes |
|------|-------|
| OMSI | ✅ Working - Salesforce Visualforce API |

### Priority for Stagehand Integration
1. **Trackers Earth** - Large provider, well-structured data (in Contentful)
2. **Oregon JCC** - Community center with many camp options
3. **School of Rock** - Popular music camps

### Pending Sources (need scrapers)
Run `npx convex run scraping/seedSources:listScrapeSources '{}'` to see all sources.

### Sources Added to Waitlist
From PDX Parent guide scrape:
- Trackers Earth
- NW Children's Theater
- Backbeat Music Academy
- Shooting Star Adventures (Ohdaka, Camp Two Roads)
- Oregon JCC Day Camp

## Useful Commands

```bash
# List all sources
npx convex run scraping/seedSources:listScrapeSources '{}'

# Test scraper code without saving
npx convex run scraping/scrapers/executor:testScraperCode '{"url": "...", "code": "..."}'

# Run a scraper
npx convex run scraping/scrapers/executor:executeScraper '{"sourceId": "..."}'

# Check scraper health
# (view in Convex dashboard)
```

# Scraper Development Task

**IMPORTANT: TIME LIMIT**
1. Run `date` now to check the current time
2. You have 9 minutes maximum to complete this task
3. If you reach minute 9 without success, STOP and write whatever partial scraper you have to the output file
4. Do not spend more than 3 minutes exploring - start writing the scraper early

You are developing a web scraper for: **{{SOURCE_NAME}}**
URL: {{SOURCE_URL}}

## Your Goal
Write a Stagehand-compatible scraper that extracts summer camp session data from this website.

## Required Output
Write the scraper code to this file: `{{OUTPUT_FILE}}`

The scraper should export a function that:
1. Takes a Stagehand page instance
2. Extracts all camp sessions with these fields:
   - name (string, required)
   - description (string, optional)
   - startDate (YYYY-MM-DD format)
   - endDate (YYYY-MM-DD format)
   - dropOffHour/dropOffMinute (24-hour format)
   - pickUpHour/pickUpMinute (24-hour format)
   - location (address or location name)
   - minAge/maxAge or minGrade/maxGrade
   - priceInCents (price * 100)
   - registrationUrl
   - isAvailable (boolean)
3. Returns an array of session objects

## Steps
1. First, use WebFetch to explore the target URL and understand the page structure
2. **CRITICAL: Discover the site's navigation structure** (see below)
3. Identify where camp information is displayed
4. Look for JavaScript-rendered content, week pickers, calendars, or date selectors
5. Check if there are multiple weeks/sessions that need to be extracted individually
6. Write the extraction code
7. Save the code to the output file

## CRITICAL: Site Navigation Discovery

**Many camp sites organize camps by LOCATION, CATEGORY, or AGE GROUP.** You MUST discover and iterate through ALL entry points to find all camps.

### Common Patterns to Look For:

1. **Location-based organization** (Parks & Rec, Community Centers)
   - Look for lists of: "Community Centers", "Park Locations", "Facilities", "Sites"
   - Example: Portland Parks lists camps at each community center separately
   - Each location may have a different `site_id` or URL parameter
   - **You MUST scrape each location separately**

2. **Category-based organization**
   - Camp types: Day Camps, Specialty Camps, Sports Camps, Arts Camps
   - Age groups: Preschool, Elementary, Middle School, Teen
   - Check for category filters or separate pages per category

3. **External registration systems**
   - Many orgs link to: ActiveCommunities, CampBrain, UltraCamp, RegFox
   - The main website may just have links - follow them to the actual registration system
   - Look for URL parameters like: `site_ids=`, `category_ids=`, `location_id=`

### Discovery Process:

1. **Read the main page carefully** - look for:
   - "View camps at:" followed by location links
   - "Camp Locations:" with a list of places
   - "Find camps by:" with category options
   - Navigation menus with multiple camp sections

2. **Extract ALL entry point URLs** before writing any scraper
   - If you see 10 locations listed, you need 10 different URLs
   - Note the URL pattern and varying parameters (e.g., `site_ids=43`, `site_ids=44`)

3. **Your scraper MUST iterate through all entry points**
   - Create an array of location/category objects with their IDs
   - Loop through and scrape each one
   - Combine results and deduplicate

### Example Pattern for Location-Based Sites:

```typescript
const LOCATIONS = [
  { name: "Downtown Center", siteId: 15 },
  { name: "East Side Center", siteId: 23 },
  { name: "West Park Center", siteId: 44 },
  // ... discover ALL locations from the main page
];

export async function scrape(page: Page): Promise<ExtractedSession[]> {
  const allSessions: ExtractedSession[] = [];

  for (const location of LOCATIONS) {
    const url = `https://registration.example.com/search?site_ids=${location.siteId}&category=camps`;
    await page.goto(url, { waitUntil: 'networkidle' });
    // ... extract camps from this location
    // ... add to allSessions with location.name
  }

  return allSessions;
}
```

### Red Flags That You're Missing Camps:

- Finding only 0-5 camps when the site advertises "dozens of options"
- Only seeing camps at one location when the site lists multiple facilities
- The main page shows categories but you're not filtering by them
- Registration system has URL parameters you're not varying

{{#NOTES}}
## Additional Notes from Requester
{{NOTES}}
{{/NOTES}}

{{SITE_GUIDANCE}}

{{#FEEDBACK}}
## Previous Version Feedback
The previous scraper (version {{FEEDBACK_VERSION}}) received this feedback:

{{FEEDBACK_TEXT}}

Please improve the scraper based on this feedback.
{{/FEEDBACK}}

{{#PREVIOUS_CODE}}
## Previous Scraper Code
Here's the previous version of the scraper to improve upon:

```typescript
{{PREVIOUS_CODE}}
```
{{/PREVIOUS_CODE}}

## Scraper Template
Use this structure for your scraper:

```typescript
import { Page } from "@anthropic-ai/stagehand";

export interface ExtractedSession {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  dateRaw?: string;
  dropOffHour?: number;
  dropOffMinute?: number;
  pickUpHour?: number;
  pickUpMinute?: number;
  timeRaw?: string;
  location?: string;
  minAge?: number;
  maxAge?: number;
  minGrade?: number;
  maxGrade?: number;
  ageGradeRaw?: string;
  priceInCents?: number;
  priceRaw?: string;
  registrationUrl?: string;
  isAvailable?: boolean;
  isFlexible?: boolean;  // True for drop-in camps with generated weekly sessions
  flexibleDateRange?: string;  // Original date range like "June 15 - August 21"
  imageUrls?: string[];
}

export async function scrape(page: Page): Promise<ExtractedSession[]> {
  const sessions: ExtractedSession[] = [];

  // Your extraction logic here
  // Use page.evaluate() for DOM queries
  // Use Stagehand's AI extraction for complex cases

  return sessions;
}
```

## Handling "All Summer" / Drop-In Camps

Some camps (like Steve & Kate's) are **flexible drop-in camps** that run all summer without explicit weekly sessions. For these camps:

1. **Detect the pattern**: Look for phrases like "drop-in", "flexible scheduling", "attend any day", "all summer long", or a single date range spanning June-August.

2. **Generate weekly sessions**: If the camp runs continuously (e.g., June 15 - August 21), you MUST generate **individual weekly sessions** for each Monday-Friday week. Example:
   - Week 1: June 16-20, 2025
   - Week 2: June 23-27, 2025
   - Week 3: June 30 - July 4, 2025 (note: July 4 may be closed)
   - ... continue through August

3. **Use a helper function** like this in your scraper:
```typescript
function generateWeeklySessions(
  baseName: string,
  summerStart: string,  // "2025-06-16"
  summerEnd: string,    // "2025-08-22"
  baseSession: Partial<ExtractedSession>
): ExtractedSession[] {
  const sessions: ExtractedSession[] = [];
  let current = new Date(summerStart);
  const end = new Date(summerEnd);
  let weekNum = 1;

  while (current < end) {
    // Find Monday of this week
    const monday = new Date(current);
    const friday = new Date(current);
    friday.setDate(friday.getDate() + 4);

    if (friday <= end) {
      sessions.push({
        ...baseSession,
        name: `${baseName} - Week ${weekNum}`,
        startDate: monday.toISOString().split('T')[0],
        endDate: friday.toISOString().split('T')[0],
        isFlexible: true,  // Mark as drop-in/flexible
      } as ExtractedSession);
    }

    // Move to next Monday
    current.setDate(current.getDate() + 7);
    weekNum++;
  }

  return sessions;
}
```

4. **Extract the summer date range** from the page - look for "Summer 2025: June 16 - August 22" or similar.

5. **Set `isFlexible: true`** on generated sessions so we know they're drop-in style.

## Important
- **CHECK THE TIME** - you must finish within 9 minutes
- Handle pagination if the site has multiple pages
- Extract ALL sessions, not just the first few
- If there's a week picker or calendar, iterate through ALL weeks
- **For drop-in camps**: Generate weekly sessions from the summer date range
- Include raw text fields (dateRaw, timeRaw, etc.) for debugging
- Make the scraper robust to minor HTML changes
- Add comments explaining your extraction logic

## CRITICAL: Test Your Scraper Before Finishing

After writing the scraper to `{{OUTPUT_FILE}}`, you MUST test it using this command:

```bash
npx tsx scripts/test-scraper.ts {{OUTPUT_FILE}} "{{SOURCE_URL}}"
```

This will:
1. Run your scraper against the actual website
2. Show you how many sessions were found
3. Show sample session data or error messages

**If the test fails:**
1. Read the error message carefully
2. Fix the scraper code based on the actual error
3. Save the updated code to `{{OUTPUT_FILE}}`
4. Run the test again
5. Repeat until the test passes or you run out of time

**Common test failures and fixes:**
- `0 sessions found` → Your selectors aren't matching anything. Use page.evaluate() to debug what's on the page.
- `page.extract is not a function` → Use `stagehand.extract()` not `page.extract()` - stagehand and z (zod) are available in scope.
- `Timeout` → The page is slow to load. Add longer waits or use 'networkidle'.
- `Cannot read property` → Check for null/undefined values in your extraction logic.
- API rate limits (429) → Add delays between requests with `await page.waitForTimeout(2000)`.

## Time Management
1. Minutes 0-2: Explore the page structure with WebFetch
2. Minutes 2-5: Write the initial scraper code
3. Minutes 5-8: **TEST the scraper and fix errors** (this is the most important step!)
4. Minute 9: STOP - save whatever you have to {{OUTPUT_FILE}}

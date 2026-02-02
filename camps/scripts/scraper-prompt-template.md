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
2. Identify where camp information is displayed
3. Look for JavaScript-rendered content, week pickers, calendars, or date selectors
4. Check if there are multiple weeks/sessions that need to be extracted individually
5. Write the extraction code
6. Save the code to the output file

{{#NOTES}}
## Additional Notes from Requester
{{NOTES}}
{{/NOTES}}

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

## Time Management
1. Minutes 0-2: Explore the page structure with WebFetch
2. Minutes 2-6: Write the scraper code
3. Minutes 6-8: Test and refine
4. Minute 9: STOP - save whatever you have to {{OUTPUT_FILE}}

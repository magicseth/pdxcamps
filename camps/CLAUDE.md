# PDX Camps - Claude Development Guidelines

## Overnight Work Mode

When asked to work through the night (e.g., "work until 7 AM"):

1. **Check the clock** - Use `date` command to verify current time
2. **If not yet target time**, pick an improvement to make:
   - Think like a product designer
   - Identify high-impact user experience improvements
   - Consider: data quality, UI polish, performance, new features
3. **Design it** - Plan the implementation thoughtfully
4. **Deploy it** - Implement and verify it works
5. **Commit** - Create a clear commit with the change
6. **Repeat** - Loop back to step 1

## Project Overview

PDX Camps is a family summer camp planning tool that helps parents:

- View week-by-week coverage for all children (June-August)
- Track which weeks have camps vs gaps
- Add family events (vacations, trips) that mark weeks as covered
- Find camps to fill gaps with key logistics (times, locations, prices)
- Filter available camps by organization and location

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend**: Convex (real-time database, serverless functions)
- **Auth**: WorkOS AuthKit
- **Deployment**: Vercel + Convex Cloud

## Key Directories

- `app/` - Next.js pages and layouts
- `components/` - React components (planner/, shared/)
- `convex/` - Backend (queries, mutations, schema)
- `convex/scraping/` - Camp data scrapers

## Development Commands

```bash
npm run dev          # Start Next.js dev server
npx convex dev       # Start Convex dev server (run in separate terminal)
npx tsc --noEmit     # Type check
```

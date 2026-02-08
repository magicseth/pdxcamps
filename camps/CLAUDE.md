# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

PDX Camps is a multi-market summer camp planning tool that helps families find and organize camps for their children across multiple cities (Portland, Seattle, Dallas, etc.). Each market gets its own domain (pdxcamps.com, seacamps.com, etc.).

Core user flow: View week-by-week coverage for children (June-August) → identify gap weeks → discover camps to fill gaps → save/register for sessions → share plans with friends.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 19, Tailwind CSS v4
- **Backend**: Convex (real-time database, serverless functions)
- **Auth**: WorkOS AuthKit
- **Deployment**: Netlify (frontend) + Convex Cloud (backend)
- **Analytics**: PostHog
- **Payments**: Stripe (via @convex-dev/stripe)
- **Scraping**: Stagehand (browser automation) + Cheerio (HTML parsing) + Claude API

## Development Commands

```bash
npm run dev              # Start both Next.js + Convex dev servers (parallel)
npm run dev:frontend     # Start only Next.js
npm run dev:backend      # Start only Convex dev
npx tsc --noEmit         # Type check
npm run lint             # ESLint
npm test                 # Run all tests (vitest)
npm run test:watch       # Run tests in watch mode
npx vitest run tests/lib/dateUtils.test.ts  # Run a single test file
```

## Deployment

- `CONVEX_DEPLOYMENT` env var locally points to dev (`brazen-vulture-927`), but `npx convex deploy` targets prod (`deafening-schnauzer-923`)
- WorkOS env vars on the dev deployment conflict with prod build — deploy will fail with `WorkOS environment variable mismatch`
- **Deploy fix**: `mv .env.local .env.local.bak && unset CONVEX_DEPLOYMENT && npx convex deploy --yes --typecheck=disable; mv .env.local.bak .env.local`
- Run Convex actions against prod: `npx convex run --prod <path>:<function> '<json args>'`

## Architecture

### Frontend (`app/`, `components/`, `lib/`)

Key routes:
- `/planner` — Core weekly grid showing all children's coverage
- `/discover/[citySlug]` — Camp browsing with filters and map
- `/session/[sessionId]` — Individual session details
- `/admin/*` — Admin dashboard, scraper management, market expansion
- `/onboarding` — Multi-step family + children setup

Shared frontend code lives in `lib/`:
- `constants.ts` — Colors, categories, grade labels, paywall limits
- `types.ts` — TypeScript types (CoverageStatus, WeekData, etc.)
- `dateUtils.ts` — Date manipulation utilities
- `markets.ts`, `expansionMarkets.ts` — Market tier definitions

### Backend (`convex/`)

Organized by domain into subdirectories, each with `queries.ts`, `mutations.ts`, and optionally `actions.ts`:
- `camps/`, `sessions/`, `organizations/`, `locations/` — Core camp data
- `planner/` — Week coverage calculations with pre-computed aggregates
- `children/`, `families/` — User family management
- `registrations/`, `customCamps/` — Session tracking (interested/registered/waitlisted)
- `discovery/` — Camp browsing queries with filtering
- `social/` — Friendships, calendar sharing
- `notifications/` — Availability alerts
- `admin/` — Admin queries, mutations, migrations
- `expansion/` — Multi-market rollout (domain purchase, DNS, WorkOS setup)
- `scraping/` — Camp data ingestion pipeline (42 files, see below)

### Backend Shared Code (`convex/lib/`)

Single source of truth for backend utilities — **backend cannot import from frontend `lib/`**:
- `validators.ts` — Reusable Convex validators (ageRange, time, address, status unions)
- `helpers.ts` — `resolveCampName()`, `updateSessionCapacityStatus()`, grade/age calculations
- `auth.ts` — `getFamily()`, `requireAuth()`, `requireFamily()`
- `adminAuth.ts` — `checkIsAdmin()` (verifies by email)
- `paywall.ts` — `FREE_SAVED_CAMPS_LIMIT=5`, `enforceSavedCampLimit()`, Stripe integration
- `constants.ts` — Backend-specific constants (separate from frontend constants)
- `sessionAggregate.ts` — Pre-computed session counts for fast planner loading

### Scraping Pipeline (`convex/scraping/`)

Multi-stage pipeline: Discovery → Source Config → Execution → Validation → Import → Change Detection

1. **Discovery**: Web search for camp orgs in new markets (`marketDiscovery.ts`, `urlDiscovery.ts`)
2. **Sources**: Each website gets a `scrapeSources` record with scraper code (`sources.ts`)
3. **Execution**: Stagehand browser automation or Cheerio HTML parsing (`actions.ts`, `jobs.ts`)
4. **Validation**: Parse dates/times/prices/ages, validate completeness (`validation.ts`)
5. **Import**: Validated sessions → `sessions` table, incomplete → `pendingSessions` for review
6. **Change detection**: Track price/availability deltas, trigger notifications (`deduplication.ts`)

Scraper code is AI-generated TypeScript stored in the `scrapeSources` table and executed at runtime.

### Convex Workflows & Packages

**`@convex-dev/workflow`** — Used for the scraping pipeline (`convex/scraping/scrapeWorkflow.ts`):
- `WorkflowManager` wraps `components.workflow` with `maxParallelism: 10`
- Workflows are defined with `workflow.define({ args, returns, handler })` where `handler` uses `step.runMutation()` and `step.runAction()` for durable, retryable execution
- Workflow start is decoupled from job creation: `createScrapeJob` (mutation) creates the job and schedules `startWorkflowForJob` via `ctx.scheduler.runAfter(jitterMs)` in a separate transaction to avoid write conflicts on the workflow's `runStatus` table
- The workflow handles the full lifecycle: `markJobStarted` → `executeScraperForJob` → `markJobCompleted`/`markJobFailed`, including health metrics, next-scrape scheduling, and planner aggregate recomputation
- The cron scheduler (`runScheduledScrapes`) only creates jobs — it does NOT execute scrapes directly

**`@convex-dev/rate-limiter`** — Rate limiting for scraper execution

**`ctx.scheduler.runAfter`** — Used to decouple operations into separate transactions:
- Job creation → workflow start (avoids write conflicts)
- Job completion → planner aggregate recompute (avoids blocking the completion mutation)

### Database Schema (`convex/schema.ts`)

~40 tables. Key relationships:
- `cities` → `organizations` (via `cityIds[]`) → `camps` → `sessions`
- `sessions` are the core unit — denormalized with camp/org/location names for query performance
- `families` → `children` → `registrations` (linking children to sessions)
- `weeklyAvailability` — Pre-computed aggregate table for instant planner loading
- `scrapeSources` → `scrapeJobs` → session import pipeline

### Key Architectural Patterns

- **Denormalization**: Sessions cache camp/org/location names to avoid N+1 queries
- **Pre-computed aggregates**: `weeklyAvailability` table updated on session changes for fast planner
- **Paywall**: `FREE_SAVED_CAMPS_LIMIT=5` enforced in both frontend (UI gating) and backend (mutation guard)
- **Multi-tenant markets**: Each city gets its own domain, WorkOS org, Resend domain, and DNS config
- **Share tokens**: Token-based read-only sharing for family plans and individual children

## Convex-Specific Constraints

- `"use node"` files can ONLY export actions (not queries/mutations) — deploy will fail
- Moving Convex functions changes API paths — must update ALL call sites
- Run `npx convex codegen` after moving files, then `npx tsc --noEmit`
- Backend code cannot import from frontend `lib/` — use `convex/lib/` for shared backend utilities

## Testing

Tests use Vitest + React Testing Library. Located in `tests/` with subdirectories mirroring source:
- `tests/convex/` — Backend logic (helpers, deduplication, validation)
- `tests/lib/` — Frontend utilities (dateUtils, constants)
- `tests/hooks/` — React hooks

**Date test gotcha**: Use `new Date(year, month, day, hour)` not `new Date('YYYY-MM-DD')` to avoid UTC/local timezone mismatch.

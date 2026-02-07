#!/usr/bin/env npx tsx
/**
 * Test Stagehand Agent-based extraction on a camp website
 *
 * Usage:
 *   npx tsx scripts/test-agent-extraction.ts <url> [--max-steps=50] [--verbose]
 *
 * Examples:
 *   npx tsx scripts/test-agent-extraction.ts "https://www.portlandparks.org/camps"
 *   npx tsx scripts/test-agent-extraction.ts "https://omsi.edu/camps" --max-steps=100 --verbose
 */

import { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Schema for extracted sessions
const SessionSchema = z.object({
  name: z.string().describe('Name of the camp or program'),
  description: z.string().optional().describe('Description of what the camp involves'),
  startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
  dateRaw: z.string().optional().describe('Raw date text if unable to parse into YYYY-MM-DD'),
  dropOffTime: z.string().optional().describe('Drop-off time in HH:MM 24-hour format'),
  pickUpTime: z.string().optional().describe('Pick-up time in HH:MM 24-hour format'),
  timeRaw: z.string().optional().describe('Raw time text if unable to parse'),
  location: z.string().optional().describe('Location name or address'),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
    })
    .optional()
    .describe('Structured address if available'),
  minAge: z.number().optional().describe('Minimum age in years'),
  maxAge: z.number().optional().describe('Maximum age in years'),
  minGrade: z.number().optional().describe('Minimum grade (-1 for Pre-K, 0 for K, 1-12 for grades)'),
  maxGrade: z.number().optional().describe('Maximum grade'),
  ageGradeRaw: z.string().optional().describe('Raw age/grade text if unable to parse'),
  priceInCents: z.number().optional().describe('Price in cents (e.g., $350 = 35000)'),
  priceRaw: z.string().optional().describe('Raw price text'),
  registrationUrl: z.string().optional().describe('Direct URL to register for this specific session'),
  category: z.string().optional().describe("Category like 'Sports', 'Arts', 'STEM', etc."),
  spotsLeft: z.number().optional().describe('Number of spots remaining if shown'),
  isSoldOut: z.boolean().optional().describe('Whether the session is sold out'),
});

const ExtractionResultSchema = z.object({
  sessions: z.array(SessionSchema).describe('All camp sessions found on the website'),
  pagesVisited: z.number().optional().describe('Approximate number of pages navigated'),
  notes: z.string().optional().describe('Any issues encountered or notes about the extraction'),
});

type Session = z.infer<typeof SessionSchema>;
type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// Parse command line arguments
const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith('--'));
const maxSteps = parseInt(args.find((arg) => arg.startsWith('--max-steps='))?.split('=')[1] || '50');
const verbose = args.includes('--verbose');

if (!url) {
  console.error(`
Usage: npx tsx scripts/test-agent-extraction.ts <url> [options]

Options:
  --max-steps=N   Maximum agent steps (default: 50)
  --verbose       Show detailed agent progress

Examples:
  npx tsx scripts/test-agent-extraction.ts "https://www.example.com/camps"
  npx tsx scripts/test-agent-extraction.ts "https://omsi.edu/camps" --max-steps=100
`);
  process.exit(1);
}

function log(msg: string) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function formatSession(session: Session, index: number): string {
  const lines: string[] = [];
  lines.push(`\n${'='.repeat(60)}`);
  lines.push(`SESSION #${index + 1}: ${session.name}`);
  lines.push('='.repeat(60));

  if (session.description) {
    lines.push(`Description: ${session.description.substring(0, 150)}${session.description.length > 150 ? '...' : ''}`);
  }

  // Dates
  if (session.startDate && session.endDate) {
    lines.push(`Dates: ${session.startDate} to ${session.endDate}`);
  } else if (session.dateRaw) {
    lines.push(`Dates (raw): ${session.dateRaw}`);
  }

  // Times
  if (session.dropOffTime && session.pickUpTime) {
    lines.push(`Times: ${session.dropOffTime} - ${session.pickUpTime}`);
  } else if (session.timeRaw) {
    lines.push(`Times (raw): ${session.timeRaw}`);
  }

  // Location
  if (session.location) {
    lines.push(`Location: ${session.location}`);
  }
  if (session.address && (session.address.street || session.address.city)) {
    const addr = session.address;
    lines.push(`Address: ${[addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')}`);
  }

  // Age/Grade
  if (session.minAge !== undefined || session.maxAge !== undefined) {
    lines.push(`Ages: ${session.minAge ?? '?'} - ${session.maxAge ?? '?'}`);
  } else if (session.minGrade !== undefined || session.maxGrade !== undefined) {
    const gradeLabel = (g: number) => (g === -1 ? 'Pre-K' : g === 0 ? 'K' : `${g}`);
    lines.push(
      `Grades: ${session.minGrade !== undefined ? gradeLabel(session.minGrade) : '?'} - ${session.maxGrade !== undefined ? gradeLabel(session.maxGrade) : '?'}`,
    );
  } else if (session.ageGradeRaw) {
    lines.push(`Age/Grade (raw): ${session.ageGradeRaw}`);
  }

  // Price
  if (session.priceInCents !== undefined) {
    lines.push(`Price: $${(session.priceInCents / 100).toFixed(2)}`);
  } else if (session.priceRaw) {
    lines.push(`Price (raw): ${session.priceRaw}`);
  }

  // Registration
  if (session.registrationUrl) {
    lines.push(`Register: ${session.registrationUrl}`);
  }

  // Category
  if (session.category) {
    lines.push(`Category: ${session.category}`);
  }

  // Availability
  if (session.isSoldOut) {
    lines.push(`Status: SOLD OUT`);
  } else if (session.spotsLeft !== undefined) {
    lines.push(`Spots Left: ${session.spotsLeft}`);
  }

  return lines.join('\n');
}

function calculateCompleteness(session: Session): { score: number; missing: string[] } {
  const fields = [
    { name: 'dates', present: !!(session.startDate && session.endDate) || !!session.dateRaw },
    { name: 'times', present: !!(session.dropOffTime && session.pickUpTime) || !!session.timeRaw },
    { name: 'location', present: !!session.location || !!session.address?.street },
    {
      name: 'age/grade',
      present: session.minAge !== undefined || session.minGrade !== undefined || !!session.ageGradeRaw,
    },
    { name: 'price', present: session.priceInCents !== undefined || !!session.priceRaw },
    { name: 'registration', present: !!session.registrationUrl },
  ];

  const present = fields.filter((f) => f.present).length;
  const missing = fields.filter((f) => !f.present).map((f) => f.name);

  return {
    score: Math.round((present / fields.length) * 100),
    missing,
  };
}

async function runAgentExtraction(targetUrl: string): Promise<ExtractionResult | null> {
  log(`Initializing Stagehand with Browserbase...`);

  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    model: {
      modelName: 'anthropic/claude-sonnet-4-20250514',
      apiKey: process.env.MODEL_API_KEY,
    },
    disablePino: true,
    verbose: verbose ? 1 : 0,
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeoutMs: 30000 });
    await page.waitForTimeout(3000);

    log(`Starting agent extraction (max ${maxSteps} steps)...`);
    log(`This may take a few minutes as the agent explores the site.\n`);

    const startTime = Date.now();

    // Create agent instance
    const agent = stagehand.agent({
      systemPrompt: `You are a meticulous data extraction agent specializing in summer camp websites.
Your goal is to find EVERY camp session available on the site.
Be thorough - navigate through all categories, locations, pagination.
Never skip sessions. If you see "View More", "Load More", "Next Page" - click them.`,
      stream: false,
    });

    // Execute the agent
    const agentResult = await agent.execute({
      instruction: `
Find ALL summer camp sessions on this website.

## Navigation Strategy
1. First, understand how the site organizes camps (by category, location, age, date, etc.)
2. Navigate through ALL categories, locations, or filters to find every camp
3. If there's pagination, go through ALL pages
4. Click into individual camp pages if details aren't shown in the list view
5. Look for "Summer Camps", "Programs", "Activities", "Classes" sections

## For EACH camp session, note:
- Name of the camp/program
- Description (brief summary)
- Dates (start and end)
- Times (drop-off and pick-up)
- Location name and/or address
- Age range or grade range
- Price
- Registration URL
- Category (Sports, Arts, STEM, Nature, etc.)
- Availability (spots left, sold out status)

Be thorough - capture data from every session you find.
      `,
      maxSteps: maxSteps,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`\nAgent completed in ${elapsed}s`);

    if (verbose && agentResult.actions) {
      log(`Agent took ${agentResult.actions.length} actions`);
    }

    if (verbose) {
      log(`Agent result: ${agentResult.message || 'No message'}`);
    }

    // Now do a final extraction to get structured data from the current page
    log(`Extracting structured session data...`);

    const extractionInstruction = `
Extract ALL summer camp sessions visible on this page. For each session, capture:
- name, description, category
- dates (startDate, endDate in YYYY-MM-DD, or dateRaw if unparseable)
- times (dropOffTime, pickUpTime in HH:MM 24hr, or timeRaw)
- location and address details
- age/grade requirements (minAge, maxAge, minGrade, maxGrade, or ageGradeRaw)
- price (priceInCents = dollars * 100, or priceRaw)
- registrationUrl, spotsLeft, isSoldOut

Return every session you can see.
    `;

    const extraction = await stagehand.extract(extractionInstruction, ExtractionResultSchema);

    return extraction as ExtractionResult;
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    await stagehand.close();
  }
}

async function main() {
  if (!url) {
    console.error('URL is required');
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          STAGEHAND AGENT EXTRACTION TEST                     ║
╠══════════════════════════════════════════════════════════════╣
║  URL: ${url.substring(0, 52).padEnd(52)} ║
║  Max Steps: ${String(maxSteps).padEnd(46)} ║
╚══════════════════════════════════════════════════════════════╝
`);

  const result = await runAgentExtraction(url);

  if (!result || !result.sessions || result.sessions.length === 0) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  NO SESSIONS FOUND                                           ║
╠══════════════════════════════════════════════════════════════╣
║  The agent couldn't find any camp sessions on this site.     ║
║  Try:                                                        ║
║    - Increasing --max-steps for complex sites                ║
║    - Using --verbose to see what the agent is doing          ║
║    - Checking if the URL is correct                          ║
╚══════════════════════════════════════════════════════════════╝
`);
    if (result?.notes) {
      console.log(`Agent notes: ${result.notes}`);
    }
    process.exit(1);
  }

  // Display results
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  EXTRACTION RESULTS                                          ║
╠══════════════════════════════════════════════════════════════╣
║  Sessions Found: ${String(result.sessions.length).padEnd(42)} ║
${result.pagesVisited ? `║  Pages Visited: ${String(result.pagesVisited).padEnd(43)} ║` : ''}
╚══════════════════════════════════════════════════════════════╝
`);

  // Calculate quality stats
  let totalCompleteness = 0;
  const missingFieldCounts: Record<string, number> = {};

  for (const session of result.sessions) {
    const { score, missing } = calculateCompleteness(session);
    totalCompleteness += score;
    for (const field of missing) {
      missingFieldCounts[field] = (missingFieldCounts[field] || 0) + 1;
    }
  }

  const avgCompleteness = Math.round(totalCompleteness / result.sessions.length);

  console.log(`DATA QUALITY SUMMARY`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`Average Completeness: ${avgCompleteness}%`);
  console.log(`\nMost Common Missing Fields:`);
  Object.entries(missingFieldCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([field, count]) => {
      const pct = Math.round((count / result.sessions.length) * 100);
      console.log(`  - ${field}: missing in ${count}/${result.sessions.length} sessions (${pct}%)`);
    });

  // Show each session
  console.log(`\n\nINDIVIDUAL SESSIONS`);
  console.log(`${'─'.repeat(60)}`);

  for (let i = 0; i < result.sessions.length; i++) {
    const session = result.sessions[i];
    const { score, missing } = calculateCompleteness(session);
    console.log(formatSession(session, i));
    console.log(`\nCompleteness: ${score}%${missing.length > 0 ? ` (missing: ${missing.join(', ')})` : ''}`);
  }

  // Notes from agent
  if (result.notes) {
    console.log(`\n\nAGENT NOTES`);
    console.log(`${'─'.repeat(60)}`);
    console.log(result.notes);
  }

  // JSON output for further processing
  console.log(`\n\nRAW JSON OUTPUT`);
  console.log(`${'─'.repeat(60)}`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);

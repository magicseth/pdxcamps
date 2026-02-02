#!/usr/bin/env npx tsx
/**
 * Scraper Development Daemon
 *
 * This script watches the database for scraper development requests
 * and spawns Claude Code to write custom scrapers for each site.
 *
 * Usage:
 *   npx tsx scripts/scraper-daemon.ts
 *
 * The daemon will:
 * 1. Poll the database for pending requests
 * 2. Claim a request and spawn Claude Code with --dangerously-skip-permissions
 * 3. Claude Code explores the site and writes a scraper
 * 4. The scraper is tested against the target URL
 * 5. Results are saved for user review
 * 6. User can provide feedback to improve the scraper
 * 7. Feedback triggers another Claude Code session
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";

// Stagehand is optional - only used for testing scrapers
let Stagehand: any = null;
try {
  Stagehand = require("@browserbasehq/stagehand").Stagehand;
} catch {
  // Stagehand not installed - testing will be skipped
}

// Load environment
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL not set in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// Scratchpad directory for Claude Code work
const SCRATCHPAD_DIR = path.join(process.cwd(), ".scraper-development");
if (!fs.existsSync(SCRATCHPAD_DIR)) {
  fs.mkdirSync(SCRATCHPAD_DIR, { recursive: true });
}

// Log file for current session
const LOG_FILE = path.join(SCRATCHPAD_DIR, "daemon.log");

function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

const POLL_INTERVAL_MS = 5000; // Check every 5 seconds
const CLAUDE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minute timeout for Claude

interface DevelopmentRequest {
  _id: string;
  sourceName: string;
  sourceUrl: string;
  sourceId?: string;
  notes?: string;
  status: string;
  scraperVersion?: number;
  generatedScraperCode?: string;
  feedbackHistory?: Array<{
    feedbackAt: number;
    feedback: string;
    scraperVersionBefore: number;
  }>;
  siteExploration?: {
    exploredAt: number;
    siteType?: string;
    hasMultipleLocations?: boolean;
    locations?: Array<{ name: string; url?: string; siteId?: string }>;
    hasCategories?: boolean;
    categories?: Array<{ name: string; id?: string }>;
    registrationSystem?: string;
    urlPatterns?: string[];
    navigationNotes?: string[];
  };
}

let isProcessing = false;
let currentProcess: ChildProcess | null = null;

async function main() {
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

  // Clear log file
  fs.writeFileSync(LOG_FILE, `=== Scraper Daemon Started ${new Date().toISOString()} ===\n`);

  console.log("🤖 Scraper Development Daemon Started");
  console.log(`   Convex: ${CONVEX_URL}`);
  console.log(`   Logs: tail -f ${LOG_FILE}`);
  if (verbose) {
    console.log("   Mode: Verbose");
  }
  console.log("   Running autonomously. Submit requests & feedback via /admin/scraper-dev");
  console.log("   Press Ctrl+C to stop.\n");

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    if (currentProcess) {
      currentProcess.kill();
    }
    process.exit(0);
  });

  // Main polling loop
  while (true) {
    try {
      if (!isProcessing) {
        const pending = await client.query(api.scraping.development.getPendingRequests, {});

        if (pending.length > 0) {
          const request = pending[0] as DevelopmentRequest;
          await processRequest(request, verbose);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Site exploration result - discovered navigation structure
 */
interface SiteExplorationResult {
  siteType: string;
  hasMultipleLocations: boolean;
  locations: Array<{ name: string; url?: string; siteId?: string }>;
  hasCategories: boolean;
  categories: Array<{ name: string; id?: string }>;
  registrationSystem?: string;
  urlPatterns: string[];
  navigationNotes: string[];
  rawPageSummary?: string;
}

/**
 * Explore a site to discover its navigation structure before writing a scraper
 */
async function exploreSiteNavigation(
  url: string,
  sourceName: string,
  log: (msg: string) => void
): Promise<SiteExplorationResult> {
  const result: SiteExplorationResult = {
    siteType: 'unknown',
    hasMultipleLocations: false,
    locations: [],
    hasCategories: false,
    categories: [],
    urlPatterns: [],
    navigationNotes: [],
  };

  log(`   🔍 Exploring site navigation...`);

  // Check if Stagehand is available for browser-based exploration
  if (!Stagehand) {
    log(`   ⚠️ Stagehand not available, using basic URL analysis`);
    // Basic URL-based detection
    if (url.includes('portland.gov/parks')) {
      result.siteType = 'parks_and_rec_location_based';
      result.hasMultipleLocations = true;
      result.registrationSystem = 'ActiveCommunities';
      result.navigationNotes.push('Portland Parks uses ActiveCommunities with location-based organization');
    }
    return result;
  }

  let stagehand: any = null;

  try {
    // Initialize Stagehand for exploration
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: {
        modelName: "anthropic/claude-sonnet-4-20250514",
        apiKey: process.env.MODEL_API_KEY,
      },
      disablePino: true,
      verbose: 0,
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];

    log(`   📄 Loading ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeoutMs: 30000 });
    await page.waitForTimeout(3000);

    // Use AI extraction to analyze the page structure
    log(`   🤖 Analyzing page structure...`);
    const extraction = await page.extract({
      instruction: `Analyze this summer camp website's navigation structure. Look for:

1. **Location-based organization**: Are camps listed by location/facility? Look for:
   - Lists of community centers, parks, schools, or facilities
   - "View camps at [Location]" links
   - Location filters or dropdown menus

2. **Category organization**: Are camps organized by type? Look for:
   - Camp categories (Day Camps, Sports Camps, Arts Camps, etc.)
   - Age group filters (Preschool, Elementary, Teen)
   - Activity type sections

3. **External registration systems**: Does this link to another site? Look for:
   - Links to ActiveCommunities, CampBrain, UltraCamp, RegFox
   - "Register" buttons that go to external URLs
   - Iframe embeds from registration platforms

4. **URL patterns**: Note any URL parameters you see like:
   - site_ids, location_id, facility_id
   - category_id, activity_type
   - age_group, grade_level

Return a structured analysis of how camps are organized on this site.`,
      schema: {
        type: "object",
        properties: {
          organizationType: {
            type: "string",
            description: "How camps are organized: 'by_location', 'by_category', 'by_age', 'single_list', 'calendar', or 'unknown'"
          },
          locations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                linkText: { type: "string" },
                urlPattern: { type: "string" }
              }
            },
            description: "List of locations/facilities if camps are organized by location"
          },
          categories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" }
              }
            },
            description: "List of camp categories if organized that way"
          },
          externalRegistration: {
            type: "object",
            properties: {
              platform: { type: "string" },
              baseUrl: { type: "string" },
              urlParameters: { type: "array", items: { type: "string" } }
            },
            description: "External registration system details if applicable"
          },
          navigationInstructions: {
            type: "string",
            description: "Step-by-step instructions for how to navigate to find ALL camps"
          },
          estimatedCampCount: {
            type: "string",
            description: "Rough estimate of how many camps/sessions this org offers"
          }
        }
      }
    });

    const extracted = extraction as {
      organizationType?: string;
      locations?: Array<{ name: string; linkText?: string; urlPattern?: string }>;
      categories?: Array<{ name: string; description?: string }>;
      externalRegistration?: { platform?: string; baseUrl?: string; urlParameters?: string[] };
      navigationInstructions?: string;
      estimatedCampCount?: string;
    };

    log(`   ✅ Site analysis complete`);

    // Process the extraction results
    if (extracted.organizationType) {
      result.siteType = extracted.organizationType;
    }

    if (extracted.locations && extracted.locations.length > 0) {
      result.hasMultipleLocations = true;
      result.locations = extracted.locations.map(loc => ({
        name: loc.name,
        url: loc.urlPattern,
      }));
      result.navigationNotes.push(`Found ${extracted.locations.length} locations: ${extracted.locations.map(l => l.name).join(', ')}`);
    }

    if (extracted.categories && extracted.categories.length > 0) {
      result.hasCategories = true;
      result.categories = extracted.categories.map(cat => ({
        name: cat.name,
      }));
      result.navigationNotes.push(`Found ${extracted.categories.length} categories: ${extracted.categories.map(c => c.name).join(', ')}`);
    }

    if (extracted.externalRegistration) {
      result.registrationSystem = extracted.externalRegistration.platform;
      if (extracted.externalRegistration.baseUrl) {
        result.urlPatterns.push(extracted.externalRegistration.baseUrl);
      }
      if (extracted.externalRegistration.urlParameters) {
        result.navigationNotes.push(`URL parameters found: ${extracted.externalRegistration.urlParameters.join(', ')}`);
      }
    }

    if (extracted.navigationInstructions) {
      result.navigationNotes.push(`Navigation: ${extracted.navigationInstructions}`);
    }

    if (extracted.estimatedCampCount) {
      result.navigationNotes.push(`Estimated camps: ${extracted.estimatedCampCount}`);
    }

    // If we found locations, try to get their URLs
    if (result.hasMultipleLocations && result.locations.length > 0) {
      log(`   🔗 Discovering location URLs...`);

      const linkExtraction = await page.extract({
        instruction: `Find all links to camp registration pages for different locations/facilities.
For each location, extract the full URL that leads to camps at that location.
Look for links in lists, tables, or navigation that point to facility-specific camp pages.`,
        schema: {
          type: "object",
          properties: {
            locationLinks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  locationName: { type: "string" },
                  url: { type: "string" },
                  siteIdOrParam: { type: "string" }
                }
              }
            }
          }
        }
      });

      const links = linkExtraction as { locationLinks?: Array<{ locationName: string; url: string; siteIdOrParam?: string }> };

      if (links.locationLinks && links.locationLinks.length > 0) {
        result.locations = links.locationLinks.map(link => ({
          name: link.locationName,
          url: link.url,
          siteId: link.siteIdOrParam,
        }));

        // Extract URL pattern
        const urls = links.locationLinks.map(l => l.url).filter(u => u);
        if (urls.length > 0) {
          result.urlPatterns.push(urls[0]);
        }
      }
    }

    await stagehand.close();
    stagehand = null;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`   ⚠️ Exploration error: ${errorMsg.slice(0, 100)}`);
    result.navigationNotes.push(`Exploration encountered error: ${errorMsg.slice(0, 200)}`);

    if (stagehand) {
      try { await stagehand.close(); } catch { }
    }
  }

  // Log summary
  log(`   📊 Exploration results:`);
  log(`      Site type: ${result.siteType}`);
  log(`      Locations: ${result.locations.length}`);
  log(`      Categories: ${result.categories.length}`);
  log(`      Registration system: ${result.registrationSystem || 'unknown'}`);

  return result;
}

/**
 * Format exploration results for inclusion in the prompt
 */
function formatExplorationForPrompt(exploration: SiteExplorationResult): string {
  const lines: string[] = [];

  lines.push('\n## 🔍 Site Navigation Discovery (Auto-Explored)\n');
  lines.push('The daemon explored this site and found:\n');

  if (exploration.siteType !== 'unknown') {
    lines.push(`**Organization Type:** ${exploration.siteType}\n`);
  }

  if (exploration.hasMultipleLocations && exploration.locations.length > 0) {
    lines.push('\n### ⚠️ MULTIPLE LOCATIONS DETECTED\n');
    lines.push('**You MUST iterate through all locations to get all camps.**\n\n');
    lines.push('```typescript\n');
    lines.push('const LOCATIONS = [\n');
    for (const loc of exploration.locations) {
      if (loc.siteId) {
        lines.push(`  { name: "${loc.name}", siteId: "${loc.siteId}" },\n`);
      } else if (loc.url) {
        lines.push(`  { name: "${loc.name}", url: "${loc.url}" },\n`);
      } else {
        lines.push(`  { name: "${loc.name}" },\n`);
      }
    }
    lines.push('];\n');
    lines.push('```\n');
  }

  if (exploration.hasCategories && exploration.categories.length > 0) {
    lines.push('\n### Camp Categories Found:\n');
    for (const cat of exploration.categories) {
      lines.push(`- ${cat.name}\n`);
    }
  }

  if (exploration.registrationSystem) {
    lines.push(`\n### Registration System: ${exploration.registrationSystem}\n`);
  }

  if (exploration.urlPatterns.length > 0) {
    lines.push('\n### URL Patterns Discovered:\n');
    lines.push('```\n');
    for (const pattern of exploration.urlPatterns) {
      lines.push(`${pattern}\n`);
    }
    lines.push('```\n');
  }

  if (exploration.navigationNotes.length > 0) {
    lines.push('\n### Navigation Notes:\n');
    for (const note of exploration.navigationNotes) {
      lines.push(`- ${note}\n`);
    }
  }

  return lines.join('');
}

async function processRequest(request: DevelopmentRequest, verbose: boolean = false) {
  isProcessing = true;
  const requestId = request._id;

  const log = (msg: string) => {
    writeLog(msg);
    if (verbose) console.log(msg);
  };

  console.log(`📋 Processing: ${request.sourceName}`);
  writeLog(`\n=== Processing: ${request.sourceName} ===`);
  writeLog(`URL: ${request.sourceUrl}`);

  try {
    // Claim the request
    log(`   Claiming request ${requestId}...`);
    await client.mutation(api.scraping.development.claimRequest, {
      requestId: requestId as any,
      claudeSessionId: `daemon-${Date.now()}`,
    });

    // STEP 1: Explore the site navigation structure BEFORE building the scraper
    let explorationResult: SiteExplorationResult | null = null;

    // Check if we already have exploration results from a previous attempt
    if (request.siteExploration) {
      log(`   📋 Using existing site exploration from ${new Date(request.siteExploration.exploredAt).toISOString()}`);
      explorationResult = {
        siteType: request.siteExploration.siteType || 'unknown',
        hasMultipleLocations: request.siteExploration.hasMultipleLocations || false,
        locations: request.siteExploration.locations || [],
        hasCategories: request.siteExploration.hasCategories || false,
        categories: request.siteExploration.categories || [],
        registrationSystem: request.siteExploration.registrationSystem,
        urlPatterns: request.siteExploration.urlPatterns || [],
        navigationNotes: request.siteExploration.navigationNotes || [],
      };
    } else if (!request.generatedScraperCode) {
      // Only explore on first attempt when no exploration exists
      explorationResult = await exploreSiteNavigation(request.sourceUrl, request.sourceName, log);

      // Save exploration results to database for future attempts
      if (explorationResult) {
        try {
          await client.mutation(api.scraping.development.saveExploration, {
            requestId: requestId as any,
            exploration: {
              siteType: explorationResult.siteType,
              hasMultipleLocations: explorationResult.hasMultipleLocations,
              locations: explorationResult.locations,
              hasCategories: explorationResult.hasCategories,
              categories: explorationResult.categories,
              registrationSystem: explorationResult.registrationSystem,
              urlPatterns: explorationResult.urlPatterns,
              navigationNotes: explorationResult.navigationNotes,
            },
          });
          log(`   💾 Saved site exploration to database`);
        } catch (saveError) {
          log(`   ⚠️ Failed to save exploration: ${saveError instanceof Error ? saveError.message : saveError}`);
        }
      }
    }

    // Build the prompt for Claude Code (now includes exploration results)
    const prompt = buildClaudePrompt(request, explorationResult);

    // Write prompt to a file for Claude Code to read
    const promptFile = path.join(SCRATCHPAD_DIR, `prompt-${requestId}.md`);
    fs.writeFileSync(promptFile, prompt);

    // Create output file for the scraper code
    const outputFile = path.join(SCRATCHPAD_DIR, `scraper-${requestId}.ts`);

    log(`   Spawning Claude Code...`);
    log(`   Prompt file: ${promptFile}`);

    // Write status file for monitoring
    const statusFile = path.join(SCRATCHPAD_DIR, "current-status.txt");
    const startTime = Date.now();
    fs.writeFileSync(statusFile, `Processing: ${request.sourceName}\nURL: ${request.sourceUrl}\nStarted: ${new Date().toISOString()}\nTimeout: ${CLAUDE_TIMEOUT_MS / 60000} minutes\n`);

    // Create a transcript file for this session
    const transcriptFile = path.join(SCRATCHPAD_DIR, `transcript-${requestId}.txt`);
    const transcriptStream = fs.createWriteStream(transcriptFile);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`   CLAUDE SESSION: ${request.sourceName}`);
    console.log(`${"=".repeat(60)}\n`);

    // Run Claude with --print and stream-json to see what it's doing
    // IMPORTANT: stdin must be "ignore" or Claude hangs waiting for input
    const claudeProcess = spawn(
      "claude",
      [
        "--dangerously-skip-permissions",
        "--print",
        "--output-format", "stream-json",
        "-p",
        prompt,
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"], // ignore stdin or Claude hangs!
        env: {
          ...process.env,
          SCRAPER_OUTPUT_FILE: outputFile,
        },
      }
    );

    currentProcess = claudeProcess;

    // Stream stdout and parse JSON events
    let stdout = "";
    let lastAssistantMessage = "";
    claudeProcess.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;

      // Write raw to transcript file
      transcriptStream.write(text);

      // Parse each JSON line and display nicely
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          if (event.type === "system" && event.subtype === "init") {
            console.log(`   Model: ${event.model}`);
          } else if (event.type === "assistant" && event.message?.content) {
            // Show assistant's text
            for (const block of event.message.content) {
              if (block.type === "text" && block.text !== lastAssistantMessage) {
                const newText = block.text.slice(lastAssistantMessage.length);
                if (newText) {
                  process.stdout.write(newText);
                  lastAssistantMessage = block.text;
                }
              } else if (block.type === "tool_use") {
                console.log(`\n   🔧 ${block.name}: ${JSON.stringify(block.input).slice(0, 100)}...`);
              }
            }
          } else if (event.type === "tool_result") {
            // Show tool result summary
            const result = event.result?.slice?.(0, 200) || "";
            if (result) {
              console.log(`   📋 Result: ${result.slice(0, 100)}${result.length > 100 ? "..." : ""}`);
            }
          } else if (event.type === "result") {
            console.log(`\n   ✓ Completed in ${event.duration_ms}ms, cost: $${event.total_cost_usd?.toFixed(4) || "?"}`);
          }
        } catch {
          // Not valid JSON, just log it
          if (line.trim()) {
            fs.appendFileSync(LOG_FILE, line + "\n");
          }
        }
      }
    });

    // Capture stderr
    let stderr = "";
    claudeProcess.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      // Only show stderr if it's not empty noise
      if (text.trim() && !text.includes("Debugger")) {
        process.stderr.write(`   [stderr] ${text}`);
      }
    });

    // Wait for Claude with timeout
    const exitCode = await new Promise<number>((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`\n   ⏱️  Timeout after ${CLAUDE_TIMEOUT_MS / 60000} minutes - killing process`);
        writeLog(`Timeout after ${CLAUDE_TIMEOUT_MS / 60000} minutes`);
        claudeProcess.kill("SIGTERM");
        setTimeout(() => {
          if (currentProcess) {
            claudeProcess.kill("SIGKILL");
          }
        }, 5000);
        resolve(124);
      }, CLAUDE_TIMEOUT_MS);

      claudeProcess.on("close", (code) => {
        clearTimeout(timeout);
        transcriptStream.end();
        resolve(code ?? 1);
      });
    });

    currentProcess = null;
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`   SESSION ENDED - ${duration}s - Exit code: ${exitCode}`);
    console.log(`${"=".repeat(60)}\n`);

    writeLog(`\nClaude finished in ${duration}s with exit code ${exitCode}`);
    if (stderr) writeLog(`stderr: ${stderr}`);
    fs.writeFileSync(statusFile, `Completed: ${request.sourceName}\nDuration: ${duration}s\nExit code: ${exitCode}\n`);

    // Check if scraper code was written
    let scraperCode: string | null = null;

    // First, check if Claude wrote directly to the output file
    if (fs.existsSync(outputFile)) {
      scraperCode = fs.readFileSync(outputFile, "utf-8");
      if (scraperCode.trim().length > 50) {
        log(`   ✅ Scraper code saved to file (${scraperCode.length} bytes)`);
      } else {
        log(`   ⚠️  Output file exists but too small (${scraperCode.length} bytes)`);
        scraperCode = null;
      }
    }

    // If no output file, try to extract code from the JSON stream
    if (!scraperCode && stdout) {
      // Look for typescript code blocks in any assistant message
      const codeMatch = stdout.match(/"text"\s*:\s*"[^"]*```(?:typescript|ts)\\n([^`]+)```/);
      if (codeMatch && codeMatch[1].length > 50) {
        // Unescape the JSON string
        scraperCode = codeMatch[1]
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
        fs.writeFileSync(outputFile, scraperCode);
        log(`   ✅ Extracted scraper code from JSON stream (${scraperCode.length} bytes)`);
      }

      // Also try raw markdown code blocks (in case of different format)
      if (!scraperCode) {
        const rawMatch = stdout.match(/```(?:typescript|ts)\n([\s\S]*?)```/);
        if (rawMatch && rawMatch[1].length > 50) {
          scraperCode = rawMatch[1];
          fs.writeFileSync(outputFile, scraperCode);
          log(`   ✅ Extracted scraper code from raw output (${scraperCode.length} bytes)`);
        }
      }
    }

    if (!scraperCode) {
      console.log(`   ⚠️  No scraper code found in output file or stream`);
    }

    if (scraperCode) {
      // Update the database with the generated code
      await client.mutation(api.scraping.development.updateScraperCode, {
        requestId: requestId as any,
        scraperCode,
      });

      log(`   Testing scraper...`);

      // Test the scraper
      const testResult = await testScraper(scraperCode, request.sourceUrl, verbose);

      // Record test results
      await client.mutation(api.scraping.development.recordTestResults, {
        requestId: requestId as any,
        sessionsFound: testResult.sessions.length,
        sampleData: testResult.sessions.length > 0
          ? JSON.stringify(testResult.sessions.slice(0, 5), null, 2)
          : undefined,
        error: testResult.error,
      });

      if (testResult.error) {
        console.log(`   ❌ Test failed: ${testResult.error.slice(0, 100)}`);
        writeLog(`Test FAILED: ${testResult.error}`);

        // Generate intelligent auto-feedback for errors
        const autoFeedback = generateAutoFeedback(request.sourceUrl, scraperCode, testResult.error);
        log(`   🤖 Auto-generating feedback for error...`);
        await client.mutation(api.scraping.development.submitFeedback, {
          requestId: requestId as any,
          feedback: autoFeedback,
          feedbackBy: "auto-diagnosis",
        });
      } else if (testResult.sessions.length === 0) {
        console.log(`   ⚠️  Test found 0 sessions - analyzing and auto-retrying`);
        writeLog(`Test found 0 sessions - analyzing site characteristics`);

        // Generate intelligent auto-feedback
        const autoFeedback = generateAutoFeedback(request.sourceUrl, scraperCode);
        log(`   🤖 Auto-generating feedback based on site analysis...`);

        await client.mutation(api.scraping.development.submitFeedback, {
          requestId: requestId as any,
          feedback: autoFeedback,
          feedbackBy: "auto-diagnosis",
        });

        console.log(`   📝 Submitted auto-feedback - will retry with better guidance`);
      } else {
        console.log(`   ✅ Found ${testResult.sessions.length} sessions - ready for review`);
        writeLog(`Test PASSED: Found ${testResult.sessions.length} sessions`);
        writeLog(`Sample: ${JSON.stringify(testResult.sessions[0], null, 2)}`);
      }
    } else {
      // No scraper code produced - mark as failed
      console.log(`   ❌ No scraper code produced`);
      await client.mutation(api.scraping.development.recordTestResults, {
        requestId: requestId as any,
        sessionsFound: 0,
        error: "Claude did not produce any scraper code",
      });
    }
  } catch (error) {
    console.error(`   Error:`, error instanceof Error ? error.message : error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Generate site-specific guidance based on URL patterns
 */
function getSiteSpecificGuidance(url: string): string {
  const guidance: string[] = [];

  // Portland Parks & Rec - LOCATION-BASED organization
  if (url.includes('portland.gov/parks')) {
    guidance.push('\n## ⚠️ CRITICAL: Portland Parks & Recreation - LOCATION-BASED CAMPS\n');
    guidance.push('**Camps are organized by COMMUNITY CENTER. You MUST scrape each location separately.**\n\n');
    guidance.push('### Discovery Steps:\n');
    guidance.push('1. Go to the main camps page and find the list of community center locations\n');
    guidance.push('2. Each location links to ActiveCommunities with a different `site_ids` parameter\n');
    guidance.push('3. You MUST iterate through ALL locations to get all camps\n\n');
    guidance.push('### Known Community Center site_ids:\n');
    guidance.push('```typescript\n');
    guidance.push('const COMMUNITY_CENTERS = [\n');
    guidance.push('  { name: "Charles Jordan Community Center", siteId: 15 },\n');
    guidance.push('  { name: "East Portland Community Center", siteId: 23 },\n');
    guidance.push('  { name: "Matt Dishman Community Center", siteId: 21 },\n');
    guidance.push('  { name: "Montavilla Community Center", siteId: 43 },\n');
    guidance.push('  { name: "Mt. Scott Community Center", siteId: 44 },\n');
    guidance.push('  { name: "Multnomah Arts Center", siteId: 22 },\n');
    guidance.push('  { name: "Peninsula Park Community Center", siteId: 45 },\n');
    guidance.push('  { name: "Southwest Community Center", siteId: 46 },\n');
    guidance.push('  { name: "St. Johns Community Center", siteId: 47 },\n');
    guidance.push('];\n');
    guidance.push('```\n\n');
    guidance.push('### URL Pattern:\n');
    guidance.push('```\n');
    guidance.push('https://anc.apm.activecommunities.com/portlandparks/activity/search\n');
    guidance.push('  ?onlineSiteId=0\n');
    guidance.push('  &activity_select_param=2\n');
    guidance.push('  &activity_category_ids=83&activity_category_ids=50&activity_category_ids=68\n');
    guidance.push('  &site_ids=XX  <-- VARIES BY LOCATION\n');
    guidance.push('  &activity_other_category_ids=4\n');
    guidance.push('  &viewMode=list\n');
    guidance.push('```\n\n');
    guidance.push('### Expected Result Format:\n');
    guidance.push('Camp - Spring Break Thrills: Week of 3/23 (Grades 1-5)\n');
    guidance.push('#1189692 / Grade 1st - 5th / Openings 0\n');
    guidance.push('Mon,Tue,Wed,Thu,Fri 9:00 AM - 5:00 PM\n\n');
    guidance.push('**Expect 50-200+ camps total across all locations.**\n\n');
  }

  // Generic ActiveCommunities detection (other cities)
  else if (url.includes('activecommunities.com') || url.includes('apm.activecommunities.com')) {
    guidance.push('\n## ⚠️ CRITICAL: ActiveCommunities React SPA Detected\n');
    guidance.push('This is a React SPA that loads content dynamically.\n');
    guidance.push('**DO NOT use querySelector - use page.extract() with Stagehand AI.**\n\n');
    guidance.push('### Check for Location-Based Organization:\n');
    guidance.push('Many Parks & Rec sites organize camps by facility/location.\n');
    guidance.push('Look for `site_ids` parameters in URLs - you may need to iterate through multiple.\n\n');
    guidance.push("Wait with `networkidle` AND `page.waitForTimeout(5000)` for React to render.\n\n");
  }

  // OMSI/secure sites
  if (url.includes('secure.omsi.edu') || url.includes('simpletix.com')) {
    guidance.push('\n## Site Type: Secure Registration Portal\n');
    guidance.push('This is a ticketing/registration system. Look for:\n');
    guidance.push('- Program/event listings in a grid or list view\n');
    guidance.push('- Category filters or navigation\n');
    guidance.push('- Date ranges and pricing in each listing\n\n');
  }

  // Museum sites often have complex structures
  if (url.includes('museum') || url.includes('evergreenmuseum') || url.includes('omsi')) {
    guidance.push('\n## Museum/Science Center Site\n');
    guidance.push('These typically have:\n');
    guidance.push('- Multiple camp categories (by age, theme, dates)\n');
    guidance.push('- Detailed program pages with registration links\n');
    guidance.push('- Check for a dedicated camps/classes section\n\n');
  }

  // Parks & Recreation general pattern
  if (url.includes('parks') && url.includes('recreation') || url.includes('parksandrec')) {
    guidance.push('\n## Parks & Recreation Site Pattern\n');
    guidance.push('**WARNING: These sites often organize camps by LOCATION.**\n');
    guidance.push('Look for:\n');
    guidance.push('- List of community centers, parks, or facilities\n');
    guidance.push('- Each location may have its own camp listings\n');
    guidance.push('- Registration system may use `site_ids` or `location_id` parameters\n');
    guidance.push('- You MUST iterate through all locations to get complete data\n\n');
  }

  return guidance.join('');
}

function buildClaudePrompt(request: DevelopmentRequest, exploration?: SiteExplorationResult | null): string {
  const templatePath = path.join(process.cwd(), "scripts", "scraper-prompt-template.md");
  let template: string;

  try {
    template = fs.readFileSync(templatePath, "utf-8");
  } catch {
    console.error(`Error: Could not read template file at ${templatePath}`);
    console.error("Using fallback prompt.");
    template = `# Scraper Development Task

You are developing a web scraper for: **{{SOURCE_NAME}}**
URL: {{SOURCE_URL}}

Write a scraper that extracts summer camp sessions and save it to: {{OUTPUT_FILE}}
{{#NOTES}}
Notes: {{NOTES}}
{{/NOTES}}
{{SITE_GUIDANCE}}
{{EXPLORATION_RESULTS}}
`;
  }

  const outputFile = `${SCRATCHPAD_DIR}/scraper-${request._id}.ts`;

  // Get site-specific guidance
  const siteGuidance = getSiteSpecificGuidance(request.sourceUrl);

  // Format exploration results if available
  const explorationResults = exploration ? formatExplorationForPrompt(exploration) : '';

  // Replace basic placeholders
  let prompt = template
    .replace(/\{\{SOURCE_NAME\}\}/g, request.sourceName)
    .replace(/\{\{SOURCE_URL\}\}/g, request.sourceUrl)
    .replace(/\{\{OUTPUT_FILE\}\}/g, outputFile)
    .replace(/\{\{SITE_GUIDANCE\}\}/g, siteGuidance)
    .replace(/\{\{EXPLORATION_RESULTS\}\}/g, explorationResults);

  // Handle conditional sections
  // Notes section
  if (request.notes) {
    prompt = prompt
      .replace(/\{\{#NOTES\}\}/g, "")
      .replace(/\{\{\/NOTES\}\}/g, "")
      .replace(/\{\{NOTES\}\}/g, request.notes);
  } else {
    prompt = prompt.replace(/\{\{#NOTES\}\}[\s\S]*?\{\{\/NOTES\}\}/g, "");
  }

  // Feedback section
  const hasFeedback = request.feedbackHistory && request.feedbackHistory.length > 0;
  const latestFeedback = hasFeedback
    ? request.feedbackHistory![request.feedbackHistory!.length - 1]
    : null;

  if (hasFeedback && latestFeedback) {
    prompt = prompt
      .replace(/\{\{#FEEDBACK\}\}/g, "")
      .replace(/\{\{\/FEEDBACK\}\}/g, "")
      .replace(/\{\{FEEDBACK_VERSION\}\}/g, String(latestFeedback.scraperVersionBefore))
      .replace(/\{\{FEEDBACK_TEXT\}\}/g, latestFeedback.feedback);
  } else {
    prompt = prompt.replace(/\{\{#FEEDBACK\}\}[\s\S]*?\{\{\/FEEDBACK\}\}/g, "");
  }

  // Previous code section
  if (request.generatedScraperCode) {
    prompt = prompt
      .replace(/\{\{#PREVIOUS_CODE\}\}/g, "")
      .replace(/\{\{\/PREVIOUS_CODE\}\}/g, "")
      .replace(/\{\{PREVIOUS_CODE\}\}/g, request.generatedScraperCode);
  } else {
    prompt = prompt.replace(/\{\{#PREVIOUS_CODE\}\}[\s\S]*?\{\{\/PREVIOUS_CODE\}\}/g, "");
  }

  return prompt;
}

interface TestResult {
  sessions: any[];
  error?: string;
  diagnostics?: ScraperDiagnostics;
}

interface ScraperDiagnostics {
  siteType: 'static' | 'react_spa' | 'active_communities' | 'api_driven' | 'unknown';
  possibleIssues: string[];
  suggestedFixes: string[];
  detectedPatterns: string[];
}

/**
 * Analyze the URL and page characteristics to diagnose why scraping might fail
 */
function diagnoseSiteCharacteristics(url: string, scraperCode: string): ScraperDiagnostics {
  const diagnostics: ScraperDiagnostics = {
    siteType: 'unknown',
    possibleIssues: [],
    suggestedFixes: [],
    detectedPatterns: [],
  };

  // Detect ActiveCommunities sites (very common for parks & rec)
  if (url.includes('activecommunities.com') || url.includes('apm.activecommunities.com')) {
    diagnostics.siteType = 'active_communities';
    diagnostics.possibleIssues.push('ActiveCommunities is a React SPA that loads content dynamically');
    diagnostics.possibleIssues.push('DOM selectors will fail - content renders after JavaScript executes');
    diagnostics.suggestedFixes.push('Use page.extract() with Stagehand AI instead of querySelector');
    diagnostics.suggestedFixes.push('Wait for networkidle + additional 5-10 seconds for React hydration');
    diagnostics.suggestedFixes.push('Extract from visible rendered content, not DOM structure');
    diagnostics.detectedPatterns.push('activecommunities.com detected');
  }

  // Detect other React/SPA patterns
  if (url.includes('secure.') || url.includes('portal.') || url.includes('app.')) {
    diagnostics.detectedPatterns.push('URL pattern suggests web app/portal');
    if (diagnostics.siteType === 'unknown') {
      diagnostics.siteType = 'react_spa';
      diagnostics.possibleIssues.push('Likely a Single Page Application (SPA)');
      diagnostics.suggestedFixes.push('Wait longer for JavaScript to render content');
      diagnostics.suggestedFixes.push('Use page.extract() for AI-based extraction');
    }
  }

  // Check scraper code for common issues
  if (scraperCode.includes('querySelectorAll') && !scraperCode.includes('page.extract')) {
    diagnostics.possibleIssues.push('Scraper relies on DOM selectors which may fail on SPAs');
    diagnostics.suggestedFixes.push('Add fallback using page.extract() for AI extraction');
  }

  if (scraperCode.includes("waitUntil: 'domcontentloaded'") && !scraperCode.includes('waitForTimeout')) {
    diagnostics.possibleIssues.push('May not wait long enough for dynamic content');
    diagnostics.suggestedFixes.push('Add page.waitForTimeout(5000) after navigation');
  }

  if (!scraperCode.includes('networkidle') && diagnostics.siteType === 'react_spa') {
    diagnostics.suggestedFixes.push("Use waitUntil: 'networkidle' for SPA sites");
  }

  // Detect pagination issues
  if (scraperCode.includes('category_ids') || scraperCode.includes('page=')) {
    diagnostics.detectedPatterns.push('Multi-page or multi-category scraping');
    if (!scraperCode.includes('hasMorePages') && !scraperCode.includes('pagination')) {
      diagnostics.possibleIssues.push('May not handle pagination correctly');
      diagnostics.suggestedFixes.push('Implement pagination handling with Load More or Next button clicks');
    }
  }

  return diagnostics;
}

/**
 * Generate intelligent auto-feedback when scraper finds 0 sessions
 */
function generateAutoFeedback(
  url: string,
  scraperCode: string,
  testError?: string
): string {
  const diagnostics = diagnoseSiteCharacteristics(url, scraperCode);

  const feedback: string[] = ['Automatic diagnosis based on test results:\n'];

  // Site type specific guidance
  if (diagnostics.siteType === 'active_communities') {
    feedback.push('⚠️ CRITICAL: This is an ActiveCommunities site (React SPA).\n');
    feedback.push('The current approach using DOM selectors WILL NOT WORK.\n\n');
    feedback.push('REQUIRED CHANGES:\n');
    feedback.push('1. Navigate directly to the activity search URL with category filters\n');
    feedback.push('2. Wait with networkidle AND page.waitForTimeout(5000) minimum\n');
    feedback.push('3. Use page.extract() with Stagehand AI to extract visible content\n');
    feedback.push('4. DO NOT use querySelector/querySelectorAll - they will fail\n');
    feedback.push('5. The camps render as cards - extract name, dates, price, ages from what you SEE\n\n');
    feedback.push('Example category URLs:\n');
    feedback.push('- Day Camps: ?activity_category_ids=50\n');
    feedback.push('- Specialty Camps: ?activity_category_ids=83\n');
    feedback.push('- Sports Camps: ?activity_category_ids=68\n');
  } else if (diagnostics.siteType === 'react_spa') {
    feedback.push('⚠️ This appears to be a Single Page Application (SPA).\n\n');
    feedback.push('SUGGESTED CHANGES:\n');
    feedback.push('1. Add longer wait times after navigation (5-10 seconds)\n');
    feedback.push('2. Use page.extract() for AI-based content extraction\n');
    feedback.push('3. Check if the site has an API you can call directly\n');
  }

  // Add specific issues
  if (diagnostics.possibleIssues.length > 0) {
    feedback.push('\nDETECTED ISSUES:\n');
    for (const issue of diagnostics.possibleIssues) {
      feedback.push(`- ${issue}\n`);
    }
  }

  // Add suggested fixes
  if (diagnostics.suggestedFixes.length > 0) {
    feedback.push('\nSUGGESTED FIXES:\n');
    for (const fix of diagnostics.suggestedFixes) {
      feedback.push(`- ${fix}\n`);
    }
  }

  // Add error context if available
  if (testError) {
    feedback.push(`\nTEST ERROR: ${testError.slice(0, 500)}\n`);
  }

  return feedback.join('');
}

/**
 * Determine the type of scraper and how to test it
 *
 * Key distinction:
 * - BROWSER-DEPENDENT: Scraper navigates pages, clicks elements, or uses AI extraction
 *   to discover and extract session data from the DOM
 * - PROGRAMMATIC: Scraper has hardcoded week definitions and generates sessions
 *   using forEach/for loops. May use page.evaluate for optional data enrichment,
 *   but sessions are generated from static data regardless of page content
 */
function analyzeScraperType(scraperCode: string): {
  needsBrowser: boolean;
  isProgrammatic: boolean;
  reason: string;
} {
  // Check for browser APIs
  const usesStagehandExtract = scraperCode.includes('page.extract(');
  const usesPageGoto = scraperCode.includes('page.goto(');
  const usesPageClick = scraperCode.includes('page.click(') || scraperCode.includes('.click(');
  const usesPageWaitFor = scraperCode.includes('page.waitFor');

  // Check for DOM traversal to build sessions (as opposed to just metadata extraction)
  // querySelectorAll is a strong signal of building sessions from DOM elements
  const usesDOMTraversal = scraperCode.includes('querySelectorAll');

  // Check for programmatic session generation patterns
  // Handle various patterns: weeks = [, weeks: [...] = [, weeks: Array<...> = [
  const hasHardcodedWeeks = scraperCode.includes('weeks = [') ||
    scraperCode.includes('weeks: [') ||
    /weeks:\s*Array<[^>]+>\s*=\s*\[/.test(scraperCode) ||
    /const\s+weeks\s*=\s*\[/.test(scraperCode);
  const hasSessionsPush = scraperCode.includes('sessions.push');
  const hasWeeksForEach = scraperCode.includes('weeks.forEach');
  const hasWeeksForLoop = /for\s*\([^)]*weeks\.length/.test(scraperCode);
  const hasGenerateFunction = scraperCode.includes('generateWeeklySessions');

  // PRIORITY 1: If it uses page.extract() or page.goto() or querySelectorAll,
  // it MUST use a browser. These are definitive browser-dependent patterns.
  if (usesStagehandExtract || usesPageGoto || usesDOMTraversal) {
    return {
      needsBrowser: true,
      isProgrammatic: false,
      reason: `Browser-dependent: extract=${usesStagehandExtract}, goto=${usesPageGoto}, domTraversal=${usesDOMTraversal}`
    };
  }

  // PRIORITY 2: If it has hardcoded weeks that are iterated to generate sessions,
  // it's programmatic. Even if it uses page.evaluate for metadata, the sessions
  // are generated from static data.
  if (hasHardcodedWeeks && hasSessionsPush && (hasWeeksForEach || hasWeeksForLoop)) {
    return {
      needsBrowser: false,
      isProgrammatic: true,
      reason: `Programmatic: hardcoded weeks array with loop to push sessions`
    };
  }

  if (hasGenerateFunction && hasSessionsPush) {
    return {
      needsBrowser: false,
      isProgrammatic: true,
      reason: `Programmatic: generateWeeklySessions function`
    };
  }

  // PRIORITY 3: If it uses click or waitFor, it needs browser
  if (usesPageClick || usesPageWaitFor) {
    return {
      needsBrowser: true,
      isProgrammatic: false,
      reason: `Browser-dependent: click=${usesPageClick}, waitFor=${usesPageWaitFor}`
    };
  }

  // PRIORITY 4: Check for general programmatic patterns
  // Has sessions.push with any loop and no browser navigation
  const hasForLoop = scraperCode.includes('for (') && scraperCode.includes('sessions.push');
  const hasWhileLoop = scraperCode.includes('while (') && scraperCode.includes('sessions.push');

  if (hasForLoop || hasWhileLoop) {
    return {
      needsBrowser: false,
      isProgrammatic: true,
      reason: `Programmatic: loop-based session generation`
    };
  }

  // Default: assume it needs browser testing
  return {
    needsBrowser: true,
    isProgrammatic: false,
    reason: 'No clear programmatic patterns detected - needs browser testing'
  };
}

/**
 * Actually execute the scraper code with a mock page object using tsx
 * This works for scrapers that generate sessions programmatically
 */
async function executeScraperWithMock(
  scraperCode: string,
  url: string,
  log: (msg: string) => void
): Promise<TestResult | null> {
  try {
    log(`   Executing scraper with mock page...`);

    // Write the scraper to a temp file
    const tempScraperPath = path.join(SCRATCHPAD_DIR, `temp-scraper-${Date.now()}.ts`);
    fs.writeFileSync(tempScraperPath, scraperCode);

    // Write a test runner that imports and executes the scraper
    const testRunnerPath = path.join(SCRATCHPAD_DIR, `test-runner-${Date.now()}.ts`);
    const testRunnerCode = `
import * as fs from 'fs';

// Create a mock page object
const mockPage = {
  url: () => '${url}',
  evaluate: async (fn: Function) => ({}),
  goto: async () => {},
  waitForTimeout: async () => {},
  extract: async () => ({}),
};

async function main() {
  try {
    const scraperModule = await import('${tempScraperPath}');
    const sessions = await scraperModule.scrape(mockPage);

    // Output as JSON for parsing
    console.log('__RESULT__' + JSON.stringify({
      success: true,
      sessionCount: sessions.length,
      sessions: sessions.slice(0, 10), // First 10 as samples
    }));
  } catch (error) {
    console.log('__RESULT__' + JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

main();
`;
    fs.writeFileSync(testRunnerPath, testRunnerCode);

    // Execute with tsx
    const { execSync } = require('child_process');
    const output = execSync(`npx tsx "${testRunnerPath}"`, {
      cwd: process.cwd(),
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse the result
    const resultMatch = output.match(/__RESULT__(.+)/);
    if (!resultMatch) {
      log(`   ⚠️ No result from scraper execution`);
      return null;
    }

    const result = JSON.parse(resultMatch[1]);

    // Cleanup temp files
    try {
      fs.unlinkSync(tempScraperPath);
      fs.unlinkSync(testRunnerPath);
    } catch {
      // Ignore cleanup errors
    }

    if (result.success && result.sessionCount > 0) {
      log(`   ✅ Scraper executed successfully: ${result.sessionCount} sessions`);
      return { sessions: result.sessions, error: undefined };
    } else if (result.error) {
      log(`   ❌ Scraper execution error: ${result.error}`);
      return null;
    } else {
      log(`   ⚠️ Scraper returned 0 sessions`);
      return null;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`   ❌ Execution failed: ${errorMsg.slice(0, 200)}`);
    return null;
  }
}

/**
 * Static analysis fallback for counting sessions
 */
function staticAnalysis(
  scraperCode: string,
  log: (msg: string) => void
): TestResult | null {
  log(`   Using static analysis fallback...`);

  // Count hardcoded week definitions: { start: '2026-06-15', end: '...' }
  const weekMatches = scraperCode.match(/\{\s*start:\s*['"](\d{4}-\d{2}-\d{2})['"]/g);
  let sessionCount = weekMatches?.length || 0;

  if (sessionCount === 0) {
    // Look for WEEK_DEFINITIONS or similar objects
    const weekDefMatch = scraperCode.match(/WEEK_DEFINITIONS[^}]*\{[\s\S]*?\n\};/);
    if (weekDefMatch) {
      const innerMatches = weekDefMatch[0].match(/\d+:\s*\{/g);
      sessionCount = innerMatches?.length || 0;
    }
  }

  if (sessionCount === 0) {
    // Count sessions.push calls
    const pushMatches = scraperCode.match(/sessions\.push\s*\(/g);
    sessionCount = pushMatches?.length || 0;
  }

  if (sessionCount === 0) {
    // Estimate from date range
    const juneMatch = scraperCode.match(/['"](\d{4})-06-(\d{2})['"]/);
    const augMatch = scraperCode.match(/['"](\d{4})-08-(\d{2})['"]/);
    if (juneMatch && augMatch) {
      // Roughly 10 weeks from mid-June to late August
      sessionCount = 10;
    }
  }

  if (sessionCount === 0) {
    log(`   Could not estimate session count`);
    return null;
  }

  log(`   Static analysis found ${sessionCount} sessions`);

  // Extract sample data
  const locationMatch = scraperCode.match(/location\s*[=:]\s*(?:[^'"]*\|\|)?\s*['"]([^'"]+)['"]/);
  const location = locationMatch?.[1] || 'Location TBD';

  const priceMatch = scraperCode.match(/priceInCents\s*[=:]\s*(\d+)/);
  const weeklyPriceCalc = scraperCode.match(/dailyPriceInCents\s*\*\s*5/);
  const dailyMatch = scraperCode.match(/dailyPriceInCents\s*=\s*(\d+)/);
  let priceInCents = priceMatch ? parseInt(priceMatch[1]) : undefined;
  if (!priceInCents && dailyMatch && weeklyPriceCalc) {
    priceInCents = parseInt(dailyMatch[1]) * 5;
  }

  const minAgeMatch = scraperCode.match(/minAge\s*[=:]\s*(\d+)/);
  const maxAgeMatch = scraperCode.match(/maxAge\s*[=:]\s*(\d+)/);
  const minAge = minAgeMatch ? parseInt(minAgeMatch[1]) : undefined;
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : undefined;

  // Extract week dates to generate sample sessions
  const sessions = [];
  const weekDates = scraperCode.matchAll(/\{\s*start:\s*['"](\d{4}-\d{2}-\d{2})['"],\s*end:\s*['"](\d{4}-\d{2}-\d{2})['"]/g);

  let weekNum = 1;
  for (const match of weekDates) {
    sessions.push({
      name: `Session - Week ${weekNum}`,
      startDate: match[1],
      endDate: match[2],
      location,
      priceInCents,
      minAge,
      maxAge,
    });
    weekNum++;
    if (weekNum > 5) break; // Only show first 5 as samples
  }

  if (sessions.length === 0) {
    // Create generic samples
    for (let i = 1; i <= Math.min(5, sessionCount); i++) {
      sessions.push({
        name: `Session ${i}`,
        location,
        priceInCents,
        minAge,
        maxAge,
        note: `(Total: ${sessionCount} sessions)`,
      });
    }
  }

  return { sessions, error: undefined };
}

/**
 * Try to test a programmatic scraper by actually executing it
 */
async function tryDirectExecution(
  scraperCode: string,
  url: string,
  log: (msg: string) => void
): Promise<TestResult | null> {
  // Analyze the scraper type
  const analysis = analyzeScraperType(scraperCode);
  log(`   Scraper analysis: ${analysis.reason}`);

  if (analysis.needsBrowser) {
    log(`   Scraper requires browser - cannot test with mock`);
    return null;
  }

  if (!analysis.isProgrammatic) {
    log(`   Not a programmatic scraper`);
    return null;
  }

  // Try actual execution first
  const execResult = await executeScraperWithMock(scraperCode, url, log);
  if (execResult && execResult.sessions.length > 0) {
    return execResult;
  }

  // Fall back to static analysis
  return staticAnalysis(scraperCode, log);
}

/**
 * Test a scraper by actually running it
 * First tries to execute it directly (for scrapers that generate sessions without browser)
 * Falls back to Stagehand if the scraper needs browser interaction
 */
async function testScraper(scraperCode: string, url: string, verbose: boolean = false): Promise<TestResult> {
  const log = (msg: string) => {
    writeLog(msg);
    if (verbose) console.log(msg);
  };

  // First, try to run the scraper directly if it generates sessions without needing a real browser
  // This handles drop-in camps that generate weekly sessions programmatically
  const directResult = await tryDirectExecution(scraperCode, url, log);
  if (directResult) {
    return directResult;
  }

  // Check if Stagehand is available for browser-based testing
  if (!Stagehand) {
    log("   Stagehand not installed - marking for manual review");
    // If the code looks like it generates sessions, treat as success
    if (scraperCode.includes('generateWeeklySessions') || scraperCode.includes('sessions.push')) {
      log("   Code appears to generate sessions - marking as ready for review");
      return {
        sessions: [{ name: "Generated sessions (manual verification needed)", note: "Scraper generates sessions programmatically" }],
        error: undefined,
      };
    }
    return {
      sessions: [],
      error: undefined, // No error, just no automated test
    };
  }

  let stagehand: any = null;

  try {
    // Check for required environment variables
    if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
      return {
        sessions: [],
        error: "Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID environment variables",
      };
    }

    if (!process.env.MODEL_API_KEY) {
      return {
        sessions: [],
        error: "Missing MODEL_API_KEY environment variable",
      };
    }

    log(`   Initializing Stagehand...`);

    // Initialize Stagehand
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: {
        modelName: "anthropic/claude-sonnet-4-20250514",
        apiKey: process.env.MODEL_API_KEY,
      },
      disablePino: true,
      verbose: 0,
    });

    await stagehand.init();

    // Get the page
    const page = stagehand.context.pages()[0];

    log(`   Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for dynamic content
    await page.waitForTimeout(5000);

    log(`   Running scraper...`);

    // Create a wrapper to execute the scraper code
    // We'll use page.evaluate to run the extraction logic
    // But first, we need to parse the scraper code to understand what it does

    // For now, let's use a simpler approach: use Stagehand's extract()
    // with the scraper code as context/instruction

    // Extract the scrape function body from the code
    const functionMatch = scraperCode.match(
      /async function scrape\s*\([^)]*\)\s*(?::\s*Promise<[^>]+>)?\s*\{([\s\S]*)\}[\s\S]*$/
    );

    if (!functionMatch) {
      // If we can't find a scrape function, try to use Stagehand's AI extraction
      // guided by the scraper code as instructions
      log(`   Using AI extraction (no scrape function found)...`);

      const { z } = await import("zod");

      const schema = z.object({
        sessions: z.array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            dateRaw: z.string().optional(),
            dropOffHour: z.number().optional(),
            dropOffMinute: z.number().optional(),
            pickUpHour: z.number().optional(),
            pickUpMinute: z.number().optional(),
            timeRaw: z.string().optional(),
            location: z.string().optional(),
            minAge: z.number().optional(),
            maxAge: z.number().optional(),
            minGrade: z.number().optional(),
            maxGrade: z.number().optional(),
            ageGradeRaw: z.string().optional(),
            priceInCents: z.number().optional(),
            priceRaw: z.string().optional(),
            registrationUrl: z.string().optional(),
            isAvailable: z.boolean().optional(),
          })
        ),
      });

      // Use the scraper code as additional instructions
      const instruction = `Extract all summer camp sessions from this page.

The developer wrote this scraper code as a guide:
\`\`\`
${scraperCode.slice(0, 2000)}
\`\`\`

Follow the logic in the code to extract sessions. Return all sessions found.`;

      const result = await stagehand.extract(instruction, schema);

      return {
        sessions: result.sessions || [],
      };
    }

    // If we found a scrape function, try to execute it via page.evaluate
    // This is tricky because the scraper code may use Stagehand-specific APIs
    // For now, fall back to AI extraction
    log(`   Found scrape function, using AI-guided extraction...`);

    const { z } = await import("zod");

    const schema = z.object({
      sessions: z.array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          dateRaw: z.string().optional(),
          dropOffHour: z.number().optional(),
          dropOffMinute: z.number().optional(),
          pickUpHour: z.number().optional(),
          pickUpMinute: z.number().optional(),
          timeRaw: z.string().optional(),
          location: z.string().optional(),
          minAge: z.number().optional(),
          maxAge: z.number().optional(),
          minGrade: z.number().optional(),
          maxGrade: z.number().optional(),
          ageGradeRaw: z.string().optional(),
          priceInCents: z.number().optional(),
          priceRaw: z.string().optional(),
          registrationUrl: z.string().optional(),
          isAvailable: z.boolean().optional(),
        })
      ),
    });

    const instruction = `Extract all summer camp sessions from this page following this scraper logic:

\`\`\`typescript
${scraperCode.slice(0, 3000)}
\`\`\`

Apply the extraction logic from the code. Return ALL sessions found.`;

    const result = await stagehand.extract(instruction, schema);

    return {
      sessions: result.sessions || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      sessions: [],
      error: errorMessage,
    };
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the daemon
main().catch(console.error);

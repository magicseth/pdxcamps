/**
 * Scraper development processing logic.
 * Handles building Claude prompts, spawning Claude CLI, testing scrapers,
 * and auto-diagnosing failures.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { DevelopmentRequest, SiteExplorationResult, TestResult, ScraperDiagnostics } from './types';
import { client, writeLog, SCRATCHPAD_DIR, CLAUDE_TIMEOUT_MS, logQueueStatus, LOG_FILE } from './shared';
import { exploreSiteNavigation, formatExplorationForPrompt } from './site-explorer';
import { api } from '../../convex/_generated/api';

export async function processRequest(
  request: DevelopmentRequest,
  verbose: boolean = false,
  workerId?: string,
) {
  const requestId = request._id;
  const prefix = workerId ? `[${workerId}]` : '';

  const log = (msg: string) => {
    const prefixedMsg = prefix ? `${prefix} ${msg}` : msg;
    writeLog(prefixedMsg);
    if (verbose) console.log(prefixedMsg);
  };

  console.log(`${prefix} 📋 Processing: ${request.sourceName}`);
  writeLog(`\n=== ${prefix} Processing: ${request.sourceName} ===`);
  writeLog(`${prefix} URL: ${request.sourceUrl}`);

  try {
    // STEP 1: Explore the site navigation structure BEFORE building the scraper
    let explorationResult: SiteExplorationResult | null = null;

    // Check if we already have exploration results from a previous attempt
    if (request.siteExploration) {
      log(
        `   📋 Using existing site exploration from ${new Date(request.siteExploration.exploredAt).toISOString()}`,
      );
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
          log(
            `   ⚠️ Failed to save exploration: ${saveError instanceof Error ? saveError.message : saveError}`,
          );
        }

        // Handle directory sites - extract camp links and create requests for each
        if (
          explorationResult.isDirectory &&
          explorationResult.directoryLinks &&
          explorationResult.directoryLinks.length > 0
        ) {
          const allLinks = explorationResult.directoryLinks as Array<{
            url: string;
            name: string;
            isInternal?: boolean;
          }>;
          const externalLinks = allLinks.filter((l) => !l.isInternal);
          const internalLinks = allLinks.filter((l) => l.isInternal);

          log(`   📂 Directory detected:`);
          log(`      - ${externalLinks.length} external camp organization links`);
          log(`      - ${internalLinks.length} internal camp detail pages`);
          log(`   📥 Creating scraper requests from directory...`);

          try {
            // Filter out known non-camp URLs
            const filterNonCamp = (link: { url: string; name: string }) => {
              const url = link.url.toLowerCase();
              if (
                /facebook|twitter|instagram|linkedin|youtube|google|yelp|tripadvisor|amazon|pinterest|reddit|wikipedia|tiktok/i.test(
                  url,
                )
              ) {
                return false;
              }
              return true;
            };

            const validExternalLinks = externalLinks.filter(filterNonCamp);
            const validInternalLinks = internalLinks.filter(filterNonCamp);

            let createdExternal = 0;
            let createdInternal = 0;
            let existed = 0;

            // Process external links - these are camp organization websites
            for (const link of validExternalLinks.slice(0, 30)) {
              try {
                const domain = new URL(link.url).hostname.replace(/^www\./, '');
                const name = link.name.length > 3 ? link.name : domain.split('.')[0];

                await client.mutation(api.scraping.development.requestScraperDevelopment, {
                  sourceName: name.slice(0, 100),
                  sourceUrl: link.url,
                  cityId: request.cityId as any,
                  notes: `Discovered from directory: ${request.sourceName} (external camp website)`,
                  requestedBy: 'directory-crawler',
                });

                createdExternal++;
                log(`      + [ext] ${domain}`);
              } catch (e) {
                existed++;
              }
            }

            // Process internal links - these are camp detail pages hosted on the directory
            for (const link of validInternalLinks.slice(0, 50)) {
              try {
                const urlObj = new URL(link.url);
                const pathSlug = urlObj.pathname.split('/').filter(Boolean).pop() || '';
                const name = link.name.length > 3 ? link.name : pathSlug.replace(/-/g, ' ');

                await client.mutation(api.scraping.development.requestScraperDevelopment, {
                  sourceName: name.slice(0, 100),
                  sourceUrl: link.url,
                  cityId: request.cityId as any,
                  notes: `Directory detail page from: ${request.sourceName}. Extract camp info (name, dates, price, ages, location, registration URL) from this page.`,
                  requestedBy: 'directory-crawler-internal',
                });

                createdInternal++;
                log(`      + [int] ${urlObj.pathname.slice(0, 50)}`);
              } catch (e) {
                existed++;
              }
            }

            const totalCreated = createdExternal + createdInternal;
            log(`   ✅ Directory processed:`);
            log(`      - ${createdExternal} external org requests created`);
            log(`      - ${createdInternal} internal page requests created`);
            log(`      - ${existed} skipped (already exist)`);

            // Mark this request as completed (directory processed)
            await client.mutation(api.scraping.development.markDirectoryProcessed, {
              requestId: requestId as any,
              notes: `Directory processed: ${createdExternal} external + ${createdInternal} internal = ${totalCreated} new scraper requests queued`,
              linksFound: allLinks.length,
              requestsCreated: totalCreated,
            });

            return; // Don't build a scraper for the directory listing page itself
          } catch (dirError) {
            log(
              `   ⚠️ Directory processing error: ${dirError instanceof Error ? dirError.message : dirError}`,
            );
            // Fall through to normal scraper building as fallback
          }
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
    const statusFile = path.join(SCRATCHPAD_DIR, 'current-status.txt');
    const startTime = Date.now();
    fs.writeFileSync(
      statusFile,
      `Processing: ${request.sourceName}\nURL: ${request.sourceUrl}\nStarted: ${new Date().toISOString()}\nTimeout: ${CLAUDE_TIMEOUT_MS / 60000} minutes\n`,
    );

    // Create a transcript file for this session
    const transcriptFile = path.join(SCRATCHPAD_DIR, `transcript-${requestId}.txt`);
    const transcriptStream = fs.createWriteStream(transcriptFile);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`   CLAUDE SESSION: ${request.sourceName}`);
    console.log(`${'='.repeat(60)}\n`);

    // Run Claude with --print and stream-json to see what it's doing
    // IMPORTANT: stdin must be "ignore" or Claude hangs waiting for input
    // Ensure PATH includes common locations for claude binary
    const pathAdditions = [
      `${process.env.HOME}/.local/bin`,
      '/usr/local/bin',
      '/opt/homebrew/bin',
    ].join(':');
    const enhancedPath = `${pathAdditions}:${process.env.PATH || ''}`;

    const claudeProcess = spawn(
      'claude',
      [
        '--dangerously-skip-permissions',
        '--print',
        '--output-format',
        'stream-json',
        '--model',
        'sonnet',
        '-p',
        prompt,
      ],
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'], // ignore stdin or Claude hangs!
        env: {
          ...process.env,
          PATH: enhancedPath,
          SCRAPER_OUTPUT_FILE: outputFile,
        },
      },
    );

    // Stream stdout and parse JSON events
    let stdout = '';
    let lastAssistantMessage = '';
    claudeProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;

      // Write raw to transcript file
      transcriptStream.write(text);

      // Parse each JSON line and display nicely
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          if (event.type === 'system' && event.subtype === 'init') {
            console.log(`   Model: ${event.model}`);
          } else if (event.type === 'assistant' && event.message?.content) {
            // Show assistant's text
            for (const block of event.message.content) {
              if (block.type === 'text' && block.text !== lastAssistantMessage) {
                const newText = block.text.slice(lastAssistantMessage.length);
                if (newText) {
                  process.stdout.write(newText);
                  lastAssistantMessage = block.text;
                }
              } else if (block.type === 'tool_use') {
                console.log(
                  `\n   🔧 ${block.name}: ${JSON.stringify(block.input).slice(0, 100)}...`,
                );
              }
            }
          } else if (event.type === 'tool_result') {
            // Show tool result summary
            const result = event.result?.slice?.(0, 200) || '';
            if (result) {
              console.log(
                `   📋 Result: ${result.slice(0, 100)}${result.length > 100 ? '...' : ''}`,
              );
            }
          } else if (event.type === 'result') {
            console.log(
              `\n   ✓ Completed in ${event.duration_ms}ms, cost: $${event.total_cost_usd?.toFixed(4) || '?'}`,
            );
          }
        } catch {
          // Not valid JSON, just log it
          if (line.trim()) {
            fs.appendFileSync(LOG_FILE, line + '\n');
          }
        }
      }
    });

    // Capture stderr
    let stderr = '';
    claudeProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      // Only show stderr if it's not empty noise
      if (text.trim() && !text.includes('Debugger')) {
        process.stderr.write(`   [stderr] ${text}`);
      }
    });

    // Wait for Claude with timeout
    const exitCode = await new Promise<number>((resolve) => {
      const timeout = setTimeout(() => {
        console.log(
          `\n   ⏱️  Timeout after ${CLAUDE_TIMEOUT_MS / 60000} minutes - killing process`,
        );
        writeLog(`Timeout after ${CLAUDE_TIMEOUT_MS / 60000} minutes`);
        claudeProcess.kill('SIGTERM');
        setTimeout(() => {
          claudeProcess.kill('SIGKILL');
        }, 5000);
        resolve(124);
      }, CLAUDE_TIMEOUT_MS);

      claudeProcess.on('close', (code) => {
        clearTimeout(timeout);
        transcriptStream.end();
        resolve(code ?? 1);
      });
    });
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`   SESSION ENDED - ${duration}s - Exit code: ${exitCode}`);
    console.log(`${'='.repeat(60)}\n`);

    writeLog(`\nClaude finished in ${duration}s with exit code ${exitCode}`);
    if (stderr) writeLog(`stderr: ${stderr}`);
    fs.writeFileSync(
      statusFile,
      `Completed: ${request.sourceName}\nDuration: ${duration}s\nExit code: ${exitCode}\n`,
    );

    // Check if scraper code was written
    let scraperCode: string | null = null;

    // First, check if Claude wrote directly to the output file
    if (fs.existsSync(outputFile)) {
      scraperCode = fs.readFileSync(outputFile, 'utf-8');
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
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
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

      // Test the scraper using the same script Claude can use
      const testResult = await runTestScript(outputFile, request.sourceUrl, verbose);

      // Record test results
      // Filter out internal placeholders, keep only real sample data
      const visibleSamples = testResult.sessions
        .filter((s: any) => !s._index) // Remove hidden count placeholders
        .slice(0, 5);

      await client.mutation(api.scraping.development.recordTestResults, {
        requestId: requestId as any,
        sessionsFound: testResult.sessions.length,
        sampleData:
          visibleSamples.length > 0 ? JSON.stringify(visibleSamples, null, 2) : undefined,
        error: testResult.error,
      });

      if (testResult.error) {
        console.log(`   ❌ Test failed: ${testResult.error.slice(0, 100)}`);
        // Debug: show which API key is being used
        if (testResult.error.includes('credit balance')) {
          console.log(
            `   🔑 MODEL_API_KEY prefix: ${process.env.MODEL_API_KEY?.slice(0, 30)}...`,
          );
        }
        writeLog(`Test FAILED: ${testResult.error}`);

        // Generate intelligent auto-feedback for errors
        const autoFeedback = generateAutoFeedback(
          request.sourceUrl,
          scraperCode,
          testResult.error,
        );
        log(`   🤖 Auto-generating feedback for error...`);
        await client.mutation(api.scraping.development.submitFeedback, {
          requestId: requestId as any,
          feedback: autoFeedback,
          feedbackBy: 'auto-diagnosis',
        });
      } else if (testResult.sessions.length === 0) {
        // Check if 0 sessions is expected/valid (seasonal catalog, not published yet, etc.)
        const zeroIsValid = isZeroSessionsValid(scraperCode, request.sourceUrl);

        if (zeroIsValid.valid) {
          console.log(`   ✅ Found 0 sessions (expected): ${zeroIsValid.reason}`);
          writeLog(`Test PASSED with 0 sessions: ${zeroIsValid.reason}`);

          // Record as successful with explanatory note
          await client.mutation(api.scraping.development.recordTestResults, {
            requestId: requestId as any,
            sessionsFound: 0,
            sampleData: JSON.stringify({
              note: zeroIsValid.reason,
              expectedEmpty: true,
              checkAgainAfter: zeroIsValid.checkAfter,
            }),
          });
        } else {
          console.log(`   ⚠️  Test found 0 sessions - recording for retry`);
          writeLog(`Test found 0 sessions - analyzing site characteristics`);

          // Use recordTestResults which has proper retry limits (maxTestRetries, default 3)
          // This avoids infinite loops from submitFeedback which unconditionally resets to pending
          const autoFeedback = generateAutoFeedback(request.sourceUrl, scraperCode);
          await client.mutation(api.scraping.development.recordTestResults, {
            requestId: requestId as any,
            sessionsFound: 0,
            error: `Found 0 sessions. ${autoFeedback.slice(0, 400)}`,
          });

          console.log(`   📝 Recorded 0-session result - will retry with guidance`);
        }
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
        error: 'Claude did not produce any scraper code',
      });
    }
  } catch (error) {
    console.error(`${prefix}    Error:`, error instanceof Error ? error.message : error);
    throw error; // Re-throw so processRequestAsync can handle cleanup
  }
}

function buildClaudePrompt(
  request: DevelopmentRequest,
  exploration?: SiteExplorationResult | null,
): string {
  const templatePath = path.join(process.cwd(), 'scripts', 'scraper-prompt-template.md');
  let template: string;

  try {
    template = fs.readFileSync(templatePath, 'utf-8');
  } catch {
    console.error(`Error: Could not read template file at ${templatePath}`);
    console.error('Using fallback prompt.');
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
      .replace(/\{\{#NOTES\}\}/g, '')
      .replace(/\{\{\/NOTES\}\}/g, '')
      .replace(/\{\{NOTES\}\}/g, request.notes);
  } else {
    prompt = prompt.replace(/\{\{#NOTES\}\}[\s\S]*?\{\{\/NOTES\}\}/g, '');
  }

  // Feedback section
  const hasFeedback = request.feedbackHistory && request.feedbackHistory.length > 0;
  const latestFeedback = hasFeedback
    ? request.feedbackHistory![request.feedbackHistory!.length - 1]
    : null;

  if (hasFeedback && latestFeedback) {
    prompt = prompt
      .replace(/\{\{#FEEDBACK\}\}/g, '')
      .replace(/\{\{\/FEEDBACK\}\}/g, '')
      .replace(/\{\{FEEDBACK_VERSION\}\}/g, String(latestFeedback.scraperVersionBefore))
      .replace(/\{\{FEEDBACK_TEXT\}\}/g, latestFeedback.feedback);
  } else {
    prompt = prompt.replace(/\{\{#FEEDBACK\}\}[\s\S]*?\{\{\/FEEDBACK\}\}/g, '');
  }

  // Previous code section
  if (request.generatedScraperCode) {
    prompt = prompt
      .replace(/\{\{#PREVIOUS_CODE\}\}/g, '')
      .replace(/\{\{\/PREVIOUS_CODE\}\}/g, '')
      .replace(/\{\{PREVIOUS_CODE\}\}/g, request.generatedScraperCode);
  } else {
    prompt = prompt.replace(/\{\{#PREVIOUS_CODE\}\}[\s\S]*?\{\{\/PREVIOUS_CODE\}\}/g, '');
  }

  return prompt;
}

/**
 * Generate site-specific guidance based on URL patterns
 */
function getSiteSpecificGuidance(url: string): string {
  const guidance: string[] = [];

  // Portland Parks & Rec - LOCATION-BASED organization
  if (url.includes('portland.gov/parks')) {
    guidance.push('\n## ⚠️ CRITICAL: Portland Parks & Recreation - LOCATION-BASED CAMPS\n');
    guidance.push(
      '**Camps are organized by COMMUNITY CENTER. You MUST scrape each location separately.**\n\n',
    );
    guidance.push('### Discovery Steps:\n');
    guidance.push(
      '1. Go to the main camps page and find the list of community center locations\n',
    );
    guidance.push(
      '2. Each location links to ActiveCommunities with a different `site_ids` parameter\n',
    );
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
    guidance.push(
      '  &activity_category_ids=83&activity_category_ids=50&activity_category_ids=68\n',
    );
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
    guidance.push(
      'Look for `site_ids` parameters in URLs - you may need to iterate through multiple.\n\n',
    );
    guidance.push(
      'Wait with `networkidle` AND `page.waitForTimeout(5000)` for React to render.\n\n',
    );
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
  if (
    (url.includes('parks') && url.includes('recreation')) ||
    url.includes('parksandrec')
  ) {
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

/**
 * Run the test-scraper.ts script to test a scraper
 * This uses the same execution path as the Convex executor
 */
async function runTestScript(
  scraperFile: string,
  url: string,
  verbose: boolean = false,
): Promise<TestResult> {
  const { execSync } = require('child_process');
  const log = (msg: string) => {
    writeLog(msg);
    if (verbose) console.log(msg);
  };

  try {
    log(`   Running: npx tsx scripts/test-scraper.ts "${scraperFile}" "${url}"`);

    const output = execSync(`npx tsx scripts/test-scraper.ts "${scraperFile}" "${url}"`, {
      cwd: process.cwd(),
      timeout: 180000, // 3 minute timeout
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    log(`   Test output:\n${output.slice(-1500)}`);

    // Try to parse JSON output first (most reliable)
    const jsonMatch = output.match(/__JSON_START__([\s\S]*?)__JSON_END__/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1].trim());
        if (jsonData.success && jsonData.sessionCount > 0) {
          // Use the actual sample data from the scraper
          const sessions = jsonData.samples.map((s: any) => ({
            name: s.name || '(no name)',
            dates:
              s.startDate && s.endDate ? `${s.startDate} - ${s.endDate}` : s.startDate,
            location: s.location,
            ages:
              s.minAge || s.maxAge
                ? `${s.minAge || '?'}-${s.maxAge || '?'}`
                : undefined,
            price: s.priceInCents
              ? `$${(s.priceInCents / 100).toFixed(2)}`
              : s.priceRaw,
            available: s.isAvailable,
          }));

          // Add count indicator if there are more
          if (jsonData.sessionCount > sessions.length) {
            sessions.push({
              name: `... and ${jsonData.sessionCount - sessions.length} more sessions`,
              _isPlaceholder: true,
            });
          }

          // Return sessions with actual count for recording
          const fullSessions = [];
          for (let i = 0; i < jsonData.sessionCount; i++) {
            if (i < sessions.length) {
              fullSessions.push(sessions[i]);
            } else {
              fullSessions.push({ _index: i + 1 }); // Hidden placeholder for count
            }
          }

          return { sessions: fullSessions, error: undefined };
        }
      } catch (e) {
        log(`   Warning: Failed to parse JSON output: ${e}`);
      }
    }

    // Fallback: Parse text output
    const successMatch = output.match(/SUCCESS: Found (\d+) sessions/);
    if (successMatch) {
      const sessionCount = parseInt(successMatch[1]);
      const sessions: any[] = [
        {
          name: `Found ${sessionCount} sessions`,
          note: 'JSON parsing failed - see test output for details',
        },
      ];

      // Pad to correct count
      while (sessions.length < sessionCount) {
        sessions.push({ _index: sessions.length + 1 });
      }

      return { sessions, error: undefined };
    }

    // Test passed but couldn't parse output
    return {
      sessions: [{ name: 'Test passed but could not parse output' }],
      error: undefined,
    };
  } catch (error: any) {
    // Test failed - extract error message
    const stderr = error.stderr || '';
    const stdout = error.stdout || '';
    const fullOutput = stdout + '\n' + stderr;

    log(`   Test failed:\n${fullOutput.slice(-2000)}`);

    // Try to extract the error message
    let errorMessage = 'Test failed';

    const errorMatch = fullOutput.match(/Error: (.+)/);
    if (errorMatch) {
      errorMessage = errorMatch[1].slice(0, 500);
    } else if (fullOutput.includes('0 sessions')) {
      errorMessage = 'Found 0 sessions - scraper may not be extracting data correctly';
    } else if (fullOutput.includes('timeout')) {
      errorMessage = 'Test timed out - page may be slow to load';
    } else if (error.message) {
      errorMessage = error.message.slice(0, 500);
    }

    return { sessions: [], error: errorMessage };
  }
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
    diagnostics.possibleIssues.push(
      'ActiveCommunities is a React SPA that loads content dynamically',
    );
    diagnostics.possibleIssues.push(
      'DOM selectors will fail - content renders after JavaScript executes',
    );
    diagnostics.suggestedFixes.push(
      'Use page.extract() with Stagehand AI instead of querySelector',
    );
    diagnostics.suggestedFixes.push(
      'Wait for networkidle + additional 5-10 seconds for React hydration',
    );
    diagnostics.suggestedFixes.push(
      'Extract from visible rendered content, not DOM structure',
    );
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
    diagnostics.possibleIssues.push(
      'Scraper relies on DOM selectors which may fail on SPAs',
    );
    diagnostics.suggestedFixes.push(
      'Add fallback using page.extract() for AI extraction',
    );
  }

  if (
    scraperCode.includes("waitUntil: 'domcontentloaded'") &&
    !scraperCode.includes('waitForTimeout')
  ) {
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
      diagnostics.suggestedFixes.push(
        'Implement pagination handling with Load More or Next button clicks',
      );
    }
  }

  return diagnostics;
}

/**
 * Check if 0 sessions is a valid/expected result
 * Returns true for seasonal catalogs, not-yet-published schedules, etc.
 */
function isZeroSessionsValid(
  scraperCode: string,
  url: string,
): { valid: boolean; reason: string; checkAfter?: string } {
  const codeLower = scraperCode.toLowerCase();
  const urlLower = url.toLowerCase();

  // Patterns that indicate scraper intentionally handles 0 sessions
  const seasonalPatterns = [
    {
      pattern: /not (yet )?(published|available|posted|released)/i,
      reason: 'Catalog not yet published',
    },
    { pattern: /coming soon/i, reason: 'Coming soon' },
    { pattern: /check back (later|in|after)/i, reason: 'Seasonal - check back later' },
    {
      pattern: /registration (opens|begins|starts) (in|on|after)/i,
      reason: 'Registration not yet open',
    },
    {
      pattern: /(\d{4}) (summer|camp|program)s? (will be|are) (posted|published|available)/i,
      reason: 'Future catalog - not yet published',
    },
    {
      pattern: /schedule (for )?\d{4} (not|isn't|is not) (yet )?(available|ready|published)/i,
      reason: 'Schedule not yet available',
    },
    { pattern: /late (may|june|winter|spring|summer|fall)/i, reason: 'Seasonal catalog' },
    {
      pattern: /catalog (is )?(empty|unavailable)/i,
      reason: 'Catalog currently empty',
    },
    {
      pattern:
        /no (camps?|sessions?|programs?) (are )?(currently|presently) (listed|available|scheduled)/i,
      reason: 'No programs currently scheduled',
    },
  ];

  for (const { pattern, reason } of seasonalPatterns) {
    if (pattern.test(scraperCode)) {
      // Try to extract a date for when to check again
      const monthMatch = scraperCode.match(
        /(?:after|in|on|by)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{1,2})?\s*,?\s*(\d{4})?/i,
      );
      let checkAfter: string | undefined;
      if (monthMatch) {
        const month = monthMatch[1];
        const day = monthMatch[2] || '1';
        const year = monthMatch[3] || new Date().getFullYear().toString();
        checkAfter = `${month} ${day}, ${year}`;
      }
      return { valid: true, reason, checkAfter };
    }
  }

  // Known sites that have seasonal catalogs
  const seasonalSites = [
    {
      pattern: /pcc\.edu/i,
      reason: 'PCC - publishes catalog late May',
      checkAfter: 'May 28',
    },
    {
      pattern: /college|university/i,
      reason: 'Academic institution - likely seasonal catalog',
    },
  ];

  for (const { pattern, reason, checkAfter } of seasonalSites) {
    if (
      (pattern.test(urlLower) && codeLower.includes('0 sessions')) ||
      codeLower.includes('no sessions') ||
      codeLower.includes('empty')
    ) {
      return { valid: true, reason, checkAfter };
    }
  }

  // Check if scraper explicitly returns empty with explanation
  if (
    codeLower.includes('return []') &&
    (codeLower.includes('// no camps') ||
      codeLower.includes('// empty') ||
      codeLower.includes('// seasonal') ||
      codeLower.includes('// not published'))
  ) {
    return { valid: true, reason: 'Scraper explicitly handles empty state' };
  }

  return { valid: false, reason: '' };
}

/**
 * Generate intelligent auto-feedback when scraper finds 0 sessions
 */
function generateAutoFeedback(url: string, scraperCode: string, testError?: string): string {
  const diagnostics = diagnoseSiteCharacteristics(url, scraperCode);

  const feedback: string[] = ['Automatic diagnosis based on test results:\n'];

  // Site type specific guidance
  if (diagnostics.siteType === 'active_communities') {
    feedback.push('⚠️ CRITICAL: This is an ActiveCommunities site (React SPA).\n');
    feedback.push('The current approach using DOM selectors WILL NOT WORK.\n\n');
    feedback.push('REQUIRED CHANGES:\n');
    feedback.push(
      '1. Navigate directly to the activity search URL with category filters\n',
    );
    feedback.push(
      '2. Wait with networkidle AND page.waitForTimeout(5000) minimum\n',
    );
    feedback.push(
      '3. Use page.extract() with Stagehand AI to extract visible content\n',
    );
    feedback.push(
      '4. DO NOT use querySelector/querySelectorAll - they will fail\n',
    );
    feedback.push(
      '5. The camps render as cards - extract name, dates, price, ages from what you SEE\n\n',
    );
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

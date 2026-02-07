#!/usr/bin/env npx tsx
/**
 * Test Scraper Script
 *
 * Runs a scraper file against a URL and reports results.
 * Used by Claude Code during scraper development to test and iterate.
 *
 * Usage:
 *   npx tsx scripts/test-scraper.ts <scraper-file> <url>
 *
 * Example:
 *   npx tsx scripts/test-scraper.ts .scraper-development/scraper-abc123.ts "https://example.com/camps"
 */

import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

// Load environment
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts
        .join('=')
        .trim()
        .replace(/^["']|["']$/g, '');
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/test-scraper.ts <scraper-file> <url>');
    console.error(
      'Example: npx tsx scripts/test-scraper.ts .scraper-development/scraper-abc123.ts "https://example.com"',
    );
    process.exit(1);
  }

  const scraperFile = args[0];
  const url = args[1];

  console.log('\n' + '='.repeat(60));
  console.log('SCRAPER TEST');
  console.log('='.repeat(60));
  console.log(`File: ${scraperFile}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60) + '\n');

  // Check if file exists
  if (!fs.existsSync(scraperFile)) {
    console.error(`❌ ERROR: Scraper file not found: ${scraperFile}`);
    process.exit(1);
  }

  // Read scraper code
  const scraperCode = fs.readFileSync(scraperFile, 'utf-8');
  console.log(`📄 Loaded scraper code (${scraperCode.length} chars)\n`);

  // Check for required environment variables
  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    console.error('❌ ERROR: Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID');
    process.exit(1);
  }

  if (!process.env.MODEL_API_KEY) {
    console.error('❌ ERROR: Missing MODEL_API_KEY');
    process.exit(1);
  }

  // Import Stagehand
  let Stagehand: any;
  try {
    Stagehand = (await import('@browserbasehq/stagehand')).Stagehand;
  } catch (e) {
    console.error('❌ ERROR: Failed to import Stagehand. Is it installed?');
    process.exit(1);
  }

  let stagehand: any = null;

  try {
    console.log('🚀 Initializing Stagehand...');

    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: {
        modelName: 'anthropic/claude-sonnet-4-20250514',
        apiKey: process.env.MODEL_API_KEY,
      },
      disablePino: true,
      verbose: 0,
    });

    await stagehand.init();
    console.log('✅ Stagehand initialized\n');

    // Get the page
    const page = stagehand.context.pages()[0];

    console.log(`📄 Loading ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeoutMs: 30000 });
    await page.waitForTimeout(3000);
    console.log('✅ Page loaded\n');

    console.log('⚙️ Preparing scraper code...');

    // Strip imports and TypeScript using TypeScript transpiler
    const codeWithoutImports = scraperCode
      .replace(/import\s+.*?from\s+['"][^'"]+['"];?\n?/g, '')
      .replace(/export\s+async\s+function/g, 'async function')
      .replace(/export\s+/g, '');

    const transpileResult = ts.transpileModule(codeWithoutImports, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        removeComments: false,
        declaration: false,
        declarationMap: false,
        sourceMap: false,
      },
    });

    const cleanCode = transpileResult.outputText;

    // Import zod for scrapers
    const { z } = await import('zod');

    // Create and execute the scraper function
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const scraperModule = new AsyncFunction(
      'page',
      'stagehand',
      'z',
      `
      ${cleanCode}
      return await scrape(page);
    `,
    );

    console.log('🏃 Running scraper...\n');

    const startTime = Date.now();
    const sessions = await Promise.race([
      scraperModule(page, stagehand, z),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Scraper timeout (120s)')), 120000)),
    ]);
    const duration = Date.now() - startTime;

    await stagehand.close();
    stagehand = null;

    // Report results
    console.log('='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));

    if (!Array.isArray(sessions)) {
      console.log('❌ FAILED: Scraper did not return an array');
      console.log(`   Returned type: ${typeof sessions}`);
      console.log(`   Value: ${JSON.stringify(sessions)?.slice(0, 200)}`);
      process.exit(1);
    }

    console.log(`✅ SUCCESS: Found ${sessions.length} sessions`);
    console.log(`⏱️ Duration: ${(duration / 1000).toFixed(1)}s\n`);

    if (sessions.length === 0) {
      console.log('⚠️ WARNING: No sessions found!');
      console.log('   - Check if your selectors match the page content');
      console.log("   - Try using page.evaluate() to debug what's on the page");
      console.log("   - Make sure you're waiting long enough for dynamic content");
      process.exit(1);
    }

    // Show sample sessions
    console.log('📋 Sample sessions:');
    console.log('-'.repeat(60));

    const samples = sessions.slice(0, 3);
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      console.log(`\n[${i + 1}] ${s.name || '(no name)'}`);
      if (s.startDate || s.endDate) console.log(`    📅 Dates: ${s.startDate || '?'} - ${s.endDate || '?'}`);
      if (s.dateRaw) console.log(`    📅 Raw: ${s.dateRaw}`);
      if (s.dropOffHour !== undefined)
        console.log(
          `    ⏰ Time: ${s.dropOffHour}:${String(s.dropOffMinute || 0).padStart(2, '0')} - ${s.pickUpHour}:${String(s.pickUpMinute || 0).padStart(2, '0')}`,
        );
      if (s.timeRaw) console.log(`    ⏰ Raw: ${s.timeRaw}`);
      if (s.location) console.log(`    📍 Location: ${s.location}`);
      if (s.minAge || s.maxAge) console.log(`    👤 Ages: ${s.minAge || '?'}-${s.maxAge || '?'}`);
      if (s.minGrade !== undefined || s.maxGrade !== undefined)
        console.log(`    🎓 Grades: ${s.minGrade ?? '?'}-${s.maxGrade ?? '?'}`);
      if (s.priceInCents) console.log(`    💰 Price: $${(s.priceInCents / 100).toFixed(2)}`);
      if (s.priceRaw) console.log(`    💰 Raw: ${s.priceRaw}`);
      if (s.registrationUrl) console.log(`    🔗 URL: ${s.registrationUrl.slice(0, 60)}...`);
      if (s.isAvailable !== undefined) console.log(`    ✅ Available: ${s.isAvailable}`);
    }

    if (sessions.length > 3) {
      console.log(`\n... and ${sessions.length - 3} more sessions`);
    }

    // Check for missing critical fields
    console.log('\n' + '-'.repeat(60));
    console.log('📊 Field coverage:');

    const fieldCounts: Record<string, number> = {};
    const criticalFields = ['name', 'startDate', 'location', 'priceInCents'];

    for (const session of sessions) {
      for (const field of Object.keys(session)) {
        if (session[field] !== undefined && session[field] !== null && session[field] !== '') {
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        }
      }
    }

    for (const field of criticalFields) {
      const count = fieldCounts[field] || 0;
      const pct = Math.round((count / sessions.length) * 100);
      const status = pct >= 80 ? '✅' : pct >= 50 ? '⚠️' : '❌';
      console.log(`   ${status} ${field}: ${count}/${sessions.length} (${pct}%)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST PASSED ✅');
    console.log('='.repeat(60) + '\n');

    // Output JSON for daemon parsing (marked with special delimiters)
    console.log('__JSON_START__');
    console.log(
      JSON.stringify({
        success: true,
        sessionCount: sessions.length,
        samples: sessions.slice(0, 5).map((s) => ({
          name: s.name,
          startDate: s.startDate,
          endDate: s.endDate,
          location: s.location,
          minAge: s.minAge,
          maxAge: s.maxAge,
          priceInCents: s.priceInCents,
          priceRaw: s.priceRaw,
          isAvailable: s.isAvailable,
        })),
      }),
    );
    console.log('__JSON_END__');
  } catch (error) {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {
        // Ignore close errors
      }
    }

    console.log('='.repeat(60));
    console.log('TEST FAILED ❌');
    console.log('='.repeat(60));

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`\nError: ${errorMessage}\n`);

    // Provide helpful suggestions based on error
    if (errorMessage.includes('credit balance')) {
      console.log('💡 FIX: Anthropic API credits are low. This is not a code issue.');
      console.log('   Wait for credits to be refilled or use a different API key.\n');
    } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      console.log('💡 FIX: Rate limited. Add delays between requests:');
      console.log('   await page.waitForTimeout(2000);\n');
    } else if (errorMessage.includes('timeout')) {
      console.log('💡 FIX: Page is slow to load. Try:');
      console.log('   - Increase timeout: { timeoutMs: 60000 }');
      console.log("   - Use waitUntil: 'networkidle'\n");
    } else if (errorMessage.includes('extract is not a function')) {
      console.log('💡 FIX: Use stagehand.extract() not page.extract()');
      console.log('   The stagehand object is available in the scraper scope.\n');
    } else if (errorMessage.includes('Cannot read') || errorMessage.includes('undefined')) {
      console.log('💡 FIX: Null/undefined error. Add null checks:');
      console.log("   const value = element?.textContent?.trim() || '';\n");
    } else if (errorMessage.includes('Missing initializer')) {
      console.log('💡 FIX: TypeScript syntax error. Simplify type annotations.\n');
    }

    // Show stack trace for debugging
    if (error instanceof Error && error.stack) {
      console.log('Stack trace:');
      console.log(error.stack.split('\n').slice(0, 5).join('\n'));
    }

    console.log('\n' + '='.repeat(60) + '\n');
    process.exit(1);
  }
}

main();

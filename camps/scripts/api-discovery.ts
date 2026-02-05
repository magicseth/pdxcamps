#!/usr/bin/env npx ts-node

/**
 * API Discovery Tool
 *
 * Uses Browserbase to load a page in a real browser,
 * monitor network requests, and discover which APIs contain the data we need.
 *
 * Usage:
 *   npx tsx scripts/api-discovery.ts <url> [search_term]
 *
 * Examples:
 *   npx tsx scripts/api-discovery.ts "https://omsi.edu/camps"
 *   npx tsx scripts/api-discovery.ts "https://trackerspdx.com/youth/camps/summer-camp/mariners/" "Mariners"
 *
 * This will:
 * 1. Open the URL in a real browser (via Browserbase)
 * 2. Capture all network requests
 * 3. Report all JSON APIs found (or filter by search term if provided)
 */

import { chromium } from "playwright";
import Browserbase from "@browserbasehq/sdk";
import * as path from "path";
import * as fs from "fs";

// Load environment from .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const trimmedKey = key.trim();
      if (!process.env[trimmedKey]) {
        process.env[trimmedKey] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

interface NetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  responseStatus?: number;
  responseBody?: string;
  responseSize?: number;
  contentType?: string;
  containsSearchTerm?: boolean;
  matchCount?: number;
  jsonStructure?: string;
}

async function discoverApis(targetUrl: string, searchTerm?: string) {
  console.log(`\n🔍 API Discovery Tool`);
  console.log(`   URL: ${targetUrl}`);
  if (searchTerm) {
    console.log(`   Search term: "${searchTerm}"`);
  } else {
    console.log(`   Mode: Discover all JSON APIs`);
  }
  console.log();

  const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY,
  });

  const capturedRequests: NetworkRequest[] = [];
  let browser: any = null;

  try {
    console.log("🌐 Creating Browserbase session...");
    const session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
    });
    console.log(`   Session ID: ${session.id}`);

    browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0];

    // Set up network monitoring
    page.on("request", (request: any) => {
      const url = request.url();
      const resourceType = request.resourceType();
      // Capture XHR, fetch, and anything that looks like an API
      if (["xhr", "fetch"].includes(resourceType) || url.includes("/api/") || url.includes("graphql")) {
        capturedRequests.push({
          url,
          method: request.method(),
          resourceType,
        });
      }
    });

    page.on("response", async (response: any) => {
      const url = response.url();
      const trackedRequest = capturedRequests.find(r => r.url === url && !r.responseStatus);

      if (trackedRequest) {
        trackedRequest.responseStatus = response.status();
        trackedRequest.contentType = response.headers()["content-type"] || "";

        try {
          // Capture JSON responses
          if (response.status() === 200 && trackedRequest.contentType.includes("application/json")) {
            const body = await response.text();
            trackedRequest.responseBody = body;
            trackedRequest.responseSize = body.length;

            // Parse and analyze structure
            try {
              const json = JSON.parse(body);
              if (Array.isArray(json)) {
                trackedRequest.jsonStructure = `Array[${json.length}]`;
                if (json.length > 0 && typeof json[0] === "object") {
                  const keys = Object.keys(json[0]).slice(0, 5);
                  trackedRequest.jsonStructure += ` { ${keys.join(", ")}${Object.keys(json[0]).length > 5 ? ", ..." : ""} }`;
                }
              } else if (typeof json === "object" && json !== null) {
                const keys = Object.keys(json).slice(0, 5);
                trackedRequest.jsonStructure = `Object { ${keys.join(", ")}${Object.keys(json).length > 5 ? ", ..." : ""} }`;
              }
            } catch {
              trackedRequest.jsonStructure = "(parse error)";
            }

            // Check for search term if provided
            if (searchTerm && body.toLowerCase().includes(searchTerm.toLowerCase())) {
              trackedRequest.containsSearchTerm = true;
              const regex = new RegExp(searchTerm, "gi");
              trackedRequest.matchCount = (body.match(regex) || []).length;
            }
          }
        } catch {
          // Body not available
        }
      }
    });

    console.log("📡 Loading page and capturing network requests...\n");

    // Use domcontentloaded to avoid timeout, then wait for XHR
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for dynamic content to load
    console.log("   Waiting for dynamic content...");
    await page.waitForTimeout(5000);

    // Scroll down to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Analyze results
    console.log(`\n📊 Network Analysis Results`);
    console.log(`   Total requests captured: ${capturedRequests.length}`);

    // Filter to JSON responses only
    const jsonRequests = capturedRequests.filter(r =>
      r.responseStatus === 200 && r.responseBody && r.responseSize && r.responseSize > 100
    );

    console.log(`   JSON responses: ${jsonRequests.length}\n`);

    if (jsonRequests.length === 0) {
      console.log(`❌ No JSON API responses found\n`);

      // Show all captured requests for debugging
      console.log(`📋 All captured requests:`);
      for (const req of capturedRequests.slice(0, 20)) {
        console.log(`   ${req.method} ${req.responseStatus || "?"} ${req.url.slice(0, 80)}`);
      }
      return;
    }

    // If search term provided, filter and show matching
    if (searchTerm) {
      const matchingRequests = jsonRequests.filter(r => r.containsSearchTerm);

      if (matchingRequests.length === 0) {
        console.log(`❌ No API responses found containing "${searchTerm}"\n`);
        console.log(`📋 JSON APIs found (showing all):\n`);
      } else {
        console.log(`✅ Found ${matchingRequests.length} API(s) containing "${searchTerm}":\n`);
        matchingRequests.sort((a, b) => (b.matchCount || 0) - (a.matchCount || 0));

        for (const req of matchingRequests) {
          console.log(`   🎯 ${req.method} ${req.url}`);
          console.log(`      Matches: ${req.matchCount} | Size: ${((req.responseSize || 0) / 1024).toFixed(1)} KB`);
          if (req.jsonStructure) console.log(`      Structure: ${req.jsonStructure}`);
          console.log();
        }

        const best = matchingRequests[0];
        console.log(`\n💡 Recommended API: ${best.url}`);
        const pattern = extractUrlPattern(best.url);
        if (pattern) console.log(`   Pattern: ${pattern}`);
        console.log();
        return;
      }
    }

    // Show all JSON APIs sorted by size (larger = more data = more interesting)
    jsonRequests.sort((a, b) => (b.responseSize || 0) - (a.responseSize || 0));

    console.log(`📋 JSON APIs found (sorted by response size):\n`);

    for (const req of jsonRequests.slice(0, 15)) {
      const sizeKB = ((req.responseSize || 0) / 1024).toFixed(1);
      console.log(`   ${req.method} ${req.url.length > 70 ? req.url.slice(0, 70) + "..." : req.url}`);
      console.log(`      Size: ${sizeKB} KB | ${req.jsonStructure || "unknown structure"}`);
      console.log();
    }

    if (jsonRequests.length > 15) {
      console.log(`   ... and ${jsonRequests.length - 15} more\n`);
    }

    // Show the largest as the most promising
    const largest = jsonRequests[0];
    console.log(`💡 Largest API (most likely to have data):`);
    console.log(`   ${largest.url}`);
    console.log(`   Size: ${((largest.responseSize || 0) / 1024).toFixed(1)} KB`);

    // Show sample of the data
    if (largest.responseBody) {
      try {
        const json = JSON.parse(largest.responseBody);
        console.log(`\n📝 Sample data preview:`);
        const preview = JSON.stringify(json, null, 2).slice(0, 1500);
        console.log(preview + (preview.length >= 1500 ? "\n   ..." : ""));
      } catch {
        // Skip preview
      }
    }

  } catch (error) {
    console.error("Error during API discovery:", error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function extractUrlPattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);

    const pattern = pathParts.map(part => {
      if (/^\d+$/.test(part)) return "{id}";
      if (/^[a-f0-9-]{36}$/i.test(part)) return "{uuid}";
      return part;
    }).join("/");

    return `${parsed.origin}/${pattern}`;
  } catch {
    return null;
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(`
Usage: npx tsx scripts/api-discovery.ts <url> [search_term]

Examples:
  npx tsx scripts/api-discovery.ts "https://omsi.edu/camps"
  npx tsx scripts/api-discovery.ts "https://trackerspdx.com/camps" "Summer"

This tool helps discover hidden APIs by:
1. Loading the page in a real browser
2. Monitoring all XHR/fetch requests
3. Showing all JSON APIs found (or filtering by search term)
`);
  process.exit(1);
}

const [targetUrl, searchTerm] = args;

discoverApis(targetUrl, searchTerm).catch(console.error);

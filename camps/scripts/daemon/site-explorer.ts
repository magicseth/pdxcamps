/**
 * Site exploration logic for the scraper daemon.
 * Analyzes camp website structure, navigation, and directory detection.
 */

import { SiteExplorationResult } from './types';
import { createStagehand, StagehandClass, writeLog } from './shared';

/**
 * Explore a camp website's navigation structure using browser automation + AI extraction.
 * Detects locations, categories, registration systems, URL patterns, and directory sites.
 */
export async function exploreSiteNavigation(
  url: string,
  sourceName: string,
  log: (msg: string) => void,
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
  if (!StagehandClass) {
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
    stagehand = await createStagehand('sonnet');
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

5. **Directory detection**: Is this a listing/directory of multiple different camp organizations,
   rather than a single camp's own website?

Return a structured analysis of how camps are organized on this site.`,
      schema: {
        type: 'object',
        properties: {
          organizationType: {
            type: 'string',
            description:
              "How camps are organized: 'by_location', 'by_category', 'by_age', 'single_list', 'calendar', or 'unknown'",
          },
          locations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                linkText: { type: 'string' },
                urlPattern: { type: 'string' },
              },
            },
            description: 'List of locations/facilities if camps are organized by location',
          },
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
              },
            },
            description: 'List of camp categories if organized that way',
          },
          externalRegistration: {
            type: 'object',
            properties: {
              platform: { type: 'string' },
              baseUrl: { type: 'string' },
              urlParameters: { type: 'array', items: { type: 'string' } },
            },
            description: 'External registration system details if applicable',
          },
          navigationInstructions: {
            type: 'string',
            description: 'Step-by-step instructions for how to navigate to find ALL camps',
          },
          estimatedCampCount: {
            type: 'string',
            description: 'Rough estimate of how many camps/sessions this org offers',
          },
          isDirectory: {
            type: 'boolean',
            description:
              "Is this a listing/directory of multiple different camp organizations (not a single camp's own site)?",
          },
        },
      },
    });

    const extracted = extraction as {
      organizationType?: string;
      locations?: Array<{ name: string; linkText?: string; urlPattern?: string }>;
      categories?: Array<{ name: string; description?: string }>;
      externalRegistration?: { platform?: string; baseUrl?: string; urlParameters?: string[] };
      navigationInstructions?: string;
      estimatedCampCount?: string;
      isDirectory?: boolean;
    };

    log(`   ✅ Site analysis complete`);

    // Process the extraction results
    if (extracted.organizationType) {
      result.siteType = extracted.organizationType;
    }

    if (extracted.locations && extracted.locations.length > 0) {
      result.hasMultipleLocations = true;
      result.locations = extracted.locations.map((loc) => ({
        name: loc.name,
        url: loc.urlPattern,
      }));
      result.navigationNotes.push(
        `Found ${extracted.locations.length} locations: ${extracted.locations.map((l) => l.name).join(', ')}`,
      );
    }

    if (extracted.categories && extracted.categories.length > 0) {
      result.hasCategories = true;
      result.categories = extracted.categories.map((cat) => ({
        name: cat.name,
      }));
      result.navigationNotes.push(
        `Found ${extracted.categories.length} categories: ${extracted.categories.map((c) => c.name).join(', ')}`,
      );
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
          type: 'object',
          properties: {
            locationLinks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  locationName: { type: 'string' },
                  url: { type: 'string' },
                  siteIdOrParam: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const links = linkExtraction as {
        locationLinks?: Array<{ locationName: string; url: string; siteIdOrParam?: string }>;
      };

      if (links.locationLinks && links.locationLinks.length > 0) {
        result.locations = links.locationLinks.map((link) => ({
          name: link.locationName,
          url: link.url,
          siteId: link.siteIdOrParam,
        }));

        // Extract URL pattern
        const urls = links.locationLinks.map((l) => l.url).filter((u) => u);
        if (urls.length > 0) {
          result.urlPatterns.push(urls[0]);
        }
      }
    }

    // Check if this is a directory/listing site (lists multiple camp organizations)
    const urlLower = url.toLowerCase();
    const directoryIndicators = [
      'kidsoutandabout.com',
      'parentmap.com',
      'seattlesummercamps.com',
      'summercamps.com',
      'campnavigator.com',
      'kidscamps.com',
      'activityhero.com',
      'sawyer.com',
      'acacamps.org',
      '/guide',
      '/list',
      '/directory',
      '/best-',
      '/top-',
    ];

    // Fix: parseInt fails on "many", "dozens", "50+" - use regex fallback
    const count = parseInt(extracted.estimatedCampCount || '');
    const isHighCount =
      (!isNaN(count) && count > 20) ||
      /many|dozen|numerous|lots|50\+|100/i.test(extracted.estimatedCampCount || '');

    const isLikelyDirectory =
      directoryIndicators.some((ind) => urlLower.includes(ind)) ||
      isHighCount ||
      extracted.isDirectory === true;

    if (isLikelyDirectory) {
      log(`   📂 Detected directory/listing site - extracting camp links...`);
      result.isDirectory = true;

      // Extract both external camp organization links AND internal camp detail pages
      // Many directory sites host camp details internally (e.g., kidsoutandabout.com/content/camp-name)
      const dirLinks = await page.evaluate(() => {
        const links: Array<{ url: string; name: string; isInternal: boolean }> = [];
        const seenUrls = new Set<string>();
        const seenDomains = new Set<string>();
        const hostDomain = window.location.hostname.replace(/^www\./, '');
        const currentPath = window.location.pathname;

        // Patterns that indicate a camp detail page (internal links)
        const campDetailPatterns = [
          /\/content\/.*camp/i,
          /\/camp[s]?\/[^/]+$/i,
          /\/program[s]?\/[^/]+$/i,
          /\/activit(y|ies)\/[^/]+$/i,
          /\/class(es)?\/[^/]+$/i,
          /\/event[s]?\/.*camp/i,
          /\/listing[s]?\/[^/]+$/i,
          /\/provider[s]?\/[^/]+$/i,
          /\/organization[s]?\/[^/]+$/i,
          /\/venue[s]?\/[^/]+$/i,
          /camp.*-\d{4}$/i, // e.g., "summer-camp-2026"
        ];

        // Patterns to exclude (navigation, pagination, filters)
        const excludePatterns = [
          /\/search/i,
          /\/filter/i,
          /\/page\/\d+/i,
          /\/category\//i,
          /\/tag\//i,
          /\/author\//i,
          /\/login/i,
          /\/register/i,
          /\/cart/i,
          /\/checkout/i,
          /\/account/i,
          /\/about/i,
          /\/contact/i,
          /\/privacy/i,
          /\/terms/i,
          /\/faq/i,
          /^\/?$/, // Homepage
        ];

        // Social and non-camp domains to skip
        const skipDomains =
          /facebook|twitter|instagram|linkedin|youtube|google|yelp|tripadvisor|amazon|pinterest|reddit|tiktok|snapchat/i;

        document.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (!href) return;

          try {
            // Handle both absolute and relative URLs
            const url = new URL(href, window.location.origin);
            const fullUrl = url.href;
            const domain = url.hostname.replace(/^www\./, '');
            const path = url.pathname;

            // Skip if we've seen this exact URL
            if (seenUrls.has(fullUrl)) return;

            // Skip excluded patterns
            if (excludePatterns.some((p) => p.test(path))) return;

            // Skip current page
            if (path === currentPath) return;

            const isInternal = domain === hostDomain;
            const name = a.textContent?.trim() || '';

            if (isInternal) {
              // For internal links, check if it looks like a camp detail page
              const isCampDetail = campDetailPatterns.some((p) => p.test(path));

              // Also check if the link text suggests it's a camp
              const textSuggestsCamp = /camp|program|class|activity|workshop|lesson/i.test(name);

              if (isCampDetail || textSuggestsCamp) {
                seenUrls.add(fullUrl);
                if (name.length > 2 && name.length < 200) {
                  links.push({ url: fullUrl, name, isInternal: true });
                }
              }
            } else {
              // For external links, collect camp organization websites
              if (skipDomains.test(domain)) return;
              if (seenDomains.has(domain)) return;

              seenDomains.add(domain);
              seenUrls.add(fullUrl);
              const linkName = name.length > 2 ? name : domain.split('.')[0];
              if (linkName.length > 2 && linkName.length < 200) {
                links.push({ url: fullUrl, name: linkName, isInternal: false });
              }
            }
          } catch {}
        });

        return links;
      });

      const externalLinks = dirLinks.filter((l: any) => !l.isInternal);
      const internalLinks = dirLinks.filter((l: any) => l.isInternal);

      log(`   ✅ Found ${externalLinks.length} external camp org links`);
      log(`   ✅ Found ${internalLinks.length} internal camp detail pages`);

      if (dirLinks.length > 0) {
        result.directoryLinks = dirLinks;
        log(`   ✅ Total: ${dirLinks.length} camp links found in directory`);
      }
    }

    await stagehand.close();
    stagehand = null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`   ⚠️ Exploration error: ${errorMsg.slice(0, 100)}`);
    result.navigationNotes.push(`Exploration encountered error: ${errorMsg.slice(0, 200)}`);

    if (stagehand) {
      try {
        await stagehand.close();
      } catch {}
    }
  }

  // Log summary
  log(`   📊 Exploration results:`);
  log(`      Site type: ${result.siteType}`);
  if (result.isDirectory) {
    log(`      📂 DIRECTORY: ${result.directoryLinks?.length || 0} camp links found`);
  }
  log(`      Locations: ${result.locations.length}`);
  log(`      Categories: ${result.categories.length}`);
  log(`      Registration system: ${result.registrationSystem || 'unknown'}`);

  return result;
}

/**
 * Format exploration results for inclusion in the prompt
 */
export function formatExplorationForPrompt(exploration: SiteExplorationResult): string {
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

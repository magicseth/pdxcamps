'use node';

/**
 * Pipeline Orchestrator — One-click market pipeline
 *
 * Runs the full discovery pipeline for a market:
 * 1. Use Claude web_search to discover directory/listing sites for the region
 * 2. Create directory records for discovered + known directory sites
 * 3. Crawl each directory to extract organizations
 * 4. Queue scraper development for orgs without scrapers
 *
 * Progress is tracked reactively via the directories and scraperDevelopmentRequests tables.
 */

import { action } from '../_generated/server';
import { api } from '../_generated/api';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import Anthropic from '@anthropic-ai/sdk';

// Known camp directory domains — we always check these
const KNOWN_DIRECTORY_TEMPLATES = [
  {
    domain: 'activityhero.com',
    name: 'ActivityHero',
    urlTemplate: 'https://www.activityhero.com/summer-camps/{city}-{state}',
    type: 'aggregator' as const,
  },
  {
    domain: 'sawyer.com',
    name: 'Sawyer',
    urlTemplate: 'https://www.sawyer.com/find/camps/{city}-{state}',
    type: 'aggregator' as const,
  },
];

interface DiscoveredDirectory {
  name: string;
  url: string;
  domain: string;
  type: 'aggregator' | 'municipal' | 'curated_list' | 'search_result';
}

interface PipelineResult {
  directoriesDiscovered: number;
  directoriesCreated: number;
  directoriesCrawled: number;
  totalOrgsCreated: number;
  directoryStats: {
    total: number;
    crawled: number;
    pending: number;
    failed: number;
    excluded: number;
    orgsExtracted: number;
  };
  errors: string[];
}

/**
 * Use Claude web_search to find camp directories & listing pages for a region
 */
async function discoverDirectories(
  regionName: string,
  cityName: string,
  stateName: string,
): Promise<DiscoveredDirectory[]> {
  const anthropic = new Anthropic({ apiKey: process.env.MODEL_API_KEY });

  const currentYear = new Date().getFullYear();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
      } as any,
    ],
    messages: [
      {
        role: 'user',
        content: `Find summer camp directory and listing websites for ${regionName}. I need websites that LIST MULTIPLE camp organizations — not individual camp providers.

Search for:
1. "${cityName} summer camp directory"
2. "${regionName} summer camps ${currentYear}"
3. "${cityName} kids camp list ${stateName}"
4. "${cityName} parks and recreation summer camps"
5. "${cityName} YMCA summer camps"

I'm looking for:
- **Aggregator sites** (ActivityHero, Sawyer, CampSearch, etc.) with a page for this region
- **Municipal/parks dept pages** that list multiple camp programs
- **Curated "best of" lists** from local publications or parent blogs
- **Local directories** that compile camp options

DO NOT include:
- Individual camp provider websites (single org, not a directory)
- Social media pages
- News articles that aren't camp lists
- Generic national directories without region-specific pages

For each directory found, provide:
- name: Name of the directory/site
- url: The specific URL for this region's camp listing (not just the homepage)
- type: "aggregator" | "municipal" | "curated_list" | "search_result"

Format as JSON:
\`\`\`json
[
  {"name": "ActivityHero Portland", "url": "https://www.activityhero.com/summer-camps/portland-oregon", "type": "aggregator"},
  {"name": "Portland Parks & Rec Summer Camps", "url": "https://www.portland.gov/parks/summer-camps", "type": "municipal"}
]
\`\`\``,
      },
    ],
  });

  const directories: DiscoveredDirectory[] = [];
  const seenDomains = new Set<string>();

  // Collect all text from the response (may span multiple content blocks)
  const allText = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  if (allText) {
    const jsonMatch = allText.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        for (const item of parsed) {
          if (!item.url || !item.name) continue;

          let domain: string;
          try {
            domain = new URL(item.url).hostname.replace(/^www\./, '');
          } catch {
            continue;
          }

          if (seenDomains.has(domain)) continue;
          seenDomains.add(domain);

          const validTypes = ['aggregator', 'municipal', 'curated_list', 'search_result'];
          const type = validTypes.includes(item.type) ? item.type : 'search_result';

          directories.push({
            name: item.name,
            url: item.url,
            domain,
            type,
          });
        }
      } catch (e) {
        console.error('Failed to parse directory discovery JSON:', e);
      }
    } else {
      console.log('No JSON block found in Claude response. Response text:', allText.slice(0, 500));
    }
  } else {
    console.log('No text content in Claude response. Content types:', response.content.map((c) => c.type));
  }

  return directories;
}

/**
 * Run the full market pipeline for a city
 */
export const runMarketPipeline = action({
  args: {
    cityId: v.id('cities'),
  },
  handler: async (ctx, args): Promise<PipelineResult> => {
    // Get city info
    const city = await ctx.runQuery(api.cities.queries.getCityById, {
      cityId: args.cityId,
    });

    if (!city) {
      throw new Error('City not found');
    }

    const citySlug = city.slug;
    const stateSlug = city.state.toLowerCase().replace(/\s+/g, '-');
    const regionName = `${city.name}, ${city.state}`;

    let directoriesCreated = 0;
    let directoriesDiscovered = 0;
    const errors: string[] = [];

    // ===== Step 1: Discover directories via Claude web_search =====
    try {
      const discovered = await discoverDirectories(regionName, city.name, city.state);
      directoriesDiscovered = discovered.length;

      for (const dir of discovered) {
        try {
          await ctx.runMutation(api.scraping.directories.createDirectory, {
            cityId: args.cityId,
            name: dir.name,
            url: dir.url,
            domain: dir.domain,
            directoryType: dir.type,
            discoveredFrom: 'web_search',
          });
          directoriesCreated++;
        } catch {
          // Duplicate URL — already exists
        }
      }
    } catch (err) {
      errors.push(`Directory discovery: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // ===== Step 2: Add known directory templates =====
    for (const template of KNOWN_DIRECTORY_TEMPLATES) {
      const url = template.urlTemplate
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug);

      try {
        await ctx.runMutation(api.scraping.directories.createDirectory, {
          cityId: args.cityId,
          name: `${template.name} ${city.name}`,
          url,
          domain: template.domain,
          directoryType: template.type,
          discoveredFrom: 'known_list',
        });
        directoriesCreated++;
      } catch {
        // Duplicate URL — already exists
      }
    }

    // ===== Step 3: Crawl all discovered/failed directories =====
    const directories: Array<{
      _id: Id<'directories'>;
      name: string;
      status: string;
    }> = await ctx.runQuery(api.scraping.directories.listDirectoriesForCity, {
      cityId: args.cityId,
    });

    const toCrawl = directories.filter(
      (d) => d.status === 'discovered' || d.status === 'failed',
    );

    let directoriesCrawled = 0;
    let totalOrgsCreated = 0;

    for (const dir of toCrawl) {
      try {
        const result: { success: boolean; error?: string; orgsCreated?: number } =
          await ctx.runAction(api.scraping.newDirectoryActions.crawlDirectory, {
            directoryId: dir._id,
          });

        if (result.success) {
          directoriesCrawled++;
          totalOrgsCreated += result.orgsCreated || 0;
        } else {
          errors.push(`${dir.name}: ${result.error}`);
        }
      } catch (err) {
        errors.push(`${dir.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // ===== Step 4: Return stats =====
    const stats: PipelineResult['directoryStats'] = await ctx.runQuery(
      api.scraping.directories.getDirectoryStats,
      { cityId: args.cityId },
    );

    return {
      directoriesDiscovered,
      directoriesCreated,
      directoriesCrawled,
      totalOrgsCreated,
      directoryStats: stats,
      errors: errors.slice(0, 10),
    };
  },
});

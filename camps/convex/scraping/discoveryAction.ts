'use node';

/**
 * Claude-Powered Market Discovery
 *
 * Uses Claude API with web search to discover camp organizations for a city.
 * Replaces the local Stagehand daemon for market discovery.
 *
 * Flow:
 * 1. Claim a pending marketDiscoveryTask
 * 2. Use Claude to search for camp organizations
 * 3. Extract structured org data (name, website, description)
 * 4. Feed into existing createOrgsFromDiscoveredUrls pipeline
 */

import { internalAction } from '../_generated/server';
import { api, internal } from '../_generated/api';
import { v } from 'convex/values';
import Anthropic from '@anthropic-ai/sdk';

const client = () =>
  new Anthropic({
    apiKey: process.env.MODEL_API_KEY,
  });

interface DiscoveredOrg {
  url: string;
  source: string;
  title: string;
  domain: string;
}

/**
 * Execute discovery for a single market discovery task.
 * Claims the task, searches via Claude, and processes results.
 */
export const executeDiscoveryForTask = internalAction({
  args: {
    taskId: v.id('marketDiscoveryTasks'),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    urlsDiscovered: number;
    orgsCreated: number;
    error?: string;
  }> => {
    // Claim the task
    const task: any = await ctx.runMutation(api.scraping.marketDiscovery.claimDiscoveryTask, {
      taskId: args.taskId,
      sessionId: 'claude-discovery-daemon',
    });

    if (!task) {
      return { success: false, urlsDiscovered: 0, orgsCreated: 0, error: 'Task not found or already claimed' };
    }

    try {
      const searchQueries = task.searchQueries as string[];
      const regionName = task.regionName as string;
      const allDiscoveredUrls: DiscoveredOrg[] = [];
      const seenDomains = new Set<string>();

      // Process search queries in batches of 3
      for (let i = 0; i < searchQueries.length; i += 3) {
        const batch = searchQueries.slice(i, i + 3);
        const batchPrompt = batch.map((q, idx) => `${idx + 1}. "${q}"`).join('\n');

        const anthropic = client();
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          tools: [
            {
              type: 'web_search' as any,
              name: 'web_search',
            } as any,
          ],
          messages: [
            {
              role: 'user',
              content: `You are helping discover summer camp organizations in ${regionName}. Search for each of these queries and find camp organization websites:

${batchPrompt}

For each unique organization you find, provide:
- The organization name
- Their website URL (the main domain, not a specific page)
- A brief description of what camps they offer

IMPORTANT:
- Only include organizations that run summer camps for kids/teens
- Skip directories/aggregators (like ActivityHero, CampSearch, etc.)
- Skip social media pages, news articles, and job boards
- Include parks departments, YMCAs, museums, nonprofits, and private camp providers
- Deduplicate by domain — only list each organization once

Format your response as a JSON array at the end, wrapped in \`\`\`json blocks:
\`\`\`json
[
  {"name": "Org Name", "url": "https://example.com", "description": "Brief description"}
]
\`\`\``,
            },
          ],
        });

        // Extract JSON from response
        const textContent = response.content.find((c) => c.type === 'text');
        if (textContent && textContent.type === 'text') {
          const jsonMatch = textContent.text.match(/```json\s*([\s\S]*?)```/);
          if (jsonMatch) {
            try {
              const orgs = JSON.parse(jsonMatch[1]);
              for (const org of orgs) {
                if (!org.url || !org.name) continue;

                // Extract domain
                let domain: string;
                try {
                  domain = new URL(org.url).hostname.replace(/^www\./, '');
                } catch {
                  continue;
                }

                // Dedupe by domain
                if (seenDomains.has(domain)) continue;
                seenDomains.add(domain);

                allDiscoveredUrls.push({
                  url: org.url,
                  source: 'claude-discovery',
                  title: org.name,
                  domain,
                });
              }
            } catch {
              console.error('Failed to parse JSON from Claude response');
            }
          }
        }

        // Update progress
        await ctx.runMutation(api.scraping.marketDiscovery.updateDiscoveryProgress, {
          taskId: args.taskId,
          searchesCompleted: Math.min(i + 3, searchQueries.length),
          urlsDiscovered: allDiscoveredUrls.length,
        });
      }

      if (allDiscoveredUrls.length === 0) {
        await ctx.runMutation(api.scraping.marketDiscovery.completeDiscoveryTask, {
          taskId: args.taskId,
          orgsCreated: 0,
          orgsExisted: 0,
          sourcesCreated: 0,
        });
        return { success: true, urlsDiscovered: 0, orgsCreated: 0 };
      }

      // Process discovered URLs through existing pipeline
      const result: { created: number; existed: number; sourcesCreated: number } = await ctx.runMutation(
        api.scraping.marketDiscovery.createOrgsFromDiscoveredUrls,
        {
          taskId: args.taskId,
          urls: allDiscoveredUrls.map((u) => ({ url: u.url, title: u.title, domain: u.domain })),
        },
      );

      // Complete the task
      await ctx.runMutation(api.scraping.marketDiscovery.completeDiscoveryTask, {
        taskId: args.taskId,
        orgsCreated: result.created,
        orgsExisted: result.existed,
        sourcesCreated: result.sourcesCreated,
      });

      return {
        success: true,
        urlsDiscovered: allDiscoveredUrls.length,
        orgsCreated: result.created,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Discovery failed for task ${args.taskId}:`, errorMsg);

      await ctx.runMutation(api.scraping.marketDiscovery.failDiscoveryTask, {
        taskId: args.taskId,
        error: errorMsg,
      });

      return { success: false, urlsDiscovered: 0, orgsCreated: 0, error: errorMsg };
    }
  },
});

/**
 * Process all pending discovery tasks.
 * Can be called by cron or manually.
 */
export const processPendingDiscoveryTasks = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; results: Array<{ taskId: string; success: boolean; orgsCreated: number }> }> => {
    const tasks: any[] = await ctx.runQuery(api.scraping.marketDiscovery.getPendingDiscoveryTasks, {});

    const results: Array<{ taskId: string; success: boolean; orgsCreated: number }> = [];

    for (const task of tasks) {
      const result = await ctx.runAction(internal.scraping.discoveryAction.executeDiscoveryForTask, {
        taskId: task._id,
      });
      results.push({
        taskId: task._id,
        success: result.success,
        orgsCreated: result.orgsCreated,
      });
    }

    return { processed: results.length, results };
  },
});

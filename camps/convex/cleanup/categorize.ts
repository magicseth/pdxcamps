'use node';

import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import Anthropic from '@anthropic-ai/sdk';

const VALID_CATEGORIES = [
  'Sports',
  'Arts',
  'STEM',
  'Nature',
  'Music',
  'Academic',
  'Drama',
  'Adventure',
  'Cooking',
  'Dance',
];

/**
 * Use AI to categorize a single batch of camps.
 * Schedules itself for the next batch if more remain.
 */
export const categorizeCampsWithAI = internalAction({
  args: {
    cityId: v.optional(v.id('cities')),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 50;

    const client = new Anthropic({
      apiKey: process.env.MODEL_API_KEY,
    });

    const result = await ctx.runMutation(internal.cleanup.sessions.getUncategorizedCamps, {
      cityId: args.cityId,
      limit: batchSize,
      offset: 0,
    });
    const total: number = result.total;
    const batch: Array<{
      campId: string;
      name: string;
      orgName: string;
      description: string;
      currentCategories: string[];
    }> = result.batch;

    if (batch.length === 0) {
      console.log(`[Categorize] All done — no more uncategorized camps.`);
      return { totalRemaining: 0, batchProcessed: 0, batchUpdated: 0 };
    }

    console.log(`[Categorize] Processing batch of ${batch.length} / ${total} remaining`);

    // Build prompt with all camps in this batch
    const campList = batch
      .map(
        (c: { campId: string; name: string; orgName: string; description: string }, i: number) =>
          `${i + 1}. Name: "${c.name}"\n   Org: "${c.orgName}"\n   Description: "${c.description}"`,
      )
      .join('\n\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Categorize each summer camp below into one or more of these categories:
${VALID_CATEGORIES.join(', ')}

Rules:
- Each camp MUST have 1-3 categories (pick the most relevant)
- NEVER return "General" as the only category. Always pick at least one specific category.
- For umbrella/multi-activity camps (like "Summer Camp" or "Youth Camps"), assign 2-3 categories that the organization most likely offers based on the org name and description.
- Community centers, parks & rec, and JCC camps typically offer: Sports, Arts, Nature
- Use "Nature" for outdoor/wilderness/animal/farm/forest camps, AND for camps at parks/rec departments that include outdoor activities
- Use "Adventure" for kayaking, climbing, parkour, expeditions, survival skills
- Use "Sports" for specific sports (soccer, basketball, swimming, archery, martial arts, gymnastics) AND for general athletic/active camps
- Use "Arts" for visual arts, crafts, pottery, woodworking, painting
- Use "STEM" for science, technology, coding, robotics, engineering, math
- Use "Drama" for theater, acting, improv, film, animation
- Use "Music" for music, instruments, singing, band
- Use "Academic" for reading, writing, languages, tutoring
- Use "Cooking" for culinary, baking, food
- Use "Dance" for dance styles

Respond with ONLY a JSON array of objects, one per camp, in order:
[{"i": 1, "cats": ["Nature", "Adventure"]}, {"i": 2, "cats": ["Sports"]}, ...]

Camps to categorize:

${campList}`,
        },
      ],
    });

    // Parse response
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    let classifications: Array<{ i: number; cats: string[] }>;

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      classifications = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error(`[Categorize] Failed to parse AI response, skipping batch: ${text.slice(0, 300)}`);
      // Schedule next batch anyway
      if (total > batchSize) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.scheduler.runAfter(1000, internal.cleanup.categorize.categorizeCampsWithAI as any, {
          cityId: args.cityId,
          batchSize: args.batchSize,
        });
      }
      return { totalRemaining: total, batchProcessed: batch.length, batchUpdated: 0, error: 'parse_failed' };
    }

    // Build updates, validating categories
    const updates: Array<{ campId: string; categories: string[] }> = [];
    let defaultedCount = 0;
    for (const cls of classifications) {
      const camp = batch[cls.i - 1];
      if (!camp) continue;

      const validCats = cls.cats.filter((c: string) => VALID_CATEGORIES.includes(c));
      if (validCats.length === 0) {
        // AI couldn't classify — default to broad multi-activity categories
        validCats.push('Sports', 'Arts', 'Nature');
        defaultedCount++;
      }

      updates.push({
        campId: camp.campId,
        categories: validCats,
      });
    }
    if (defaultedCount > 0) {
      console.log(`[Categorize] ${defaultedCount}/${updates.length} camps defaulted to multi-activity`);
    }

    // Apply updates
    let batchUpdated = 0;
    if (updates.length > 0) {
      const result = await ctx.runMutation(internal.cleanup.sessions.applyCampCategories, { updates: updates as any });
      batchUpdated = result.updatedCamps;
      console.log(`[Categorize] Batch done: ${result.updatedCamps} camps, ${result.updatedSessions} sessions updated`);
    }

    // Schedule next batch if more remain AND we made progress
    const remaining = total - batch.length;
    if (remaining > 0 && batchUpdated > 0) {
      console.log(`[Categorize] ${remaining} camps remaining, scheduling next batch...`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.scheduler.runAfter(1000, internal.cleanup.categorize.categorizeCampsWithAI as any, {
        cityId: args.cityId,
        batchSize: args.batchSize,
      });
    } else if (remaining > 0 && batchUpdated === 0) {
      console.log(`[Categorize] STOPPING — batch updated 0 camps. Remaining: ${remaining}. Check logs for why.`);
    } else {
      console.log(`[Categorize] All camps categorized!`);
    }

    return { totalRemaining: remaining, batchProcessed: batch.length, batchUpdated };
  },
});

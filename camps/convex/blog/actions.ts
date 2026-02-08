'use node';

/**
 * Blog Post Generation Actions
 *
 * Uses Claude API to generate blog posts from real camp data.
 * Each post is grounded in actual data from the database.
 */

import { action, internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import Anthropic from '@anthropic-ai/sdk';

const client = () =>
  new Anthropic({
    apiKey: process.env.MODEL_API_KEY,
  });

// ---- Data gathering helpers ----

interface CampStats {
  totalSessions: number;
  totalOrgs: number;
  totalCamps: number;
  priceMin: number;
  priceMax: number;
  priceAvg: number;
  categories: Record<string, number>;
  orgNames: string[];
  ageRange: { min: number; max: number };
}

interface SessionSummary {
  campName: string;
  orgName: string;
  price: number;
  startDate: string;
  endDate: string;
  dropOffHour: number;
  pickUpHour: number;
  ageMin?: number;
  ageMax?: number;
  categories: string[];
  locationName: string;
}

async function gatherCityStats(
  ctx: any,
  cityId: string,
): Promise<{ stats: CampStats; sessions: SessionSummary[] }> {
  // Get all active sessions for the city
  const sessions = await ctx.runQuery(internal.blog.dataQueries.getActiveSessions, { cityId });

  // Get all orgs for the city
  const orgs = await ctx.runQuery(internal.blog.dataQueries.getActiveOrgs, { cityId });

  // Get all camps
  const camps = await ctx.runQuery(internal.blog.dataQueries.getActiveCamps, { cityId });

  const prices = sessions.filter((s: any) => s.price > 0).map((s: any) => s.price);

  const categories: Record<string, number> = {};
  for (const s of sessions) {
    for (const cat of s.categories || []) {
      categories[cat] = (categories[cat] || 0) + 1;
    }
  }

  const ages = sessions
    .filter((s: any) => s.ageMin !== undefined)
    .map((s: any) => ({ min: s.ageMin as number, max: s.ageMax as number }));

  const stats: CampStats = {
    totalSessions: sessions.length,
    totalOrgs: orgs.length,
    totalCamps: camps.length,
    priceMin: prices.length > 0 ? Math.min(...prices) : 0,
    priceMax: prices.length > 0 ? Math.max(...prices) : 0,
    priceAvg: prices.length > 0 ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length) : 0,
    categories,
    orgNames: orgs.map((o: any) => o.name),
    ageRange: {
      min: ages.length > 0 ? Math.min(...ages.map((a: any) => a.min)) : 3,
      max: ages.length > 0 ? Math.max(...ages.map((a: any) => a.max)) : 17,
    },
  };

  return { stats, sessions };
}

function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${Math.round(cents / 100)}`;
}

function buildDataContext(stats: CampStats, sessions: SessionSummary[], filter?: string): string {
  let context = `REAL DATA FROM OUR DATABASE:
- Total camp sessions: ${stats.totalSessions}
- Total organizations: ${stats.totalOrgs}
- Total camp programs: ${stats.totalCamps}
- Price range: ${formatPrice(stats.priceMin)} - ${formatPrice(stats.priceMax)}
- Average price: ${formatPrice(stats.priceAvg)}
- Age range: ${stats.ageRange.min} to ${stats.ageRange.max}
- Categories: ${Object.entries(stats.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `${cat} (${count} sessions)`)
    .join(', ')}
- Organizations include: ${stats.orgNames.slice(0, 20).join(', ')}${stats.orgNames.length > 20 ? ` and ${stats.orgNames.length - 20} more` : ''}`;

  // Add filtered session examples
  let filteredSessions = sessions;
  if (filter) {
    switch (filter) {
      case 'stem':
        filteredSessions = sessions.filter((s) =>
          s.categories.some((c) => ['STEM', 'Technology', 'Science', 'Engineering', 'Coding'].includes(c)),
        );
        break;
      case 'budget':
        filteredSessions = sessions.filter((s) => s.price > 0 && s.price <= 30000);
        break;
      case 'fullday':
        filteredSessions = sessions.filter((s) => s.pickUpHour - s.dropOffHour >= 5);
        break;
      case 'young':
        filteredSessions = sessions.filter((s) => s.ageMin !== undefined && s.ageMin <= 6);
        break;
      case 'outdoor':
        filteredSessions = sessions.filter((s) =>
          s.categories.some((c) => ['Nature', 'Outdoor', 'Adventure'].includes(c)),
        );
        break;
      case 'arts':
        filteredSessions = sessions.filter((s) =>
          s.categories.some((c) => ['Arts', 'Music', 'Drama', 'Dance', 'Cooking'].includes(c)),
        );
        break;
    }
  }

  // Show sample sessions
  const samples = filteredSessions.slice(0, 25);
  if (samples.length > 0) {
    context += `\n\nSAMPLE SESSIONS (${filteredSessions.length} total matching):`;
    for (const s of samples) {
      context += `\n- "${s.campName}" by ${s.orgName} | ${formatPrice(s.price)} | ${s.startDate} to ${s.endDate} | ${s.dropOffHour}:00-${s.pickUpHour}:00 | Ages ${s.ageMin ?? '?'}-${s.ageMax ?? '?'} | ${s.locationName} | [${s.categories.join(', ')}]`;
    }
    if (filteredSessions.length > 25) {
      context += `\n... and ${filteredSessions.length - 25} more matching sessions`;
    }
  }

  return context;
}

// ---- Post generation ----

interface PostTopic {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  prompt: string;
  filter?: string;
}

const POST_TOPICS: PostTopic[] = [
  {
    slug: 'complete-guide-summer-camps-portland-2025',
    title: 'The Complete Guide to Summer Camps in Portland 2025',
    category: 'guide',
    tags: ['portland', 'summer-camps', 'guide', '2025'],
    prompt: `Write a comprehensive guide to summer camps in Portland for 2025. Cover:
- How many organizations and sessions are available (use real numbers)
- Price range overview (reference real min/max/avg)
- Category breakdown (which types of camps are most popular)
- Top organizations by volume
- Age range availability
- Tips for planning (when to register, how to fill the whole summer)
- Brief mention of PDX Camps as a tool for comparing and planning

End with a CTA to browse all camps on the site.`,
  },
  {
    slug: 'best-stem-technology-camps-portland',
    title: 'Best STEM & Technology Camps in Portland',
    category: 'stem',
    tags: ['portland', 'stem', 'technology', 'coding', 'robotics'],
    filter: 'stem',
    prompt: `Write about STEM and technology camps in Portland. Cover:
- Overview of STEM camp options (count from real data)
- Highlight specific organizations running STEM camps (name real ones)
- Price comparison across STEM providers
- Age range options (which are good for younger vs older kids)
- What to look for in a STEM camp (hands-on vs screen time)
- Specific camp names and what makes them unique

End with a CTA to browse STEM camps using our filter.`,
  },
  {
    slug: 'affordable-summer-camps-under-300-portland',
    title: 'Affordable Summer Camps Under $300/Week in Portland',
    category: 'budget',
    tags: ['portland', 'affordable', 'budget', 'cheap'],
    filter: 'budget',
    prompt: `Write about budget-friendly summer camps in Portland. Cover:
- How many camps are available under $300/week
- Free camp options (if any)
- Best-value organizations
- Tips for saving money on summer camps (scholarships, early bird, multi-week)
- Real examples with actual prices
- Parks department and nonprofit options

End with a CTA to use our price filters.`,
  },
  {
    slug: 'full-day-summer-camps-working-parents-portland',
    title: 'Full-Day Summer Camps for Working Parents in Portland',
    category: 'guide',
    tags: ['portland', 'full-day', 'working-parents', 'extended-care'],
    filter: 'fullday',
    prompt: `Write about full-day camps for working parents. Cover:
- How many full-day options exist (8am+ dropoff, 4pm+ pickup)
- Extended care availability
- Organizations with the best schedules for working parents
- Tips for covering a full 9-5 workday with camp
- Real schedules from the data (dropoff/pickup times)
- How to handle transition weeks and gaps

End with a CTA to browse full-day camps.`,
  },
  {
    slug: 'summer-camps-little-kids-ages-4-6-portland',
    title: 'Summer Camps for Little Kids (Ages 4-6) in Portland',
    category: 'age-guide',
    tags: ['portland', 'preschool', 'kindergarten', 'young-kids', 'ages-4-6'],
    filter: 'young',
    prompt: `Write about camps for young children ages 4-6. Cover:
- How many camps accept this age range
- Half-day vs full-day options for little ones
- What to look for (staff ratios, program structure)
- Real organizations with young-kid programs
- Price range for this age group
- Tips for preparing a young child for their first camp

End with a CTA to filter camps by age.`,
  },
  {
    slug: 'outdoor-nature-camps-portland',
    title: 'Outdoor & Nature Camps in Portland',
    category: 'outdoor',
    tags: ['portland', 'outdoor', 'nature', 'hiking', 'adventure'],
    filter: 'outdoor',
    prompt: `Write about outdoor and nature camps in Portland. Cover:
- Count of outdoor/nature camp options
- Real organizations running outdoor programs
- Types of outdoor activities (hiking, creek play, gardening, wildlife)
- Portland's unique advantage for outdoor camps (Forest Park, etc.)
- Price ranges for outdoor programs
- What to pack for outdoor camp

End with a CTA to browse outdoor camps.`,
  },
  {
    slug: 'art-music-creative-camps-portland',
    title: 'Art, Music & Creative Camps in Portland',
    category: 'arts',
    tags: ['portland', 'art', 'music', 'creative', 'drama', 'dance'],
    filter: 'arts',
    prompt: `Write about arts and creative camps in Portland. Cover:
- Count of arts camps (art, music, drama, dance, cooking combined)
- Real organizations with arts programs
- Different types: visual arts, music, theater, dance, cooking
- Price ranges across creative camps
- What kids take home / perform at the end
- Portland's creative community as a backdrop

End with a CTA to browse arts camps.`,
  },
  {
    slug: 'how-to-plan-kids-summer-without-losing-your-mind',
    title: "How to Plan Your Kid's Summer Without Losing Your Mind",
    category: 'tips',
    tags: ['planning', 'tips', 'summer', 'parents'],
    prompt: `Write a practical, relatable guide for parents planning summer camp schedules. Cover:
- The overwhelm of summer planning (empathize)
- Step-by-step approach to filling the summer
- How to use week-by-week view to spot gaps
- Mixing camp types to keep things interesting
- Coordinating with working parent schedules
- How PDX Camps helps (browse, compare, track registrations, share with friends)
- Real stats about how many options are available

This should be product-focused but genuinely helpful. Show how the planner tool solves real problems.`,
  },
];

/**
 * Generate a single blog post from real data.
 */
export const generatePost = internalAction({
  args: {
    topicIndex: v.number(),
    citySlug: v.optional(v.string()),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ postId: string; slug: string }> => {
    const topic = POST_TOPICS[args.topicIndex];
    if (!topic) {
      throw new Error(`Invalid topic index: ${args.topicIndex}`);
    }

    // Get city
    const citySlug = args.citySlug ?? 'portland';
    const city: { _id: string; name: string } | null = await ctx.runQuery(internal.blog.dataQueries.getCityBySlug, { slug: citySlug });
    if (!city) {
      throw new Error(`City not found: ${citySlug}`);
    }

    console.log(`Generating blog post: "${topic.title}" for ${city.name}`);

    // Gather real data
    const { stats, sessions } = await gatherCityStats(ctx, city._id);
    const dataContext = buildDataContext(stats, sessions, topic.filter);

    console.log(`Data gathered: ${stats.totalSessions} sessions, ${stats.totalOrgs} orgs`);

    // Generate content with Claude
    const anthropic = client();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `You are writing a blog post for PDX Camps (pdxcamps.com), a free summer camp planning tool for Portland families. Your tone is that of a knowledgeable local parent helping other parents -- warm, practical, slightly informal but not cringey. You are NOT generic AI content. You are a real person who knows Portland and has actually used these camps.

IMPORTANT RULES:
- Reference REAL camp names, organizations, and prices from the data below
- Every fact must come from the data provided -- do not make up camp names or prices
- Use specific numbers: "47 STEM camps" not "dozens of STEM camps"
- Mention real organizations by name
- Include real price ranges with dollar amounts
- Sound like a local parent, not a marketing copywriter
- No generic filler paragraphs -- every sentence should be useful
- Use markdown formatting (## for sections, **bold** for emphasis, - for lists)
- Do NOT include a title/h1 -- we render that separately
- Keep it 800-1200 words
- End with a clear call-to-action

${dataContext}

TOPIC: ${topic.title}

${topic.prompt}

Write the blog post now. Use markdown. Do not include the title as an H1.`,
        },
      ],
    });

    const content =
      response.content.find((c) => c.type === 'text')?.text || '';

    if (!content) {
      throw new Error('Claude returned empty content');
    }

    // Generate excerpt
    const excerptResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Write a 1-2 sentence excerpt/summary for this blog post. It should be compelling and include a specific number or fact from the post. No more than 160 characters.

Title: ${topic.title}

${content.slice(0, 500)}`,
        },
      ],
    });
    const excerpt =
      excerptResponse.content.find((c) => c.type === 'text')?.text?.trim() || topic.title;

    // Generate meta description
    const metaDescription = excerpt.length <= 160 ? excerpt : excerpt.slice(0, 157) + '...';

    // Save to database
    const postId: string = await ctx.runMutation(internal.blog.mutations.create, {
      title: topic.title,
      slug: topic.slug,
      content,
      excerpt,
      cityId: city._id as any,
      category: topic.category,
      tags: topic.tags,
      metaTitle: `${topic.title} | PDX Camps`,
      metaDescription,
      generatedBy: 'claude',
      publish: args.publish ?? true,
    });

    console.log(`Blog post saved: ${topic.slug} (ID: ${postId})`);

    return { postId, slug: topic.slug };
  },
});

/**
 * Generate all initial blog posts.
 */
export const generateAllPosts = action({
  args: {
    citySlug: v.optional(v.string()),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Array<{ slug: string; success: boolean; error?: string }>> => {
    const results: Array<{ slug: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < POST_TOPICS.length; i++) {
      try {
        await ctx.runAction(internal.blog.actions.generatePost, {
          topicIndex: i,
          citySlug: args.citySlug,
          publish: args.publish ?? true,
        });
        results.push({ slug: POST_TOPICS[i].slug, success: true });
        console.log(`[${i + 1}/${POST_TOPICS.length}] Generated: ${POST_TOPICS[i].slug}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ slug: POST_TOPICS[i].slug, success: false, error: errMsg });
        console.error(`[${i + 1}/${POST_TOPICS.length}] Failed: ${POST_TOPICS[i].slug}:`, errMsg);
      }
    }

    return results;
  },
});

/**
 * Generate a "New Camps This Week" post from recently scraped data.
 * Called by weekly cron.
 */
export const generateWeeklyUpdate = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success?: boolean; skipped?: boolean; reason?: string; count?: number; slug?: string; sessionsCount?: number }> => {
    // Get sessions added in the past 7 days
    const recentSessions: Array<{
      campName: string;
      orgName: string;
      price: number;
      startDate: string;
      endDate: string;
      ageMin?: number;
      ageMax?: number;
      categories: string[];
    }> = await ctx.runQuery(internal.blog.dataQueries.getRecentSessions, {
      daysBack: 7,
    });

    if (recentSessions.length < 3) {
      console.log(`Only ${recentSessions.length} new sessions this week, skipping blog post`);
      return { skipped: true, reason: 'too_few_sessions', count: recentSessions.length };
    }

    // Get city (Portland for now)
    const city: { _id: string; name: string } | null = await ctx.runQuery(internal.blog.dataQueries.getCityBySlug, { slug: 'portland' });
    if (!city) {
      throw new Error('Portland city not found');
    }

    // Build summary of new camps
    const orgCounts: Record<string, number> = {};
    const catCounts: Record<string, number> = {};
    for (const s of recentSessions) {
      orgCounts[s.orgName] = (orgCounts[s.orgName] || 0) + 1;
      for (const cat of s.categories || []) {
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }
    }

    const now = new Date();
    const weekStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const slug = `new-camps-added-${now.toISOString().split('T')[0]}`;
    const title = `New Camps Added This Week - ${weekStr}`;

    const dataContext = `NEW SESSIONS ADDED IN PAST 7 DAYS:
- Total new sessions: ${recentSessions.length}
- Organizations: ${Object.entries(orgCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name} (${count})`)
      .join(', ')}
- Categories: ${Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `${cat} (${count})`)
      .join(', ')}

SAMPLE NEW SESSIONS:
${recentSessions
  .slice(0, 15)
  .map((s) => `- "${s.campName}" by ${s.orgName} | ${formatPrice(s.price)} | ${s.startDate}-${s.endDate} | Ages ${s.ageMin ?? '?'}-${s.ageMax ?? '?'}`)
  .join('\n')}`;

    const anthropic = client();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are writing a weekly update blog post for PDX Camps (pdxcamps.com). Tone: knowledgeable local parent. Quick, scannable, useful.

${dataContext}

Write a short blog post (400-600 words) covering:
- How many new sessions were added this week
- Which organizations added camps
- Category highlights
- Any notable finds (interesting camps, good prices, etc.)
- CTA to check out the new options

Use markdown. Do NOT include the title as H1. Keep it punchy and useful.`,
        },
      ],
    });

    const content = response.content.find((c) => c.type === 'text')?.text || '';

    const excerpt = `${recentSessions.length} new camp sessions added this week from ${Object.keys(orgCounts).length} organizations.`;

    await ctx.runMutation(internal.blog.mutations.create, {
      title,
      slug,
      content,
      excerpt,
      cityId: city._id as any,
      category: 'weekly-update',
      tags: ['portland', 'weekly-update', 'new-camps'],
      metaTitle: `${title} | PDX Camps`,
      metaDescription: excerpt,
      generatedBy: 'claude',
      publish: true,
    });

    console.log(`Weekly update generated: ${slug}`);

    return { success: true, slug, sessionsCount: recentSessions.length };
  },
});

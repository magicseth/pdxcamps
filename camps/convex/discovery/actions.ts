import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Helper to extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
    return match ? match[1] : url;
  }
}

/**
 * Search result from web search API
 */
interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

/**
 * Execute a discovery search using web search API
 * Finds new camp sources, deduplicates by domain, and inserts new discovered sources
 */
export const executeDiscoverySearch = action({
  args: {
    cityId: v.id("cities"),
    query: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    resultsCount: number;
    newSourcesFound: number;
    skippedDomains: string[];
  }> => {
    // ========================================
    // STUB: Web Search API Call (SerpAPI)
    // ========================================
    // In production, this would call SerpAPI or similar:
    //
    // const serpApiKey = process.env.SERPAPI_KEY;
    // const response = await fetch(
    //   `https://serpapi.com/search.json?` +
    //   `q=${encodeURIComponent(args.query)}` +
    //   `&api_key=${serpApiKey}` +
    //   `&num=50` +
    //   `&gl=us`
    // );
    // const data = await response.json();
    // const results = data.organic_results.map((r: any) => ({
    //   url: r.link,
    //   title: r.title,
    //   snippet: r.snippet,
    // }));

    // Stubbed search results for development
    const stubbedResults: SearchResult[] = [
      // These are placeholder results that would come from the real API
      // {
      //   url: "https://example-camp.com/summer-programs",
      //   title: "Example Summer Camp - Programs",
      //   snippet: "Summer camps for kids ages 5-12...",
      // },
    ];

    const results = stubbedResults;
    // ========================================

    // Track domains we've already seen in this batch to deduplicate
    const seenDomains = new Set<string>();
    const skippedDomains: string[] = [];
    let newSourcesFound = 0;

    // Process each result
    for (const result of results) {
      const domain = extractDomain(result.url);

      // Skip if we've already processed this domain in this batch
      if (seenDomains.has(domain)) {
        skippedDomains.push(domain);
        continue;
      }
      seenDomains.add(domain);

      // Try to create the discovered source (will be deduplicated by URL in the mutation)
      const createResult = await ctx.runMutation(
        internal.discovery.mutations.internalCreateDiscoveredSource,
        {
          cityId: args.cityId,
          url: result.url,
          title: result.title,
          snippet: result.snippet,
          discoveryQuery: args.query,
        }
      );

      if (createResult.created) {
        newSourcesFound++;
      }
    }

    // Record the search for analytics
    await ctx.runMutation(internal.discovery.mutations.internalRecordSearch, {
      cityId: args.cityId,
      query: args.query,
      resultsCount: results.length,
      newSourcesFound,
    });

    return {
      success: true,
      resultsCount: results.length,
      newSourcesFound,
      skippedDomains,
    };
  },
});

/**
 * Analyze a discovered URL using Claude API
 * Fetches the page content and determines if it's a camp site
 */
export const analyzeDiscoveredUrl = action({
  args: {
    sourceId: v.id("discoveredSources"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    analysis?: {
      isLikelyCampSite: boolean;
      confidence: number;
      detectedCampNames: string[];
      hasScheduleInfo: boolean;
      hasPricingInfo: boolean;
      pageType:
        | "camp_provider_main"
        | "camp_program_list"
        | "aggregator"
        | "directory"
        | "unknown";
      suggestedScraperApproach: string;
    };
    error?: string;
  }> => {
    // Get the discovered source to get its URL
    // Note: We can't use ctx.db in actions, so we'd need to pass the URL
    // or use a query. For now, we'll demonstrate the pattern with a stub.

    // ========================================
    // STUB: Fetch URL Content
    // ========================================
    // In production, this would fetch the page:
    //
    // const source = await ctx.runQuery(
    //   internal.discovery.queries.internalGetSource,
    //   { sourceId: args.sourceId }
    // );
    // if (!source) {
    //   return { success: false, error: "Source not found" };
    // }
    //
    // // Use a headless browser or fetch for the page content
    // const response = await fetch(source.url, {
    //   headers: {
    //     "User-Agent": "CampMarketplaceBot/1.0",
    //   },
    // });
    // const html = await response.text();
    //
    // // Extract text content from HTML
    // // (would use cheerio or similar in production)
    // const textContent = extractTextFromHtml(html);

    const textContent = ""; // Stubbed - would be extracted from page
    // ========================================

    // ========================================
    // STUB: Claude API Analysis
    // ========================================
    // In production, this would call the Claude API:
    //
    // const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    // const response = await fetch("https://api.anthropic.com/v1/messages", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "x-api-key": anthropicApiKey,
    //     "anthropic-version": "2023-06-01",
    //   },
    //   body: JSON.stringify({
    //     model: "claude-3-haiku-20240307",
    //     max_tokens: 1024,
    //     messages: [
    //       {
    //         role: "user",
    //         content: `Analyze this webpage content to determine if it's a children's summer camp website.
    //
    // URL: ${source.url}
    // Title: ${source.title}
    //
    // Page Content:
    // ${textContent.substring(0, 10000)}
    //
    // Respond with a JSON object containing:
    // - isLikelyCampSite: boolean
    // - confidence: number between 0 and 1
    // - detectedCampNames: array of camp names found
    // - hasScheduleInfo: boolean (does it have dates/schedules?)
    // - hasPricingInfo: boolean (does it have pricing?)
    // - pageType: one of "camp_provider_main", "camp_program_list", "aggregator", "directory", "unknown"
    // - suggestedScraperApproach: string description of how to scrape this site`,
    //       },
    //     ],
    //   }),
    // });
    //
    // const data = await response.json();
    // const analysisText = data.content[0].text;
    // const analysis = JSON.parse(analysisText);

    // Stubbed analysis result for development
    const analysis = {
      isLikelyCampSite: false,
      confidence: 0,
      detectedCampNames: [] as string[],
      hasScheduleInfo: false,
      hasPricingInfo: false,
      pageType: "unknown" as const,
      suggestedScraperApproach:
        "Analysis not performed - stub implementation. In production, would analyze page structure and recommend CSS selectors for scraping.",
    };

    // Skip update if this is just a stub with no real analysis
    if (textContent === "") {
      return {
        success: false,
        error:
          "Stub implementation - no actual analysis performed. Configure SERPAPI_KEY and ANTHROPIC_API_KEY environment variables for production use.",
      };
    }
    // ========================================

    // Update the source with the analysis results
    await ctx.runMutation(
      internal.discovery.mutations.internalUpdateAiAnalysis,
      {
        sourceId: args.sourceId,
        aiAnalysis: analysis,
      }
    );

    return {
      success: true,
      analysis,
    };
  },
});

/**
 * Internal action for analyzing a single URL
 * Used by batchAnalyzeDiscoveredUrls
 */
export const internalAnalyzeDiscoveredUrl = internalAction({
  args: {
    sourceId: v.id("discoveredSources"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    analysis?: {
      isLikelyCampSite: boolean;
      confidence: number;
      detectedCampNames: string[];
      hasScheduleInfo: boolean;
      hasPricingInfo: boolean;
      pageType:
        | "camp_provider_main"
        | "camp_program_list"
        | "aggregator"
        | "directory"
        | "unknown";
      suggestedScraperApproach: string;
    };
    error?: string;
  }> => {
    // Same implementation as the public action
    // In production, this would fetch the URL and analyze with Claude

    const textContent = ""; // Stubbed

    const analysis = {
      isLikelyCampSite: false,
      confidence: 0,
      detectedCampNames: [] as string[],
      hasScheduleInfo: false,
      hasPricingInfo: false,
      pageType: "unknown" as const,
      suggestedScraperApproach:
        "Analysis not performed - stub implementation.",
    };

    if (textContent === "") {
      return {
        success: false,
        error: "Stub implementation - configure API keys for production use.",
      };
    }

    await ctx.runMutation(
      internal.discovery.mutations.internalUpdateAiAnalysis,
      {
        sourceId: args.sourceId,
        aiAnalysis: analysis,
      }
    );

    return { success: true, analysis };
  },
});

/**
 * Batch analyze multiple discovered sources
 * Useful for processing the discovery queue
 */
export const batchAnalyzeDiscoveredUrls = action({
  args: {
    sourceIds: v.array(v.id("discoveredSources")),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    processed: number;
    failed: number;
    results: Array<{
      sourceId: string;
      success: boolean;
      error?: string;
    }>;
  }> => {
    const results: Array<{
      sourceId: string;
      success: boolean;
      error?: string;
    }> = [];
    let processed = 0;
    let failed = 0;

    for (const sourceId of args.sourceIds) {
      try {
        const result = await ctx.runAction(
          internal.discovery.actions.internalAnalyzeDiscoveredUrl,
          { sourceId }
        );

        if (result.success) {
          processed++;
          results.push({ sourceId, success: true });
        } else {
          failed++;
          results.push({ sourceId, success: false, error: result.error });
        }
      } catch (error) {
        failed++;
        results.push({
          sourceId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Add a small delay between requests to avoid rate limiting
      // In production, would use proper rate limiting and backoff
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return {
      success: failed === 0,
      processed,
      failed,
      results,
    };
  },
});

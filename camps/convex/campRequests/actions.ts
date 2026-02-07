"use node";

import { internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";

/**
 * Process a camp request:
 * 1. If URL provided, create org + source directly
 * 2. If no URL, mark as needing manual URL
 * 3. Queue scraper development to generate AI scraper
 */
export const processCampRequest = internalAction({
  args: {
    requestId: v.id("campRequests"),
  },
  handler: async (ctx, args) => {
    // Get the request
    const request = await ctx.runQuery(internal.campRequests.queries.getRequest, {
      requestId: args.requestId,
    });

    if (!request) {
      console.error(`Camp request not found: ${args.requestId}`);
      return;
    }

    // Get the city info
    const city = await ctx.runQuery(api.cities.queries.getCityById, {
      cityId: request.cityId,
    });

    if (!city) {
      await ctx.runMutation(internal.campRequests.mutations.updateRequestStatus, {
        requestId: args.requestId,
        status: "failed",
        errorMessage: "City not found",
      });
      return;
    }

    const websiteUrl = request.websiteUrl;

    // If no URL provided, we can't proceed automatically
    if (!websiteUrl) {
      await ctx.runMutation(internal.campRequests.mutations.updateRequestStatus, {
        requestId: args.requestId,
        status: "failed",
        errorMessage: "Please provide the camp's website URL so we can add it.",
      });
      return;
    }

    await ctx.runMutation(internal.campRequests.mutations.updateRequestStatus, {
      requestId: args.requestId,
      status: "scraping",
    });

    // Now we have a URL - create org, source, and queue scraper development
    try {
      const domain = new URL(websiteUrl).hostname.replace(/^www\./, "");
      const orgName = request.organizationName || request.campName;
      const slug = domain.replace(/\./g, "-");

      // Check if source already exists
      const existingSource = await ctx.runQuery(internal.campRequests.queries.findSourceByDomain, {
        domain,
      });

      if (existingSource) {
        await ctx.runMutation(internal.campRequests.mutations.updateRequestStatus, {
          requestId: args.requestId,
          status: "duplicate",
          scrapeSourceId: existingSource._id,
        });
        return;
      }

      // Create the organization and source
      const result = await ctx.runMutation(internal.campRequests.mutations.createOrgAndSource, {
        name: orgName,
        slug,
        website: websiteUrl,
        cityId: request.cityId,
        requestedBy: "user-request",
        notes: request.notes,
      });

      await ctx.runMutation(internal.campRequests.mutations.updateRequestStatus, {
        requestId: args.requestId,
        status: "completed",
        scrapeSourceId: result.sourceId,
        organizationId: result.organizationId,
      });

      console.log(`Camp request ${args.requestId} completed - created org ${result.organizationId}, source ${result.sourceId}`);
    } catch (error) {
      await ctx.runMutation(internal.campRequests.mutations.updateRequestStatus, {
        requestId: args.requestId,
        status: "failed",
        errorMessage: `Failed to create source: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  },
});

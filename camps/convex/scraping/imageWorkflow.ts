/**
 * Image Generation Workflow Definition
 *
 * Defines the workflow for batch image generation.
 * The actual FAL API calls are in generateImages.ts (node runtime).
 */

import { WorkflowManager, vWorkflowId } from '@convex-dev/workflow';
import { components, internal } from '../_generated/api';
import { v } from 'convex/values';

// Create workflow manager with concurrency limiting
// maxParallelism controls how many workflow steps run concurrently
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 3, // Only 3 concurrent FAL requests
  },
});

/**
 * Define the workflow for batch image generation
 */
export const generateImagesWorkflow = workflow.define({
  args: {
    campData: v.array(
      v.object({
        campId: v.id('camps'),
        campName: v.string(),
        prompt: v.string(),
      }),
    ),
  },
  returns: v.object({
    completed: v.number(),
    failed: v.number(),
    results: v.array(
      v.object({
        campName: v.string(),
        success: v.boolean(),
        error: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (
    step,
    args,
  ): Promise<{
    completed: number;
    failed: number;
    results: Array<{ campName: string; success: boolean; error?: string }>;
  }> => {
    const results: Array<{ campName: string; success: boolean; error?: string }> = [];
    let completed = 0;
    let failed = 0;

    // Process each camp - workflow handles rate limiting via maxParallelism
    for (const campInfo of args.campData) {
      // Run the action - workflow will queue and rate limit
      const result = await step.runAction(
        internal.scraping.generateImages.generateSingleImage,
        {
          campId: campInfo.campId,
          campName: campInfo.campName,
          prompt: campInfo.prompt,
        },
        { retry: true },
      );

      if (result.success) {
        completed++;
        results.push({ campName: campInfo.campName, success: true });
      } else {
        failed++;
        results.push({ campName: campInfo.campName, success: false, error: result.error });

        // Stop processing if credits are exhausted
        if (result.error === 'FAL_CREDITS_EXHAUSTED') {
          console.log(`[GenerateImages] Credits exhausted — stopping workflow.`);
          break;
        }
      }
    }

    return { completed, failed, results };
  },
});

/**
 * Backfill workflow: download scraped URLs first, then generate for the rest.
 *
 * Step 1 — download any scraped imageUrls into Convex storage
 * Step 2 — for each camp, generate prompt (Claude) + image (FAL) as a workflow step
 *
 * Prompt generation is deferred into each step so startBackfill doesn't time out.
 * The workflow manager's maxParallelism: 3 rate-limits concurrent FAL/Claude calls.
 */
export const backfillImagesWorkflow = workflow.define({
  args: {
    downloadLimit: v.number(),
    campIds: v.array(v.id('camps')),
  },
  returns: v.object({
    downloaded: v.object({
      campsProcessed: v.number(),
      imagesStored: v.number(),
    }),
    generated: v.object({
      completed: v.number(),
      failed: v.number(),
    }),
  }),
  handler: async (
    step,
    args,
  ): Promise<{
    downloaded: { campsProcessed: number; imagesStored: number };
    generated: { completed: number; failed: number };
  }> => {
    // Step 1: Download scraped image URLs into storage
    const downloadResult = await step.runAction(
      internal.scraping.populateCampImages.internalPopulateImages,
      { limit: args.downloadLimit },
      { retry: false },
    );

    // Step 2: Generate prompt + image for each camp (rate-limited by workflow)
    let completed = 0;
    let failed = 0;

    for (const campId of args.campIds) {
      const result = await step.runAction(
        internal.scraping.generateImages.generatePromptAndImage,
        { campId },
        { retry: true },
      );

      if (result.success) {
        completed++;
      } else {
        failed++;
        console.log(`[Backfill] Failed: ${result.campName} — ${result.error}`);

        // Stop processing if credits are exhausted
        if (result.error === 'FAL_CREDITS_EXHAUSTED') {
          console.log(`[Backfill] Credits exhausted — stopping workflow. ${completed} completed, ${failed} failed, ${args.campIds.length - completed - failed} skipped.`);
          break;
        }
      }
    }

    return {
      downloaded: downloadResult,
      generated: { completed, failed },
    };
  },
});

// Re-export for use in other files
export { vWorkflowId };

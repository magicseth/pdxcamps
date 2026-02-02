/**
 * Image Generation Workflow Definition
 *
 * Defines the workflow for batch image generation.
 * The actual FAL API calls are in generateImages.ts (node runtime).
 */

import { WorkflowManager, vWorkflowId } from "@convex-dev/workflow";
import { components, internal } from "../_generated/api";
import { v } from "convex/values";

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
    campData: v.array(v.object({
      campId: v.id("camps"),
      campName: v.string(),
      prompt: v.string(),
    })),
  },
  returns: v.object({
    completed: v.number(),
    failed: v.number(),
    results: v.array(v.object({
      campName: v.string(),
      success: v.boolean(),
      error: v.optional(v.string()),
    })),
  }),
  handler: async (step, args): Promise<{
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
        { retry: true }
      );

      if (result.success) {
        completed++;
        results.push({ campName: campInfo.campName, success: true });
      } else {
        failed++;
        results.push({ campName: campInfo.campName, success: false, error: result.error });
      }
    }

    return { completed, failed, results };
  },
});

// Re-export for use in other files
export { vWorkflowId };

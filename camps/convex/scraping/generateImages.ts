'use node';

/**
 * AI Image Generation for Camps (Node.js Actions)
 *
 * Uses FAL.ai to generate images for camps that don't have any images.
 * Works with the workflow defined in imageWorkflow.ts for rate limiting.
 */

import { action, internalAction } from '../_generated/server';
import { api, internal } from '../_generated/api';
import { v } from 'convex/values';
import { fal } from '@fal-ai/client';
import { workflow, vWorkflowId } from './imageWorkflow';
import Anthropic from '@anthropic-ai/sdk';

// Configure FAL client
fal.config({
  credentials: process.env.FAL_API_KEY,
});

/**
 * Simple hash function to get a consistent number from a string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Pick an item from array based on hash
 */
function pickFromHash<T>(arr: T[], hash: number, offset: number = 0): T {
  return arr[(hash + offset) % arr.length];
}

/**
 * Generate a unique, consistent style for a camp based on its ID
 */
function generateStylePrompt(campId: string): string {
  const hash = hashString(campId);

  // Photography style — real-world look, not illustration
  const photoStyle = [
    'candid documentary photography, shot on Canon EOS R5, 85mm f/1.4',
    'lifestyle editorial photography, shot on Sony A7IV, 35mm f/1.8',
    'vibrant photojournalism style, shot on Nikon Z9, 24-70mm f/2.8',
    'warm family photography style, shot on Fujifilm X-T5, 56mm f/1.2',
    'bright commercial photography for a summer catalog, shot on Phase One',
    'authentic moment captured by a parent with an iPhone 15 Pro, natural and unposed',
    'sports action photography, shot on Canon R3, 70-200mm f/2.8, high shutter speed',
    'environmental portrait photography, shot on Hasselblad, medium format film look',
  ];

  // Composition — camera angles and framing
  const composition = [
    'low angle looking up at the action, kids filling the frame',
    'eye-level with the children, intimate perspective',
    'over-the-shoulder shot showing what the child sees',
    'wide establishing shot showing the full environment and activity',
    'close-up on hands working, shallow depth of field with bokeh background',
    'candid profile shot from the side, capturing concentration',
    'pull-back shot with foreground framing (doorway, trees, equipment)',
    'dynamic shot with slight motion blur on the edges, tack-sharp subject',
  ];

  // Lighting — natural, realistic
  const lighting = [
    'golden hour morning light, warm tones, long soft shadows',
    'bright midday Oregon summer sun, vivid colors, hard shadows',
    'open shade under trees, even soft light on faces',
    'overcast Pacific Northwest sky, diffused light, rich saturated colors',
    'backlit with sun flare, rim light on hair',
    'indoor with large windows, natural light flooding in',
    'mixed sun and cloud, dappled light through tree canopy',
    'late afternoon warm side-light, dramatic but natural',
  ];

  // Setting detail — grounds the image in a real place
  const setting = [
    'at a Portland park with Douglas fir trees in background',
    'in a bright modern classroom or maker space',
    'on a grassy sports field with a treeline behind',
    'at an outdoor picnic table area with craft supplies spread out',
    'in a gymnasium or indoor sports facility',
    'along a forest trail in the Pacific Northwest',
    'at a waterfront or creek with kids in rubber boots',
    'in an art studio with paint-splattered tables and supplies everywhere',
  ];

  const selectedPhoto = pickFromHash(photoStyle, hash, 0);
  const selectedComp = pickFromHash(composition, hash, 1);
  const selectedLight = pickFromHash(lighting, hash, 2);
  const selectedSetting = pickFromHash(setting, hash, 3);

  return `${selectedPhoto}. ${selectedComp}. ${selectedLight}. ${selectedSetting}.`;
}

/**
 * Use Claude to generate an image prompt for a camp
 */
async function generateImagePromptWithClaude(camp: {
  name: string;
  description: string;
  organizationName?: string;
  ageDescription: string;
  stylePrompt: string;
}): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.MODEL_API_KEY,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You write prompts for photorealistic image generation. Generate a prompt for a PHOTOGRAPH (not illustration) representing this summer camp:

Camp Name: ${camp.name}
Organization: ${camp.organizationName || 'Unknown'}
Description: ${camp.description}
Age Group: ${camp.ageDescription}

Rules:
1. Describe a REAL PHOTOGRAPH of the specific activity — not a painting, cartoon, or illustration
2. Focus on ONE vivid, specific moment (a kid mid-swing with a hammer at woodworking camp, a girl pipetting liquid in a chemistry camp, kids hauling a canoe into water)
3. Include concrete sensory details: textures, materials, colors of equipment, what's on the table, what they're wearing
4. Mention the children naturally without over-specifying demographics — just describe the scene with kids of the right age doing the activity
5. NEVER use words like "illustration", "painting", "cartoon", "artwork", "render", "digital art", "anime", "stylized"

Photography direction: ${camp.stylePrompt}

Respond with ONLY the prompt, 2-4 sentences. End with "Photorealistic, high resolution photograph. No text, words, logos, or watermarks."`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  return (
    textContent?.text ||
    `Children at ${camp.name} summer camp, candid photograph. ${camp.stylePrompt} Photorealistic, high resolution photograph. No text, words, logos, or watermarks.`
  );
}

/**
 * Get age description for prompt based on age requirements
 */
function getAgeDescription(ageReqs?: {
  minAge?: number;
  maxAge?: number;
  minGrade?: number;
  maxGrade?: number;
}): string {
  if (!ageReqs) return 'children ages 6-12';

  // Calculate age from grade if needed (rough estimate: grade + 5 = age)
  let minAge = ageReqs.minAge;
  let maxAge = ageReqs.maxAge;

  if (minAge === undefined && ageReqs.minGrade !== undefined) {
    minAge = ageReqs.minGrade + 5;
  }
  if (maxAge === undefined && ageReqs.maxGrade !== undefined) {
    maxAge = ageReqs.maxGrade + 6;
  }

  // Default fallback
  if (minAge === undefined && maxAge === undefined) {
    return 'children ages 6-12';
  }

  // Age-appropriate descriptions
  if (maxAge && maxAge <= 5) {
    return 'toddlers and preschoolers (ages 3-5)';
  }
  if (minAge && minAge >= 13) {
    return 'teenagers (ages 13-17)';
  }
  if (minAge && minAge >= 10) {
    return 'older kids and tweens (ages 10-13)';
  }
  if (maxAge && maxAge <= 8) {
    return 'young children (ages 5-8)';
  }

  // General range
  const min = minAge || 5;
  const max = maxAge || 12;
  return `children ages ${min}-${max}`;
}

/**
 * Generate a prompt for image generation based on camp details using Claude
 */
async function generatePrompt(camp: {
  _id: string;
  name: string;
  description: string;
  categories: string[];
  organizationName?: string;
  imageStylePrompt?: string;
  ageRequirements?: {
    minAge?: number;
    maxAge?: number;
    minGrade?: number;
    maxGrade?: number;
  };
}): Promise<string> {
  // Use custom style if set, otherwise generate one based on camp ID
  const stylePrompt = camp.imageStylePrompt || generateStylePrompt(camp._id);

  // Get age-appropriate description
  const ageDesc = getAgeDescription(camp.ageRequirements);

  // Use Claude to generate the prompt
  const prompt = await generateImagePromptWithClaude({
    name: camp.name,
    description: camp.description,
    organizationName: camp.organizationName,
    ageDescription: ageDesc,
    stylePrompt: stylePrompt,
  });

  return prompt;
}

/**
 * Internal action to generate and store a single image
 * This is called by the workflow with rate limiting
 */
export const generateSingleImage = internalAction({
  args: {
    campId: v.id('camps'),
    campName: v.string(),
    prompt: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    campId: string;
    campName: string;
    storageId: string | null;
    error?: string;
  }> => {
    try {
      console.log(`[GenerateImages] Generating for: ${args.campName}`);

      // Call FAL to generate image using FLUX Pro 1.1 (photorealistic quality)
      const result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
        input: {
          prompt: args.prompt,
          image_size: 'landscape_16_9',
          num_images: 1,
          safety_tolerance: '2',
        },
      });

      const images = result.data?.images;
      if (!images || images.length === 0) {
        return {
          success: false,
          campId: args.campId,
          campName: args.campName,
          storageId: null,
          error: 'No images generated',
        };
      }

      const imageUrl = images[0].url;
      console.log(`[GenerateImages] Generated: ${imageUrl}`);

      // Download the generated image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return {
          success: false,
          campId: args.campId,
          campName: args.campName,
          storageId: null,
          error: `Download failed: HTTP ${response.status}`,
        };
      }

      const blob = await response.blob();
      const storageId = await ctx.storage.store(blob);

      // Update the camp with the new image
      await ctx.runMutation(api.camps.mutations.updateCampImages, {
        campId: args.campId,
        imageStorageIds: [storageId],
      });

      console.log(`[GenerateImages] Stored for ${args.campName}: ${storageId}`);

      return {
        success: true,
        campId: args.campId,
        campName: args.campName,
        storageId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[GenerateImages] Failed for ${args.campName}: ${message}`);

      // Detect fal.ai credit exhaustion (Forbidden = no credits)
      if (message.includes('Forbidden') || message.includes('403')) {
        // Trigger pause + email notification (fire and forget)
        await ctx.runAction(internal.scraping.falCreditCheck.pauseAndNotify, {});
        return {
          success: false,
          campId: args.campId,
          campName: args.campName,
          storageId: null,
          error: 'FAL_CREDITS_EXHAUSTED',
        };
      }

      return {
        success: false,
        campId: args.campId,
        campName: args.campName,
        storageId: null,
        error: message,
      };
    }
  },
});

/**
 * Start the image generation workflow for camps without images
 */
export const startImageGeneration = action({
  args: {
    limit: v.optional(v.number()), // Max camps to process (default 10)
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    workflowId: string;
    campsQueued: number;
    campNames: string[];
  }> => {
    const limit = args.limit ?? 10;

    // Get camps without images using targeted query
    const result = await ctx.runQuery(api.camps.queries.listCampsNeedingImageGeneration, { limit });

    const campsToProcess = result.camps;
    const campNames = campsToProcess.map((c) => c.name);
    console.log(
      `[GenerateImages] Found ${result.total} total camps needing images, processing ${campsToProcess.length}`,
    );

    // Pre-compute prompts for each camp (need to await since generatePrompt is async)
    const campData = await Promise.all(
      campsToProcess.map(async (camp) => {
        // Get organization name for better prompt context
        const organization = await ctx.runQuery(api.organizations.queries.getOrganization, {
          organizationId: camp.organizationId,
        });

        return {
          campId: camp._id,
          campName: camp.name,
          prompt: await generatePrompt({
            _id: camp._id as string,
            name: camp.name,
            description: camp.description,
            categories: camp.categories,
            ageRequirements: camp.ageRequirements,
            organizationName: organization?.name,
          }),
        };
      }),
    );

    console.log(`[GenerateImages] Starting workflow for ${campData.length} camps`);

    // Start the workflow
    const workflowId = await workflow.start(ctx, internal.scraping.imageWorkflow.generateImagesWorkflow, { campData });

    return {
      workflowId: workflowId as string,
      campsQueued: campData.length,
      campNames,
    };
  },
});

/**
 * Check the status of an image generation workflow
 */
export const getWorkflowStatus = action({
  args: {
    workflowId: vWorkflowId,
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: string;
    result?: {
      completed: number;
      failed: number;
      results: Array<{ campName: string; success: boolean; error?: string }>;
    };
  }> => {
    const status = await workflow.status(ctx, args.workflowId);

    if (status.type === 'completed') {
      return {
        status: 'completed',
        result: status.result as {
          completed: number;
          failed: number;
          results: Array<{ campName: string; success: boolean; error?: string }>;
        },
      };
    }

    return { status: status.type };
  },
});

/**
 * Generate an image for a specific camp (direct action, not via workflow)
 */
export const generateCampImage = action({
  args: {
    campId: v.id('camps'),
    customPrompt: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    storageId: string | null;
    error?: string;
  }> => {
    const camp = await ctx.runQuery(api.camps.queries.getCamp, {
      campId: args.campId,
    });

    if (!camp) {
      return { success: false, storageId: null, error: 'Camp not found' };
    }

    // Get organization name for better prompt context
    const organization = await ctx.runQuery(api.organizations.queries.getOrganization, {
      organizationId: camp.organizationId,
    });

    const prompt =
      args.customPrompt ||
      (await generatePrompt({
        ...camp,
        organizationName: organization?.name,
      }));

    console.log(`[GenerateImages] Prompt for ${camp.name}: ${prompt}`);

    const result = await ctx.runAction(internal.scraping.generateImages.generateSingleImage, {
      campId: args.campId,
      campName: camp.name,
      prompt,
    });

    return {
      success: result.success,
      storageId: result.storageId,
      error: result.error,
    };
  },
});

/**
 * List camps without images (for admin preview)
 */
export const listCampsWithoutImages = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    count: number;
    camps: Array<{ id: string; name: string; categories: string[]; description: string }>;
  }> => {
    const limit = args.limit ?? 100;
    const result = await ctx.runQuery(api.camps.queries.listCampsNeedingImageGeneration, { limit });

    return {
      count: result.total,
      camps: result.camps.map((camp) => ({
        id: camp._id,
        name: camp.name,
        categories: camp.categories,
        description: camp.description.substring(0, 200),
      })),
    };
  },
});

/**
 * Internal action that generates a prompt (via Claude) and image (via FAL) for a single camp.
 * Used by the backfill workflow so prompt generation happens inside workflow steps
 * instead of being pre-computed (which would time out for large batches).
 */
export const generatePromptAndImage = internalAction({
  args: {
    campId: v.id('camps'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    campName: string;
    error?: string;
  }> => {
    try {
      const camp = await ctx.runQuery(api.camps.queries.getCamp, { campId: args.campId });
      if (!camp) {
        return { success: false, campName: 'unknown', error: 'Camp not found' };
      }

      // Skip if camp already has images (may have been processed by an earlier step)
      if (camp.imageStorageIds && camp.imageStorageIds.length > 0) {
        console.log(`[Backfill] Skipping ${camp.name} — already has images`);
        return { success: true, campName: camp.name };
      }

      const organization = await ctx.runQuery(api.organizations.queries.getOrganization, {
        organizationId: camp.organizationId,
      });

      const prompt = await generatePrompt({
        _id: camp._id as string,
        name: camp.name,
        description: camp.description,
        categories: camp.categories,
        ageRequirements: camp.ageRequirements,
        organizationName: organization?.name,
      });

      console.log(`[Backfill] Generated prompt for ${camp.name}, calling FAL...`);

      const result = await ctx.runAction(internal.scraping.generateImages.generateSingleImage, {
        campId: args.campId,
        campName: camp.name,
        prompt,
      });

      return {
        success: result.success,
        campName: camp.name,
        error: result.error,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // Propagate credit exhaustion so the workflow can stop
      if (message.includes('Forbidden') || message.includes('403') || message.includes('FAL_CREDITS_EXHAUSTED')) {
        return { success: false, campName: args.campId as string, error: 'FAL_CREDITS_EXHAUSTED' };
      }
      return { success: false, campName: args.campId as string, error: message };
    }
  },
});

/**
 * Start the backfill workflow: download scraped URLs then generate for the rest.
 * Queues ALL camps needing images — prompt generation happens inside workflow steps,
 * rate-limited by maxParallelism: 3.
 * Callable from crons or the dashboard.
 */
export const startBackfill = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    workflowId: string;
    campsQueued: number;
  }> => {
    // Check if image generation is paused due to credit exhaustion
    const flag = await ctx.runQuery(internal.scraping.falCreditQueries.getFlag, {
      key: 'fal_image_generation',
    });
    if (flag?.value === 'paused') {
      console.log('[Backfill] Skipping — fal.ai credits exhausted (paused)');
      return { workflowId: 'skipped', campsQueued: 0 };
    }

    const limit = args.limit ?? 10000;

    // Get camps needing AI generation (no URLs and no stored images)
    const result = await ctx.runQuery(api.camps.queries.listCampsNeedingImageGeneration, { limit });

    const campIds = result.camps.map((c) => c._id);
    console.log(
      `[Backfill] Found ${result.total} total camps needing generation, queueing ${campIds.length}`,
    );

    // Start the backfill workflow — prompt generation happens inside each step
    const workflowId = await workflow.start(
      ctx,
      internal.scraping.imageWorkflow.backfillImagesWorkflow,
      { downloadLimit: limit, campIds },
    );

    return {
      workflowId: workflowId as string,
      campsQueued: campIds.length,
    };
  },
});

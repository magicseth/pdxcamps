"use node";

/**
 * AI Image Generation for Camps (Node.js Actions)
 *
 * Uses FAL.ai to generate images for camps that don't have any images.
 * Works with the workflow defined in imageWorkflow.ts for rate limiting.
 */

import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { fal } from "@fal-ai/client";
import { workflow, vWorkflowId } from "./imageWorkflow";
import Anthropic from "@anthropic-ai/sdk";

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
    hash = ((hash << 5) - hash) + char;
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

  // Art medium / technique - more specific and interesting
  const media = [
    "vibrant watercolor with wet-on-wet technique, paint bleeding beautifully",
    "rich oil painting with visible impasto brushstrokes",
    "crisp digital art, trending on artstation",
    "detailed colored pencil illustration with textured paper visible",
    "bold gouache painting with flat graphic shapes",
    "dreamy soft pastel artwork with chalky texture",
    "expressive acrylic painting with bold strokes",
    "elegant ink and watercolor wash",
    "polished digital painting like a Pixar concept art",
    "nostalgic Norman Rockwell style illustration",
    "Studio Ghibli inspired animation style",
    "editorial illustration style for New York Times",
  ];

  // Camera/composition - more dynamic
  const composition = [
    "dramatic low angle looking up, kids appearing heroic",
    "bird's eye view showing the whole activity",
    "over-the-shoulder perspective, intimate and immersive",
    "dutch angle adding energy and movement",
    "close-up on hands and activity, shallow depth of field",
    "wide cinematic shot with rule of thirds",
    "dynamic diagonal composition with movement blur",
    "symmetrical framing with central focus",
  ];

  // Lighting - specific and atmospheric
  const lighting = [
    "golden hour sunlight streaming through, lens flare",
    "dappled light filtering through trees",
    "bright overcast day, soft even lighting",
    "dramatic rim lighting from behind",
    "warm indoor lighting with soft shadows",
    "magic hour glow, long shadows",
    "high key bright and airy",
    "natural window light, cozy atmosphere",
  ];

  // Energy/action words
  const energy = [
    "frozen mid-action, peak moment captured",
    "genuine laughter and joy visible",
    "intense concentration and focus",
    "collaborative teamwork moment",
    "triumphant achievement expression",
    "curious discovery moment",
    "playful chaos and movement",
    "peaceful flow state",
  ];

  const selectedMedia = pickFromHash(media, hash, 0);
  const selectedComp = pickFromHash(composition, hash, 1);
  const selectedLight = pickFromHash(lighting, hash, 2);
  const selectedEnergy = pickFromHash(energy, hash, 3);

  return `${selectedMedia}. ${selectedComp}. ${selectedLight}. ${selectedEnergy}.`;
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
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are an expert at writing image generation prompts. Generate a prompt for an image that represents this summer camp:

Camp Name: ${camp.name}
Organization: ${camp.organizationName || "Unknown"}
Description: ${camp.description}
Age Group: ${camp.ageDescription}

Write a detailed image prompt that:
1. Clearly depicts the SPECIFIC activity of this camp (not generic camp activities)
2. Shows diverse children (mixed ethnicities: Asian, Black, Latino, White) of the appropriate age
3. Includes specific props and setting that match THIS camp's activity
4. Has dynamic, interesting composition

Style to use: ${camp.stylePrompt}

Respond with ONLY the image prompt, no explanation. The prompt should be 2-4 sentences. End with "No text, words, or logos in the image."`
      }
    ]
  });

  const textContent = response.content.find(c => c.type === "text");
  return textContent?.text || `Children at ${camp.name} summer camp. ${camp.stylePrompt} No text, words, or logos in the image.`;
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
  if (!ageReqs) return "children ages 6-12";

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
    return "children ages 6-12";
  }

  // Age-appropriate descriptions
  if (maxAge && maxAge <= 5) {
    return "toddlers and preschoolers (ages 3-5)";
  }
  if (minAge && minAge >= 13) {
    return "teenagers (ages 13-17)";
  }
  if (minAge && minAge >= 10) {
    return "older kids and tweens (ages 10-13)";
  }
  if (maxAge && maxAge <= 8) {
    return "young children (ages 5-8)";
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
    campId: v.id("camps"),
    campName: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    campId: string;
    campName: string;
    storageId: string | null;
    error?: string;
  }> => {
    try {
      console.log(`[GenerateImages] Generating for: ${args.campName}`);

      // Call FAL to generate image using FLUX Dev (higher quality)
      const result = await fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt: args.prompt,
          image_size: "landscape_16_9",
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true,
        },
      });

      const images = result.data?.images;
      if (!images || images.length === 0) {
        return {
          success: false,
          campId: args.campId,
          campName: args.campName,
          storageId: null,
          error: "No images generated",
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
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[GenerateImages] Failed for ${args.campName}: ${message}`);
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
  handler: async (ctx, args): Promise<{
    workflowId: string;
    campsQueued: number;
    campNames: string[];
  }> => {
    const limit = args.limit ?? 10;

    // Get camps without images using targeted query
    const result = await ctx.runQuery(
      api.camps.queries.listCampsNeedingImageGeneration,
      { limit }
    );

    const campsToProcess = result.camps;
    const campNames = campsToProcess.map((c) => c.name);
    console.log(`[GenerateImages] Found ${result.total} total camps needing images, processing ${campsToProcess.length}`);

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
      })
    );

    console.log(`[GenerateImages] Starting workflow for ${campData.length} camps`);

    // Start the workflow
    const workflowId = await workflow.start(
      ctx,
      internal.scraping.imageWorkflow.generateImagesWorkflow,
      { campData }
    );

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
  handler: async (ctx, args): Promise<{
    status: string;
    result?: {
      completed: number;
      failed: number;
      results: Array<{ campName: string; success: boolean; error?: string }>;
    };
  }> => {
    const status = await workflow.status(ctx, args.workflowId);

    if (status.type === "completed") {
      return {
        status: "completed",
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
    campId: v.id("camps"),
    customPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    storageId: string | null;
    error?: string;
  }> => {
    const camp = await ctx.runQuery(api.camps.queries.getCamp, {
      campId: args.campId,
    });

    if (!camp) {
      return { success: false, storageId: null, error: "Camp not found" };
    }

    // Get organization name for better prompt context
    const organization = await ctx.runQuery(api.organizations.queries.getOrganization, {
      organizationId: camp.organizationId,
    });

    const prompt = args.customPrompt || await generatePrompt({
      ...camp,
      organizationName: organization?.name,
    });

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
  handler: async (ctx, args): Promise<{
    count: number;
    camps: Array<{ id: string; name: string; categories: string[]; description: string }>;
  }> => {
    const limit = args.limit ?? 100;
    const result = await ctx.runQuery(
      api.camps.queries.listCampsNeedingImageGeneration,
      { limit }
    );

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

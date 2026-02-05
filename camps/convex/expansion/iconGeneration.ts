"use node";

/**
 * AI Icon Generation for New Markets
 *
 * Uses FAL.ai to generate branded city icons based on the PDX icon style.
 */

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { fal } from "@fal-ai/client";
import Anthropic from "@anthropic-ai/sdk";

// Configure FAL client
fal.config({
  credentials: process.env.FAL_API_KEY,
});

// City landmarks for prompt generation
const CITY_LANDMARKS: Record<string, string[]> = {
  denver: ["Rocky Mountains", "Red Rocks Amphitheatre", "Denver skyline", "snowy peaks"],
  seattle: ["Space Needle", "Mount Rainier", "Pike Place Market", "evergreen trees"],
  austin: ["Texas State Capitol", "bats under Congress Bridge", "live music signs", "bluebonnets"],
  atlanta: ["Georgia Dome", "peach trees", "Centennial Olympic Park fountain"],
  phoenix: ["Camelback Mountain", "saguaro cactus", "desert sunset"],
  boston: ["Fenway Park", "Freedom Trail", "Boston skyline", "sailboats on Charles River"],
  portland: ["Mt Hood", "Portland skyline", "Douglas fir trees", "bridges"],
  "san-francisco": ["Golden Gate Bridge", "cable cars", "Victorian houses"],
  chicago: ["Willis Tower", "Cloud Gate Bean", "Lake Michigan"],
  miami: ["Art Deco buildings", "palm trees", "ocean waves"],
  "los-angeles": ["Hollywood sign", "palm trees", "LA skyline"],
  "new-york": ["Statue of Liberty", "Empire State Building", "Central Park"],
};

/**
 * Generate icon prompt using Claude
 */
async function generateIconPromptWithClaude(params: {
  cityName: string;
  cityCode: string;
  landmarks: string[];
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
        content: `You are an expert at writing image generation prompts for app icons.

I need a prompt for a city-branded summer camp app icon for ${params.cityName}.

The icon should:
1. Be a square app icon design (like iOS/Android app icons)
2. Include the 3-letter city code "${params.cityCode}" prominently
3. Feature iconic ${params.cityName} landmarks: ${params.landmarks.join(", ")}
4. Have a playful, family-friendly summer camp vibe
5. Use bright, cheerful colors appropriate for a kids/family app
6. Be simple enough to work at small sizes (192x192px)
7. Have a clean, modern design like the PDX Camps icon

Style: Modern flat design with subtle gradients, clean vectors, vibrant summer colors (blues, greens, yellows, oranges). Think Airbnb meets summer camp.

Write ONLY the image prompt, no explanation. Keep it under 150 words.`
      }
    ]
  });

  const textContent = response.content.find(c => c.type === "text");
  return textContent?.text || `App icon for ${params.cityName} summer camps featuring "${params.cityCode}" text and local landmarks. Modern flat design, vibrant colors, family-friendly.`;
}

/**
 * Generate city icon options using FAL
 */
export const generateCityIcons = action({
  args: {
    marketKey: v.string(),
    cityName: v.string(),
    cityCode: v.string(), // 3-letter code like "DEN", "SEA", "ATX"
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    images?: string[]; // URLs of generated images
    error?: string;
  }> => {
    try {
      // Get landmarks for this city
      const normalizedKey = args.marketKey.split("-")[0].toLowerCase();
      const landmarks = CITY_LANDMARKS[normalizedKey] || [
        `${args.cityName} skyline`,
        "local landmarks",
        "regional nature",
      ];

      // Generate prompt with Claude
      const prompt = await generateIconPromptWithClaude({
        cityName: args.cityName,
        cityCode: args.cityCode,
        landmarks,
      });

      console.log(`Generated prompt for ${args.cityName}: ${prompt}`);

      // Generate 4 options with FAL
      const result = await fal.subscribe("fal-ai/flux/schnell", {
        input: {
          prompt,
          image_size: "square", // 1024x1024
          num_images: 4,
          num_inference_steps: 4,
          enable_safety_checker: true,
        },
        logs: true,
      });

      const images = (result.data as { images?: Array<{ url: string }> })?.images?.map(
        (img) => img.url
      ) || [];

      if (images.length === 0) {
        return {
          success: false,
          error: "No images generated",
        };
      }

      // Store the generated options in the database
      await ctx.runMutation(internal.expansion.iconMutations.storeIconOptions, {
        marketKey: args.marketKey,
        imageUrls: images,
        prompt,
      });

      return {
        success: true,
        images,
      };
    } catch (error) {
      console.error("Icon generation error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Select an icon and save it to storage
 */
export const selectCityIcon = action({
  args: {
    marketKey: v.string(),
    imageUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      // Download the image
      const response = await fetch(args.imageUrl);
      if (!response.ok) {
        return { success: false, error: "Failed to download image" };
      }

      const blob = await response.blob();

      // Store in Convex storage
      const storageId = await ctx.storage.store(blob);

      // Update market record
      await ctx.runMutation(internal.expansion.iconMutations.saveSelectedIcon, {
        marketKey: args.marketKey,
        storageId,
        sourceUrl: args.imageUrl,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

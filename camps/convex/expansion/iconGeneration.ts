"use node";

/**
 * AI Icon Generation for New Markets
 *
 * Uses FAL.ai to generate branded city icons using the PDX icon as a style reference.
 * This ensures consistent branding colors and design across all city icons.
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
  "san": ["Golden Gate Bridge", "cable cars", "San Francisco skyline", "Bay Bridge"],
  chicago: ["Willis Tower", "Cloud Gate Bean", "Lake Michigan"],
  miami: ["Art Deco buildings", "palm trees", "ocean waves"],
  "los-angeles": ["Hollywood sign", "palm trees", "LA skyline"],
  "new-york": ["Statue of Liberty", "Empire State Building", "Central Park"],
};

/**
 * Generate icon prompt using Claude - includes full style description for text-to-image
 */
async function generateIconPromptWithClaude(params: {
  cityName: string;
  cityCode: string;
  landmarks: string[];
  customGuidance?: string;
}): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.MODEL_API_KEY,
  });

  const customSection = params.customGuidance
    ? `\n\nADDITIONAL GUIDANCE FROM USER:\n${params.customGuidance}\n`
    : "";

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are an expert at writing image generation prompts for app icons.

I need a prompt for a city-branded summer camp app icon for ${params.cityName}.

The icon MUST have these exact characteristics:
1. Square app icon with rounded corners
2. The 3-letter city code "${params.cityCode}" in bold white text at the bottom
3. Feature ${params.cityName} landmarks: ${params.landmarks.join(", ")}
4. Playful, family-friendly summer camp vibe
5. Simple, clean vector-style illustration

CRITICAL COLOR REQUIREMENTS (match our brand exactly):
- Sky/background: Bright blue (#3B82F6)
- Nature elements (trees, grass): Emerald green (#10B981)
- Sun/warm accents: Amber yellow-orange (#F59E0B)
- Text: Bold white on dark background strip
- Keep it simple: only these 4-5 colors maximum

Style: Modern flat design, clean geometric shapes, minimal detail, no gradients, bold colors, looks great at 192x192px. Think Airbnb or Duolingo app icon style.${customSection}

Write ONLY the image prompt, no explanation. Be very specific about colors and composition.`
      }
    ]
  });

  const textContent = response.content.find(c => c.type === "text");
  return textContent?.text || `Square app icon for ${params.cityName} summer camps. Bold "${params.cityCode}" text in white at bottom. ${params.landmarks[0]} illustration in blue (#3B82F6), green (#10B981), amber (#F59E0B). Clean flat vector style.`;
}

/**
 * Generate city icon options using FAL with style reference
 */
export const generateCityIcons = action({
  args: {
    marketKey: v.string(),
    cityName: v.string(),
    cityCode: v.string(), // 3-letter code like "DEN", "SEA", "ATX"
    customGuidance: v.optional(v.string()), // Optional custom guidance for the icon
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    images?: string[]; // URLs of generated images
    error?: string;
  }> => {
    try {
      console.log(`Generating icons for market: ${args.marketKey}, city: ${args.cityName}, code: ${args.cityCode}`);

      // Get landmarks for this city
      const normalizedKey = args.marketKey.split("-")[0].toLowerCase();
      const landmarks = CITY_LANDMARKS[normalizedKey] || [
        `${args.cityName} skyline`,
        "local landmarks",
        "regional nature",
      ];

      console.log(`Using landmarks for ${normalizedKey}:`, landmarks);

      // Generate prompt with Claude
      const prompt = await generateIconPromptWithClaude({
        cityName: args.cityName,
        cityCode: args.cityCode,
        landmarks,
        customGuidance: args.customGuidance,
      });

      console.log(`Generated prompt for ${args.cityName}: ${prompt}`);

      // Use FLUX text-to-image with detailed style prompt
      // The prompt includes full brand color and style specifications
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

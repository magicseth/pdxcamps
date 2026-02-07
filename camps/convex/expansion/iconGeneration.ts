'use node';

/**
 * AI Icon Generation for New Markets
 *
 * Uses FAL.ai to generate branded city icons using the PDX icon as a style reference.
 * Claude Vision analyzes the reference icon's actual colors/style, then FAL generates
 * new icons at 1024x1024 that match the palette.
 */

import { action } from '../_generated/server';
import { api, internal } from '../_generated/api';
import { v } from 'convex/values';
import { fal } from '@fal-ai/client';
import Anthropic from '@anthropic-ai/sdk';

// Configure FAL client
fal.config({
  credentials: process.env.FAL_API_KEY,
});

// City landmarks for prompt generation
const CITY_LANDMARKS: Record<string, string[]> = {
  'denver': ['Rocky Mountains', 'Red Rocks Amphitheatre', 'Denver skyline', 'snowy peaks'],
  'seattle': ['Space Needle', 'Mount Rainier', 'Pike Place Market', 'evergreen trees'],
  'austin': ['Texas State Capitol', 'bats under Congress Bridge', 'live music signs', 'bluebonnets'],
  'atlanta': ['Georgia Dome', 'peach trees', 'Centennial Olympic Park fountain'],
  'phoenix': ['Camelback Mountain', 'saguaro cactus', 'desert sunset'],
  'boston': ['Fenway Park', 'Freedom Trail', 'Boston skyline', 'sailboats on Charles River'],
  'portland': ['Mt Hood', 'Portland skyline', 'Douglas fir trees', 'bridges'],
  'san-francisco': ['Golden Gate Bridge', 'cable cars', 'Victorian houses'],
  'san': ['Golden Gate Bridge', 'cable cars', 'San Francisco skyline', 'Bay Bridge'],
  'chicago': ['Willis Tower', 'Cloud Gate Bean', 'Lake Michigan'],
  'miami': ['Art Deco buildings', 'palm trees', 'ocean waves'],
  'los-angeles': ['Hollywood sign', 'palm trees', 'LA skyline'],
  'new-york': ['Statue of Liberty', 'Empire State Building', 'Central Park'],
};

/**
 * Generate icon prompt using Claude, optionally analyzing a reference image
 * for exact color/style matching via Vision API.
 */
async function generateIconPromptWithClaude(params: {
  cityName: string;
  cityCode: string;
  landmarks: string[];
  customGuidance?: string;
  referenceImageUrl?: string;
}): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.MODEL_API_KEY,
  });

  const customSection = params.customGuidance ? `\n\nADDITIONAL GUIDANCE FROM USER:\n${params.customGuidance}\n` : '';

  // If we have a reference image, use Claude Vision to analyze its exact colors
  if (params.referenceImageUrl) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: params.referenceImageUrl },
            },
            {
              type: 'text',
              text: `You are an expert at writing image generation prompts for app icons.

Look at this reference app icon carefully. I need you to generate a prompt for a NEW city icon for ${params.cityName} that uses the EXACT SAME color palette, illustration style, and composition as this reference.

Analyze the reference image and note:
- The exact background color (describe precisely)
- The exact colors of each element (mountain/landmark, sun, text, etc.)
- The illustration style (flat, geometric, gradients, etc.)
- The composition/layout

Now write a prompt for a ${params.cityName} icon that:
1. Uses the EXACT same colors you see in the reference (describe them precisely by hex code if possible)
2. Replaces the landmark with ${params.cityName} landmarks: ${params.landmarks.join(', ')}
3. Changes the text to "${params.cityCode}" (same style as reference)
4. Keeps the identical illustration style and composition
5. Square app icon, 1024x1024px${customSection}

Write ONLY the image generation prompt. Be extremely specific about colors — use the exact hex codes you observe in the reference. The generated icon must look like part of the same icon family.`,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (textContent?.text) return textContent.text;
  }

  // Fallback: no reference image, use hardcoded color descriptions
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are an expert at writing image generation prompts for app icons.

I need a prompt for a city-branded summer camp app icon for ${params.cityName}.

The icon MUST have these exact characteristics:
1. Square app icon with rounded corners, 1024x1024px
2. The 3-letter city code "${params.cityCode}" in bold white text at the bottom
3. Feature ${params.cityName} landmarks: ${params.landmarks.join(', ')}
4. Simple, clean vector-style illustration

CRITICAL COLOR REQUIREMENTS (match our brand exactly):
- Background: Muted steel blue (#64748B)
- Landmark silhouette: Dark slate blue (#334155)
- Sun/warm accents: Golden yellow (#EAB308)
- Text: Bold white on dark area at bottom
- Keep it simple: only these 4-5 colors maximum

Style: Modern flat design, clean geometric shapes, minimal detail, no gradients, muted sophisticated colors.${customSection}

Write ONLY the image prompt, no explanation. Be very specific about colors and composition.`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  return (
    textContent?.text ||
    `Square app icon for ${params.cityName} summer camps. Bold "${params.cityCode}" text in white at bottom. ${params.landmarks[0]} silhouette. Muted steel-blue background (#64748B), dark slate landmark (#334155), golden-yellow sun (#EAB308). Clean flat illustration style. 1024x1024px.`
  );
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    images?: string[]; // URLs of generated images
    error?: string;
  }> => {
    try {
      console.log(`Generating icons for market: ${args.marketKey}, city: ${args.cityName}, code: ${args.cityCode}`);

      // Get landmarks for this city
      const normalizedKey = args.marketKey.split('-')[0].toLowerCase();
      const landmarks = CITY_LANDMARKS[normalizedKey] || [
        `${args.cityName} skyline`,
        'local landmarks',
        'regional nature',
      ];

      console.log(`Using landmarks for ${normalizedKey}:`, landmarks);

      // Get the PDX reference icon from Convex storage for color/style analysis
      let referenceImageUrl: string | undefined;
      try {
        const pdxCity = await ctx.runQuery(internal.cities.queries.getCityBySlugInternal, { slug: 'portland' });
        if (pdxCity?.iconStorageId) {
          const url = await ctx.storage.getUrl(pdxCity.iconStorageId);
          if (url) referenceImageUrl = url;
        }
      } catch (e) {
        console.warn('Could not fetch PDX reference icon:', e);
      }

      console.log(
        `Reference image ${referenceImageUrl ? 'found — using Vision API for color matching' : 'not found — using hardcoded colors'}`,
      );

      // Generate prompt — Claude Vision analyzes reference icon colors if available
      const prompt = await generateIconPromptWithClaude({
        cityName: args.cityName,
        cityCode: args.cityCode,
        landmarks,
        customGuidance: args.customGuidance,
        referenceImageUrl,
      });

      console.log(`Generated prompt for ${args.cityName}: ${prompt}`);

      // Generate at 1024x1024 — largest square size, resize later if needed
      const result = await fal.subscribe('fal-ai/flux/schnell', {
        input: {
          prompt,
          image_size: 'square_hd', // 1024x1024
          num_images: 4,
          num_inference_steps: 4,
          enable_safety_checker: true,
        },
        logs: true,
      });

      const images = (result.data as { images?: Array<{ url: string }> })?.images?.map((img) => img.url) || [];

      if (images.length === 0) {
        return {
          success: false,
          error: 'No images generated',
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
      console.error('Icon generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      // Download the image
      const response = await fetch(args.imageUrl);
      if (!response.ok) {
        return { success: false, error: 'Failed to download image' };
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
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

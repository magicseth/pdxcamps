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

// Configure FAL client
fal.config({
  credentials: process.env.FAL_API_KEY,
});

/**
 * Extract specific activity from camp name and description
 */
function extractActivity(name: string, description: string): { activity: string; setting: string; props: string } {
  const text = `${name} ${description}`.toLowerCase();

  // Specific sports
  if (text.includes("basketball")) {
    return { activity: "playing basketball, dribbling and shooting hoops", setting: "on an outdoor basketball court", props: "basketballs and hoops" };
  }
  if (text.includes("soccer") || text.includes("futbol")) {
    return { activity: "playing soccer, kicking the ball and running on the field", setting: "on a grass soccer field with goals", props: "soccer balls and goals" };
  }
  if (text.includes("baseball") || text.includes("softball")) {
    return { activity: "playing baseball, batting and catching", setting: "on a baseball diamond", props: "bats, gloves, and baseballs" };
  }
  if (text.includes("tennis")) {
    return { activity: "playing tennis, hitting balls with rackets", setting: "on a tennis court", props: "tennis rackets and balls" };
  }
  if (text.includes("swimming") || text.includes("swim")) {
    return { activity: "swimming and splashing in the water", setting: "at an outdoor swimming pool", props: "pool noodles and kickboards" };
  }
  if (text.includes("gymnastics")) {
    return { activity: "doing gymnastics, tumbling and balancing", setting: "in a gymnasium with mats", props: "balance beams and gymnastics mats" };
  }
  if (text.includes("martial arts") || text.includes("karate") || text.includes("taekwondo")) {
    return { activity: "practicing martial arts moves and stances", setting: "in a dojo or training space", props: "training pads and uniforms" };
  }
  if (text.includes("archery")) {
    return { activity: "practicing archery, aiming bows at targets", setting: "at an archery range", props: "bows, arrows, and colorful targets" };
  }
  if (text.includes("rock climbing") || text.includes("climbing")) {
    return { activity: "rock climbing on a climbing wall", setting: "at an indoor climbing gym", props: "climbing holds and harnesses" };
  }

  // Arts & Crafts
  if (text.includes("pottery") || text.includes("ceramic")) {
    return { activity: "creating pottery on wheels and sculpting clay", setting: "in a pottery studio", props: "clay, pottery wheels, and colorful glazes" };
  }
  if (text.includes("painting") || text.includes("watercolor")) {
    return { activity: "painting colorful pictures on easels", setting: "in an art studio with large windows", props: "easels, paintbrushes, and palettes" };
  }
  if (text.includes("drawing") || text.includes("sketch")) {
    return { activity: "drawing and sketching artwork", setting: "at art tables", props: "sketchbooks, pencils, and colored markers" };
  }
  if (text.includes("sculpture") || text.includes("3d art")) {
    return { activity: "sculpting and building 3D art pieces", setting: "in an art workshop", props: "clay, wire, and sculpting tools" };
  }
  if (text.includes("fiber") || text.includes("weaving") || text.includes("textile")) {
    return { activity: "weaving and creating fiber art", setting: "in a craft room", props: "looms, yarn, and colorful threads" };
  }
  if (text.includes("jewelry") || text.includes("beading")) {
    return { activity: "making jewelry and beaded crafts", setting: "at craft tables", props: "beads, wire, and jewelry tools" };
  }

  // Performing Arts
  if (text.includes("theater") || text.includes("theatre") || text.includes("drama") || text.includes("acting")) {
    return { activity: "performing on stage with costumes", setting: "on a theater stage with curtains", props: "costumes, props, and stage lights" };
  }
  if (text.includes("dance") || text.includes("ballet") || text.includes("hip hop")) {
    return { activity: "dancing and moving expressively", setting: "in a dance studio with mirrors", props: "dance shoes and colorful outfits" };
  }
  if (text.includes("music") || text.includes("band") || text.includes("orchestra")) {
    return { activity: "playing musical instruments together", setting: "in a music room", props: "various instruments like drums, guitars, and keyboards" };
  }
  if (text.includes("singing") || text.includes("choir") || text.includes("vocal")) {
    return { activity: "singing together in harmony", setting: "on risers in a music room", props: "sheet music and microphones" };
  }
  if (text.includes("film") || text.includes("movie") || text.includes("video")) {
    return { activity: "making films with cameras and acting", setting: "on a film set", props: "cameras, clapboards, and lighting equipment" };
  }

  // STEM
  if (text.includes("coding") || text.includes("programming") || text.includes("computer")) {
    return { activity: "coding on laptops and creating programs", setting: "in a modern computer lab", props: "laptops, tablets, and colorful code on screens" };
  }
  if (text.includes("robot")) {
    return { activity: "building and programming robots", setting: "in a robotics lab", props: "robot parts, controllers, and tools" };
  }
  if (text.includes("science") || text.includes("experiment")) {
    return { activity: "doing exciting science experiments", setting: "in a science lab", props: "test tubes, beakers, and safety goggles" };
  }
  if (text.includes("engineering") || text.includes("build") || text.includes("construct")) {
    return { activity: "building and engineering projects", setting: "at workbenches", props: "tools, building materials, and blueprints" };
  }
  if (text.includes("math")) {
    return { activity: "solving puzzles and math challenges", setting: "in a classroom", props: "whiteboards, manipulatives, and puzzles" };
  }
  if (text.includes("space") || text.includes("astronomy") || text.includes("rocket")) {
    return { activity: "learning about space and building model rockets", setting: "with telescopes and space posters", props: "model rockets, planets, and star maps" };
  }
  if (text.includes("minecraft")) {
    return { activity: "playing Minecraft and building virtual worlds on computers", setting: "in a computer lab", props: "computers showing Minecraft builds" };
  }
  if (text.includes("game design") || text.includes("video game")) {
    return { activity: "designing and creating video games", setting: "in a game development studio", props: "computers, controllers, and game designs" };
  }

  // Nature & Outdoors
  if (text.includes("reptile") || text.includes("amphibian") || text.includes("lizard") || text.includes("frog") || text.includes("snake") || text.includes("turtle")) {
    return { activity: "learning about reptiles and amphibians, observing lizards and frogs", setting: "in a nature center", props: "terrariums, magnifying glasses, and live reptiles" };
  }
  if (text.includes("animal") || text.includes("wildlife") || text.includes("creature") || text.includes("zoo")) {
    return { activity: "learning about animals and wildlife", setting: "at a nature center", props: "animal habitats and educational displays" };
  }
  if (text.includes("bird") || text.includes("ornithology")) {
    return { activity: "birdwatching and learning about birds", setting: "outdoors with binoculars", props: "binoculars, bird guides, and feeders" };
  }
  if (text.includes("insect") || text.includes("bug") || text.includes("entomology")) {
    return { activity: "studying insects and bugs up close", setting: "outdoors in nature", props: "magnifying glasses, bug catchers, and specimen jars" };
  }
  if (text.includes("nature") || text.includes("ecology") || text.includes("environment")) {
    return { activity: "exploring nature and observing wildlife", setting: "in a forest with tall trees", props: "binoculars, magnifying glasses, and nature journals" };
  }
  if (text.includes("garden") || text.includes("farm") || text.includes("plant")) {
    return { activity: "gardening and planting seeds", setting: "in a community garden", props: "shovels, watering cans, and seed packets" };
  }
  if (text.includes("hiking") || text.includes("trail")) {
    return { activity: "hiking on nature trails", setting: "on a forest trail", props: "backpacks and hiking gear" };
  }
  if (text.includes("camping") || text.includes("wilderness") || text.includes("survival")) {
    return { activity: "learning camping and wilderness skills", setting: "at a campsite in the woods", props: "tents, campfire, and camping gear" };
  }
  if (text.includes("kayak") || text.includes("canoe") || text.includes("paddle")) {
    return { activity: "kayaking and paddling on calm water", setting: "on a peaceful lake", props: "kayaks, canoes, and paddles" };
  }
  if (text.includes("fish")) {
    return { activity: "fishing by a lake", setting: "at a dock on a calm lake", props: "fishing rods and tackle boxes" };
  }

  // Cooking & Food
  if (text.includes("cooking") || text.includes("culinary") || text.includes("chef")) {
    return { activity: "cooking and preparing delicious food", setting: "in a bright kitchen", props: "chef hats, mixing bowls, and fresh ingredients" };
  }
  if (text.includes("baking") || text.includes("pastry")) {
    return { activity: "baking cookies and treats", setting: "in a bakery kitchen", props: "aprons, mixing bowls, and decorated treats" };
  }

  // Adventure
  if (text.includes("adventure") || text.includes("explorer")) {
    return { activity: "going on exciting adventures and exploring", setting: "outdoors in varied terrain", props: "maps, compasses, and adventure gear" };
  }
  if (text.includes("skateboard") || text.includes("skate park")) {
    return { activity: "skateboarding and doing tricks", setting: "at a colorful skate park", props: "skateboards, helmets, and ramps" };
  }
  if (text.includes("bike") || text.includes("cycling") || text.includes("bmx")) {
    return { activity: "riding bikes on trails", setting: "on a bike path through nature", props: "bikes, helmets, and safety gear" };
  }

  // General categories
  if (text.includes("art")) {
    return { activity: "creating colorful artwork", setting: "in a bright art studio", props: "art supplies, easels, and creative materials" };
  }
  if (text.includes("sport") || text.includes("athletic")) {
    return { activity: "playing various sports and staying active", setting: "on athletic fields", props: "sports equipment and balls" };
  }

  // Default fallback - try to use the camp name
  const campNameWords = name.split(/\s+/).filter(w => w.length > 3).slice(0, 3).join(" ");
  return {
    activity: `participating in ${campNameWords.toLowerCase() || "fun camp"} activities`,
    setting: "at a summer camp",
    props: "various activity supplies"
  };
}

/**
 * Generate a prompt for image generation based on camp details
 */
function generatePrompt(camp: {
  name: string;
  description: string;
  categories: string[];
  organizationName?: string;
}): string {
  const { activity, setting, props } = extractActivity(camp.name, camp.description);

  // Extract key details from description (first sentence or up to 100 chars)
  const descSnippet = camp.description.split(/[.!?]/)[0]?.trim().slice(0, 100) || "";

  // Include org name if available
  const orgPrefix = camp.organizationName ? `${camp.organizationName} - ` : "";

  // Build a focused prompt using actual camp details
  const prompt = `${orgPrefix}${camp.name}: ${descSnippet}. Children ${activity}. ${props}. ${setting}. Natural light, shallow depth of field. Simple composition. No text or logos.`;

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

      // Call FAL to generate image using FLUX Schnell
      const result = await fal.subscribe("fal-ai/flux/schnell", {
        input: {
          prompt: args.prompt,
          image_size: "landscape_16_9",
          num_inference_steps: 4,
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

    // Get camps without images
    const camps = await ctx.runQuery(api.camps.queries.listAllCamps, {});
    const campsNeedingImages = camps.filter(
      (camp) =>
        (!camp.imageUrls || camp.imageUrls.length === 0) &&
        (!camp.imageStorageIds || camp.imageStorageIds.length === 0)
    );

    const campsToProcess = campsNeedingImages.slice(0, limit);
    const campNames = campsToProcess.map(c => c.name);

    // Pre-compute prompts for each camp
    const campData = campsToProcess.map(camp => ({
      campId: camp._id,
      campName: camp.name,
      prompt: generatePrompt(camp),
    }));

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

    const prompt = args.customPrompt || generatePrompt({
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
  args: {},
  handler: async (ctx): Promise<{
    count: number;
    camps: Array<{ id: string; name: string; categories: string[]; description: string }>;
  }> => {
    const camps = await ctx.runQuery(api.camps.queries.listAllCamps, {});

    const campsNeedingImages = camps.filter(
      (camp) =>
        (!camp.imageUrls || camp.imageUrls.length === 0) &&
        (!camp.imageStorageIds || camp.imageStorageIds.length === 0)
    );

    return {
      count: campsNeedingImages.length,
      camps: campsNeedingImages.map((camp) => ({
        id: camp._id,
        name: camp.name,
        categories: camp.categories,
        description: camp.description.substring(0, 200),
      })),
    };
  },
});

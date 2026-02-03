import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireFamily } from "../lib/auth";

/**
 * Add a new child to the current family.
 */
export const addChild = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    birthdate: v.string(), // ISO date "YYYY-MM-DD"
    currentGrade: v.optional(v.number()),
    interests: v.array(v.string()),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Validate birthdate format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.birthdate)) {
      throw new Error("Birthdate must be in YYYY-MM-DD format");
    }

    // Validate the date is valid and not in the future
    const birthDate = new Date(args.birthdate);
    if (isNaN(birthDate.getTime())) {
      throw new Error("Invalid birthdate");
    }
    if (birthDate > new Date()) {
      throw new Error("Birthdate cannot be in the future");
    }

    const childId = await ctx.db.insert("children", {
      familyId: family._id,
      firstName: args.firstName,
      lastName: args.lastName,
      birthdate: args.birthdate,
      currentGrade: args.currentGrade,
      interests: args.interests,
      notes: args.notes,
      color: args.color,
      isActive: true,
    });

    return childId;
  },
});

/**
 * Update an existing child's information.
 * Verifies the child belongs to the current family.
 */
export const updateChild = mutation({
  args: {
    childId: v.id("children"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    birthdate: v.optional(v.string()),
    currentGrade: v.optional(v.number()),
    interests: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }

    // Verify the child belongs to the current family
    if (child.familyId !== family._id) {
      throw new Error("Child does not belong to this family");
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (args.firstName !== undefined) {
      updates.firstName = args.firstName;
    }

    if (args.lastName !== undefined) {
      updates.lastName = args.lastName;
    }

    if (args.birthdate !== undefined) {
      // Validate birthdate format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(args.birthdate)) {
        throw new Error("Birthdate must be in YYYY-MM-DD format");
      }

      const birthDate = new Date(args.birthdate);
      if (isNaN(birthDate.getTime())) {
        throw new Error("Invalid birthdate");
      }
      if (birthDate > new Date()) {
        throw new Error("Birthdate cannot be in the future");
      }

      updates.birthdate = args.birthdate;
    }

    if (args.currentGrade !== undefined) {
      updates.currentGrade = args.currentGrade;
    }

    if (args.interests !== undefined) {
      updates.interests = args.interests;
    }

    if (args.notes !== undefined) {
      updates.notes = args.notes;
    }

    if (args.color !== undefined) {
      updates.color = args.color;
    }

    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
    }

    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.childId, updates);
    }

    return args.childId;
  },
});

/**
 * Generate or regenerate a share token for a child's summer plan.
 * This allows the plan to be viewed publicly via a shareable URL.
 */
export const generateShareToken = mutation({
  args: {
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }

    if (child.familyId !== family._id) {
      throw new Error("Child does not belong to this family");
    }

    // Generate a random token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await ctx.db.patch(args.childId, { shareToken: token });

    return token;
  },
});

/**
 * Remove share token to disable public sharing.
 */
export const removeShareToken = mutation({
  args: {
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }

    if (child.familyId !== family._id) {
      throw new Error("Child does not belong to this family");
    }

    await ctx.db.patch(args.childId, { shareToken: undefined });

    return true;
  },
});

/**
 * Generate a family share link for multiple children's summer plans.
 * Creates a single URL that shows all selected children's schedules.
 */
export const generateFamilyShareToken = mutation({
  args: {
    childIds: v.array(v.id("children")),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    if (args.childIds.length === 0) {
      throw new Error("At least one child must be selected");
    }

    // Verify all children belong to this family
    for (const childId of args.childIds) {
      const child = await ctx.db.get(childId);
      if (!child) {
        throw new Error("Child not found");
      }
      if (child.familyId !== family._id) {
        throw new Error("Child does not belong to this family");
      }
    }

    // Generate a random token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Create the family share record
    await ctx.db.insert("familyShares", {
      familyId: family._id,
      shareToken: token,
      childIds: args.childIds,
      createdAt: Date.now(),
    });

    return token;
  },
});

/**
 * Soft delete a child by marking them as inactive.
 * Verifies the child belongs to the current family.
 */
export const deactivateChild = mutation({
  args: {
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }

    // Verify the child belongs to the current family
    if (child.familyId !== family._id) {
      throw new Error("Child does not belong to this family");
    }

    // Soft delete by marking as inactive
    await ctx.db.patch(args.childId, {
      isActive: false,
    });

    return args.childId;
  },
});

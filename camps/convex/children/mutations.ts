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

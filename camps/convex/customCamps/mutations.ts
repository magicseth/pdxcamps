import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireFamily } from '../lib/auth';
import { enforceSavedCampLimit } from '../lib/paywall';

/**
 * Add a custom camp (not in our database) for a child
 *
 * PAYWALL: Counts toward the free-tier saved camp limit alongside registrations.
 */
export const addCustomCamp = mutation({
  args: {
    childId: v.id('children'),
    campName: v.string(),
    organizationName: v.optional(v.string()),
    location: v.optional(v.string()),
    website: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    dropOffTime: v.optional(v.string()),
    pickUpTime: v.optional(v.string()),
    price: v.optional(v.number()),
    status: v.union(v.literal('interested'), v.literal('registered'), v.literal('waitlisted'), v.literal('cancelled')),
    confirmationCode: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Verify child belongs to this family
    const child = await ctx.db.get(args.childId);
    if (!child || child.familyId !== family._id) {
      throw new Error('Child not found');
    }

    // === PAYWALL CHECK ===
    await enforceSavedCampLimit(ctx, family._id, 'add_custom_camp');
    // === END PAYWALL CHECK ===

    const customCampId = await ctx.db.insert('customCamps', {
      familyId: family._id,
      childId: args.childId,
      campName: args.campName,
      organizationName: args.organizationName,
      location: args.location,
      website: args.website,
      startDate: args.startDate,
      endDate: args.endDate,
      dropOffTime: args.dropOffTime,
      pickUpTime: args.pickUpTime,
      price: args.price,
      status: args.status,
      confirmationCode: args.confirmationCode,
      notes: args.notes,
      createdAt: Date.now(),
      isActive: true,
    });

    return customCampId;
  },
});

/**
 * Update a custom camp
 */
export const updateCustomCamp = mutation({
  args: {
    customCampId: v.id('customCamps'),
    campName: v.optional(v.string()),
    organizationName: v.optional(v.string()),
    location: v.optional(v.string()),
    website: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    dropOffTime: v.optional(v.string()),
    pickUpTime: v.optional(v.string()),
    price: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal('interested'), v.literal('registered'), v.literal('waitlisted'), v.literal('cancelled')),
    ),
    confirmationCode: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const customCamp = await ctx.db.get(args.customCampId);
    if (!customCamp || customCamp.familyId !== family._id) {
      throw new Error('Custom camp not found');
    }

    const { customCampId, ...updates } = args;

    // Filter out undefined values
    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }

    if (Object.keys(cleanUpdates).length > 0) {
      await ctx.db.patch(customCampId, cleanUpdates);
    }

    return customCampId;
  },
});

/**
 * Delete (deactivate) a custom camp
 */
export const deleteCustomCamp = mutation({
  args: {
    customCampId: v.id('customCamps'),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const customCamp = await ctx.db.get(args.customCampId);
    if (!customCamp || customCamp.familyId !== family._id) {
      throw new Error('Custom camp not found');
    }

    await ctx.db.patch(args.customCampId, { isActive: false });

    return args.customCampId;
  },
});

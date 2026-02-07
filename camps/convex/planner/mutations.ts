import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireFamily } from '../lib/auth';

/**
 * Event type validator
 */
const eventTypeValidator = v.union(
  v.literal('vacation'),
  v.literal('family_visit'),
  v.literal('day_camp'),
  v.literal('summer_school'),
  v.literal('other'),
);

/**
 * Create a new family event (vacation, trip, etc.)
 */
export const createFamilyEvent = mutation({
  args: {
    childIds: v.array(v.id('children')),
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    eventType: eventTypeValidator,
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Validate that all children belong to this family
    const children = await Promise.all(args.childIds.map((id) => ctx.db.get(id)));

    for (const child of children) {
      if (!child) {
        throw new Error('Child not found');
      }
      if (child.familyId !== family._id) {
        throw new Error('Child does not belong to this family');
      }
    }

    // Validate dates
    if (args.startDate > args.endDate) {
      throw new Error('Start date must be before or equal to end date');
    }

    // Create the event
    const eventId = await ctx.db.insert('familyEvents', {
      familyId: family._id,
      childIds: args.childIds,
      title: args.title,
      description: args.description,
      startDate: args.startDate,
      endDate: args.endDate,
      eventType: args.eventType,
      location: args.location,
      notes: args.notes,
      color: args.color,
      isActive: true,
    });

    return eventId;
  },
});

/**
 * Update an existing family event
 */
export const updateFamilyEvent = mutation({
  args: {
    eventId: v.id('familyEvents'),
    childIds: v.optional(v.array(v.id('children'))),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    eventType: v.optional(eventTypeValidator),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Get the existing event
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Verify the event belongs to this family
    if (event.familyId !== family._id) {
      throw new Error('Event does not belong to this family');
    }

    // If updating children, validate they belong to this family
    if (args.childIds) {
      const children = await Promise.all(args.childIds.map((id) => ctx.db.get(id)));

      for (const child of children) {
        if (!child) {
          throw new Error('Child not found');
        }
        if (child.familyId !== family._id) {
          throw new Error('Child does not belong to this family');
        }
      }
    }

    // Validate dates if provided
    const startDate = args.startDate ?? event.startDate;
    const endDate = args.endDate ?? event.endDate;
    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date');
    }

    // Build update object
    const updates: Partial<typeof event> = {};
    if (args.childIds !== undefined) updates.childIds = args.childIds;
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.eventType !== undefined) updates.eventType = args.eventType;
    if (args.location !== undefined) updates.location = args.location;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.color !== undefined) updates.color = args.color;

    await ctx.db.patch(args.eventId, updates);

    return args.eventId;
  },
});

/**
 * Delete a family event (soft delete - sets isActive to false)
 */
export const deleteFamilyEvent = mutation({
  args: {
    eventId: v.id('familyEvents'),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Get the existing event
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Verify the event belongs to this family
    if (event.familyId !== family._id) {
      throw new Error('Event does not belong to this family');
    }

    // Soft delete
    await ctx.db.patch(args.eventId, { isActive: false });

    return args.eventId;
  },
});

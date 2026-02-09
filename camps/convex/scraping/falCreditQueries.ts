/**
 * FAL Credit Status — queries and mutations for the systemFlags table.
 * Separated from falCreditCheck.ts because this file must NOT have "use node".
 */

import { internalQuery, internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Get a system flag by key
 */
export const getFlag = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const flag = await ctx.db
      .query('systemFlags')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .first();
    return flag;
  },
});

/**
 * Set a system flag (upsert)
 */
export const setFlag = internalMutation({
  args: {
    key: v.string(),
    value: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('systemFlags')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        message: args.message,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('systemFlags', {
        key: args.key,
        value: args.value,
        message: args.message,
        updatedAt: Date.now(),
      });
    }
  },
});

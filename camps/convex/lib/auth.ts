import { QueryCtx, MutationCtx } from '../_generated/server';
import { Doc } from '../_generated/dataModel';

/**
 * Gets the current authenticated family from the database using the WorkOS user ID from the JWT.
 * Returns null if not authenticated or family not found.
 */
export async function getFamily(ctx: QueryCtx | MutationCtx): Promise<Doc<'families'> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const workosUserId = identity.subject;
  const family = await ctx.db
    .query('families')
    .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', workosUserId))
    .unique();

  return family;
}

/**
 * Throws if not authenticated, returns the auth info.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }
  return identity;
}

/**
 * Throws if not authenticated or family not found, returns the family.
 */
export async function requireFamily(ctx: QueryCtx | MutationCtx): Promise<Doc<'families'>> {
  const identity = await requireAuth(ctx);

  const workosUserId = identity.subject;
  const family = await ctx.db
    .query('families')
    .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', workosUserId))
    .unique();

  if (!family) {
    throw new Error('Family not found');
  }

  return family;
}

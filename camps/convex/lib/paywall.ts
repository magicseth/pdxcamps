import { MutationCtx } from '../_generated/server';
import { components } from '../_generated/api';
import { ConvexError } from 'convex/values';
import { Id } from '../_generated/dataModel';

/**
 * Free tier limit for saved/active camps (registrations + custom camps).
 * This is the single source of truth used by all paywall checks.
 */
export const FREE_SAVED_CAMPS_LIMIT = 5;

/**
 * Check if the current user has an active premium subscription.
 * Returns false (rather than throwing) if the Stripe component fails,
 * so we degrade gracefully to free-tier behavior.
 */
export async function checkIsPremium(ctx: MutationCtx): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  try {
    const subscriptions = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, {
      userId: identity.subject,
    });
    return subscriptions.some((sub) => sub.status === 'active' || sub.status === 'trialing');
  } catch (e) {
    // If Stripe component fails, assume not premium but don't block the user
    console.error('Failed to check subscription status:', e);
    return false;
  }
}

/**
 * Count a family's active saved camps across both registrations and custom camps.
 * "Active" means interested, registered, or waitlisted (not cancelled).
 */
export async function countActiveSavedCamps(ctx: MutationCtx, familyId: Id<'families'>): Promise<number> {
  // Count active registrations
  const registrations = await ctx.db
    .query('registrations')
    .withIndex('by_family', (q) => q.eq('familyId', familyId))
    .collect();

  const activeRegistrations = registrations.filter(
    (r) => r.status === 'interested' || r.status === 'registered' || r.status === 'waitlisted',
  ).length;

  // Count active custom camps
  const customCamps = await ctx.db
    .query('customCamps')
    .withIndex('by_family', (q) => q.eq('familyId', familyId))
    .collect();

  const activeCustomCamps = customCamps.filter((c) => c.isActive && c.status !== 'cancelled').length;

  return activeRegistrations + activeCustomCamps;
}

type PaywallAction = 'save_camp' | 'add_custom_camp';

/**
 * Enforce the free-tier saved camp limit.
 *
 * Call this in any mutation that adds a new saved camp (markInterested,
 * addCustomCamp, joinWaitlist when creating a new registration).
 *
 * Premium users pass through. Free users over the limit get a ConvexError
 * with type: "PAYWALL" that the frontend catches to show the upgrade modal.
 */
export async function enforceSavedCampLimit(
  ctx: MutationCtx,
  familyId: Id<'families'>,
  action: PaywallAction,
): Promise<void> {
  const isPremium = await checkIsPremium(ctx);
  if (isPremium) return;

  const savedCount = await countActiveSavedCamps(ctx, familyId);

  if (savedCount >= FREE_SAVED_CAMPS_LIMIT) {
    throw new ConvexError({
      type: 'PAYWALL',
      code: 'CAMP_LIMIT',
      savedCount,
      limit: FREE_SAVED_CAMPS_LIMIT,
    });
  }
}

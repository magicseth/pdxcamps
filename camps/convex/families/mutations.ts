import { mutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { requireAuth, requireFamily, getFamily } from '../lib/auth';
import { addressValidator, calendarSharingDefaultValidator } from '../lib/validators';

// Flag to control new user notifications (set to true to enable)
const NOTIFY_ON_SIGNUP = true;

/**
 * Create a new family for the current authenticated user.
 * Throws if user is not authenticated or already has a family.
 */
export const createFamily = mutation({
  args: {
    displayName: v.string(),
    email: v.string(),
    primaryCityId: v.id('cities'),
    calendarSharingDefault: calendarSharingDefaultValidator,
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Check if user already has a family
    const existingFamily = await getFamily(ctx);
    if (existingFamily) {
      throw new Error('User already has a family');
    }

    // Verify the city exists
    const city = await ctx.db.get(args.primaryCityId);
    if (!city) {
      throw new Error('City not found');
    }

    // Validate referral code if provided
    let validReferralCode: string | undefined;
    if (args.referralCode) {
      const referral = await ctx.db
        .query('referrals')
        .withIndex('by_code', (q) => q.eq('referralCode', args.referralCode!))
        .first();
      if (referral) {
        validReferralCode = args.referralCode;
      }
    }

    const familyId = await ctx.db.insert('families', {
      workosUserId: identity.subject,
      email: args.email,
      displayName: args.displayName,
      primaryCityId: args.primaryCityId,
      calendarSharingDefault: args.calendarSharingDefault,
      referredByCode: validReferralCode,
    });

    // Create pending referral event if valid code
    if (validReferralCode) {
      await ctx.scheduler.runAfter(0, internal.referrals.mutations.attributeReferral, {
        refereeFamilyId: familyId,
        referralCode: validReferralCode,
      });
    }

    // Check for pending friend invitations and auto-create friend requests
    const pendingInvites = await ctx.db
      .query('friendInvitations')
      .withIndex('by_invited_email', (q) => q.eq('invitedEmail', args.email).eq('status', 'pending'))
      .collect();

    for (const invite of pendingInvites) {
      // Create a friend request from the inviter
      await ctx.db.insert('friendships', {
        requesterId: invite.inviterFamilyId,
        addresseeId: familyId,
        status: 'pending',
      });
      // Mark the invitation as accepted
      await ctx.db.patch(invite._id, { status: 'accepted' });
    }

    // Notify Seth about new signups
    if (NOTIFY_ON_SIGNUP) {
      await ctx.scheduler.runAfter(0, internal.email.sendNewUserNotification, {
        userEmail: args.email,
        displayName: args.displayName,
        cityName: city.name,
        brandName: city.brandName || 'PDX Camps',
      });
    }

    return familyId;
  },
});

/**
 * Update the current family's settings.
 * All fields are optional - only provided fields will be updated.
 */
export const updateFamily = mutation({
  args: {
    displayName: v.optional(v.string()),
    primaryCityId: v.optional(v.id('cities')),
    homeNeighborhoodId: v.optional(v.id('neighborhoods')),
    homeAddress: v.optional(addressValidator),
    maxDriveTimeMinutes: v.optional(v.number()),
    calendarSharingDefault: v.optional(calendarSharingDefaultValidator),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (args.displayName !== undefined) {
      updates.displayName = args.displayName;
    }

    if (args.primaryCityId !== undefined) {
      // Verify the city exists
      const city = await ctx.db.get(args.primaryCityId);
      if (!city) {
        throw new Error('City not found');
      }
      updates.primaryCityId = args.primaryCityId;
    }

    if (args.homeNeighborhoodId !== undefined) {
      // Verify the neighborhood exists
      const neighborhood = await ctx.db.get(args.homeNeighborhoodId);
      if (!neighborhood) {
        throw new Error('Neighborhood not found');
      }
      updates.homeNeighborhoodId = args.homeNeighborhoodId;
    }

    if (args.homeAddress !== undefined) {
      updates.homeAddress = args.homeAddress;
    }

    if (args.maxDriveTimeMinutes !== undefined) {
      if (args.maxDriveTimeMinutes < 0) {
        throw new Error('Max drive time must be non-negative');
      }
      updates.maxDriveTimeMinutes = args.maxDriveTimeMinutes;
    }

    if (args.calendarSharingDefault !== undefined) {
      updates.calendarSharingDefault = args.calendarSharingDefault;
    }

    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(family._id, updates);
    }

    return family._id;
  },
});

/**
 * Admin: Update a family's WorkOS user ID (for migration fixes)
 */
export const adminUpdateWorkosUserId = mutation({
  args: {
    familyId: v.id('families'),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const family = await ctx.db.get(args.familyId);
    if (!family) {
      throw new Error('Family not found');
    }
    await ctx.db.patch(args.familyId, {
      workosUserId: args.workosUserId,
    });
    return args.familyId;
  },
});

/**
 * Mark the current family's onboarding as completed.
 * Sends welcome email immediately and schedules tips email for next day.
 * Also completes any pending referral and awards credit to the referrer.
 */
export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const family = await requireFamily(ctx);

    // Only send emails and update if not already completed
    if (family.onboardingCompletedAt === undefined) {
      await ctx.db.patch(family._id, {
        onboardingCompletedAt: Date.now(),
      });

      // Get the city info for personalized emails
      const city = await ctx.db.get(family.primaryCityId);
      const cityName = city?.name || 'your area';
      const brandName = city?.brandName || 'PDX Camps';
      const domain = city?.domain || 'pdxcamps.com';
      const fromEmail = city?.fromEmail || 'hello@pdxcamps.com';

      // Send welcome email immediately
      await ctx.scheduler.runAfter(0, internal.email.sendWelcomeEmail, {
        to: family.email,
        displayName: family.displayName,
        cityName,
        brandName,
        domain,
        fromEmail,
      });

      // Schedule tips email for 24 hours later
      const oneDayMs = 24 * 60 * 60 * 1000;
      await ctx.scheduler.runAfter(oneDayMs, internal.email.sendTipsEmail, {
        to: family.email,
        displayName: family.displayName,
        cityName,
        brandName,
        domain,
        fromEmail,
      });

      // Generate referral code and schedule referral email for day 3
      const referralCode = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      await ctx.db.insert('referrals', {
        referrerFamilyId: family._id,
        referralCode,
        creditsEarned: 0,
        creditsApplied: 0,
        createdAt: Date.now(),
      });

      // Schedule referral email for 72 hours (3 days) later
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      await ctx.scheduler.runAfter(threeDaysMs, internal.email.sendReferralEmail, {
        to: family.email,
        displayName: family.displayName,
        referralCode,
        brandName,
        domain,
        fromEmail,
      });

      // Complete referral if this family was referred
      if (family.referredByCode) {
        await ctx.scheduler.runAfter(0, internal.referrals.mutations.completeReferral, {
          refereeFamilyId: family._id,
        });
      }
    }

    return family._id;
  },
});

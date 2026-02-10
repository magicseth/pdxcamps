'use node';

/**
 * Email Automation Actions
 *
 * Cron-triggered actions for:
 * - 7-day re-engagement emails
 * - Weekly digest emails
 * - Summer countdown emails
 * - Camp request fulfilled notifications
 * - Paywall upgrade nudge
 */

import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { resend } from '../email';

// ============================================
// HELPERS
// ============================================

function formatPrice(cents: number): string {
  return cents > 0 ? `$${(cents / 100).toFixed(0)}` : 'Free';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function emailFooter(brandName: string, domain: string, unsubscribeNote: boolean): string {
  return `
    <p style="color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
      — The ${brandName} Team<br/>
      <a href="https://${domain}" style="color: #E5A33B;">${domain}</a>
      ${unsubscribeNote ? `<br/><a href="https://${domain}/settings" style="color: #999;">Manage email preferences</a>` : ''}
    </p>
  `;
}

function textFooter(brandName: string, domain: string, unsubscribeNote: boolean): string {
  return `\n---\n— The ${brandName} Team\n${domain}${unsubscribeNote ? `\nManage email preferences: https://${domain}/settings` : ''}`;
}

// ============================================
// RE-ENGAGEMENT (Daily cron)
// ============================================

export const processReEngagement = internalAction({
  args: {},
  handler: async (ctx) => {
    const inactiveFamilies = await ctx.runQuery(
      internal.emailAutomation.queries.getInactiveFamilies,
    );

    let sent = 0;
    const errors: string[] = [];

    for (const family of inactiveFamilies) {
      try {
        // Get brand info
        const brand = await ctx.runQuery(internal.emailAutomation.queries.getCityBrand, {
          cityId: family.primaryCityId,
        });
        if (!brand) continue;

        // Get new sessions for their city
        const newSessions = await ctx.runQuery(
          internal.emailAutomation.queries.getRecentSessionsForCity,
          { cityId: family.primaryCityId, limit: 3 },
        );

        // Only send if there's something to show
        if (newSessions.length === 0) continue;

        const sessionCardsHtml = newSessions
          .map(
            (s) => `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0;">
            <h3 style="margin: 0 0 4px 0; color: #1a1a1a; font-size: 16px;">${s.campName}</h3>
            <p style="margin: 2px 0; color: #666; font-size: 14px;">${s.organizationName}</p>
            <p style="margin: 2px 0; color: #666; font-size: 14px;">${formatDate(s.startDate)} - ${formatDate(s.endDate)} &middot; ${formatPrice(s.price)}</p>
          </div>
        `,
          )
          .join('');

        const sessionCardsText = newSessions
          .map(
            (s) =>
              `- ${s.campName} (${s.organizationName})\n  ${formatDate(s.startDate)} - ${formatDate(s.endDate)} | ${formatPrice(s.price)}`,
          )
          .join('\n');

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <p>Hi ${family.displayName},</p>

            <p>We've added <strong>${newSessions.length} new camp${newSessions.length > 1 ? 's' : ''}</strong> near you since your last visit. Here's a preview:</p>

            ${sessionCardsHtml}

            <p style="text-align: center; margin: 24px 0;">
              <a href="https://${brand.domain}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">See What's New</a>
            </p>

            ${emailFooter(brand.brandName, brand.domain, true)}
          </div>
        `;

        const text = `Hi ${family.displayName},\n\nWe've added ${newSessions.length} new camp${newSessions.length > 1 ? 's' : ''} near you since your last visit:\n\n${sessionCardsText}\n\nSee what's new: https://${brand.domain}${textFooter(brand.brandName, brand.domain, true)}`;

        const emailId = await resend.sendEmail(ctx, {
          from: `${brand.brandName} <${brand.fromEmail}>`,
          to: [family.email],
          subject: `${newSessions.length} new camp${newSessions.length > 1 ? 's' : ''} added near you`,
          html,
          text,
        });

        await ctx.runMutation(internal.emailAutomation.mutations.recordAutomatedEmail, {
          familyId: family.familyId,
          emailType: 're_engagement',
          emailId: emailId as string,
        });

        sent++;
      } catch (error) {
        errors.push(
          `Re-engagement to ${family.email}: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    console.log(`Re-engagement: ${sent} sent, ${errors.length} errors`);
    return { sent, errors };
  },
});

// ============================================
// WEEKLY DIGEST (Monday cron)
// ============================================

export const processWeeklyDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const families = await ctx.runQuery(
      internal.emailAutomation.queries.getDigestEligibleFamilies,
    );

    let sent = 0;
    const errors: string[] = [];

    // Dedupe key for this week
    const now = new Date();
    const weekKey = `${now.getFullYear()}-W${Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;

    for (const family of families) {
      try {
        const brand = await ctx.runQuery(internal.emailAutomation.queries.getCityBrand, {
          cityId: family.primaryCityId,
        });
        if (!brand) continue;

        const data = await ctx.runQuery(
          internal.emailAutomation.queries.getWeeklyDigestData,
          { familyId: family.familyId, cityId: family.primaryCityId },
        );

        // Skip if there's nothing to report
        if (
          data.newSessionsThisWeek === 0 &&
          data.fillingUp === 0 &&
          data.savedCampUpdates.length === 0
        ) {
          continue;
        }

        // Build saved camps section
        let savedCampsHtml = '';
        let savedCampsText = '';
        if (data.savedCampUpdates.length > 0) {
          savedCampsHtml = `
            <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 24px;">Your Saved Camps</h2>
          `;
          for (const camp of data.savedCampUpdates) {
            const statusLabel =
              camp.status === 'active'
                ? '&#x2705; Open'
                : camp.status === 'sold_out'
                  ? '&#x274C; Sold Out'
                  : camp.status;
            const spotsLabel =
              camp.spotsRemaining !== null ? ` &middot; ${camp.spotsRemaining} spots left` : '';
            savedCampsHtml += `<p style="margin: 4px 0; font-size: 14px;">${statusLabel} <strong>${camp.campName}</strong>${spotsLabel}</p>`;
            savedCampsText += `- ${camp.campName}: ${camp.status}${camp.spotsRemaining !== null ? ` (${camp.spotsRemaining} spots left)` : ''}\n`;
          }
        }

        // Build new camps section
        let newCampsHtml = '';
        let newCampsText = '';
        if (data.newCampDetails.length > 0) {
          newCampsHtml = `
            <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 24px;">New This Week</h2>
          `;
          for (const camp of data.newCampDetails) {
            newCampsHtml += `
              <div style="background: #f0fdf4; border-radius: 6px; padding: 12px; margin: 8px 0;">
                <strong>${camp.campName}</strong>
                <p style="margin: 2px 0; color: #666; font-size: 14px;">${camp.organizationName} &middot; ${formatDate(camp.startDate)} &middot; ${formatPrice(camp.price)}</p>
              </div>
            `;
            newCampsText += `- ${camp.campName} (${camp.organizationName}) - ${formatDate(camp.startDate)} - ${formatPrice(camp.price)}\n`;
          }
        }

        // Stats summary
        const statsHtml = `
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0; font-size: 14px;"><strong>${data.totalActiveSessions}</strong> active sessions in ${brand.cityName}</p>
            ${data.newSessionsThisWeek > 0 ? `<p style="margin: 4px 0; font-size: 14px;"><strong>${data.newSessionsThisWeek}</strong> new this week</p>` : ''}
            ${data.fillingUp > 0 ? `<p style="margin: 4px 0; font-size: 14px; color: #dc2626;"><strong>${data.fillingUp}</strong> camp${data.fillingUp > 1 ? 's' : ''} filling up fast</p>` : ''}
          </div>
        `;

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a1a; font-size: 22px; margin-bottom: 4px;">Your Summer Planning Update</h1>
            <p style="color: #666; margin-top: 0;">Hi ${family.displayName}, here's this week's update for ${brand.cityName}.</p>

            ${statsHtml}
            ${savedCampsHtml}
            ${newCampsHtml}

            <p style="text-align: center; margin: 24px 0;">
              <a href="https://${brand.domain}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Your Planner</a>
            </p>

            ${emailFooter(brand.brandName, brand.domain, true)}
          </div>
        `;

        const text = `Your Summer Planning Update\n\nHi ${family.displayName}, here's this week's update for ${brand.cityName}.\n\n${data.totalActiveSessions} active sessions${data.newSessionsThisWeek > 0 ? ` | ${data.newSessionsThisWeek} new this week` : ''}${data.fillingUp > 0 ? ` | ${data.fillingUp} filling up` : ''}\n\n${savedCampsText}${newCampsText}\nView your planner: https://${brand.domain}${textFooter(brand.brandName, brand.domain, true)}`;

        const emailId = await resend.sendEmail(ctx, {
          from: `${brand.brandName} <${brand.fromEmail}>`,
          to: [family.email],
          subject: `Your Summer Planning Update — ${brand.cityName}`,
          html,
          text,
        });

        await ctx.runMutation(internal.emailAutomation.mutations.recordAutomatedEmail, {
          familyId: family.familyId,
          emailType: 'weekly_digest',
          emailId: emailId as string,
          dedupeKey: weekKey,
        });

        sent++;
      } catch (error) {
        errors.push(
          `Digest to ${family.email}: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    console.log(`Weekly digest: ${sent} sent, ${errors.length} errors`);
    return { sent, errors };
  },
});

// ============================================
// SUMMER COUNTDOWN (Weekly Feb-May cron)
// ============================================

export const processSummerCountdown = internalAction({
  args: {},
  handler: async (ctx) => {
    const families = await ctx.runQuery(
      internal.emailAutomation.queries.getCountdownEligibleFamilies,
    );

    if (families.length === 0) return { sent: 0, errors: [] };

    let sent = 0;
    const errors: string[] = [];

    // Group by city to avoid re-fetching stats
    const cityStatsCache = new Map<string, Awaited<ReturnType<typeof ctx.runQuery>>>();

    for (const family of families) {
      try {
        const brand = await ctx.runQuery(internal.emailAutomation.queries.getCityBrand, {
          cityId: family.primaryCityId,
        });
        if (!brand) continue;

        // Cache city stats
        const cityIdStr = family.primaryCityId as string;
        if (!cityStatsCache.has(cityIdStr)) {
          cityStatsCache.set(
            cityIdStr,
            await ctx.runQuery(internal.emailAutomation.queries.getSummerCountdownStats, {
              cityId: family.primaryCityId,
            }),
          );
        }
        const stats = cityStatsCache.get(cityIdStr) as {
          totalSessions: number;
          registrationOpenPct: number;
          filledSessions: number;
          organizationCount: number;
        };

        const weeks = family.weeksUntilSummer;

        // Different messaging by urgency
        let headline: string;
        let urgencyNote: string;
        if (weeks <= 2) {
          headline = `Summer starts in ${weeks} week${weeks > 1 ? 's' : ''}!`;
          urgencyNote =
            'This is it — the final stretch before summer camps begin. Many popular sessions are already full.';
        } else if (weeks <= 4) {
          headline = `Just ${weeks} weeks until summer`;
          urgencyNote =
            'The most popular camps are filling up fast. Now is the time to lock in your spots.';
        } else if (weeks <= 8) {
          headline = `${weeks} weeks until summer — time to plan`;
          urgencyNote =
            'Early birds get the best picks. Start browsing now while you have the most options.';
        } else {
          headline = `Summer is ${weeks} weeks away`;
          urgencyNote =
            "It's never too early to start planning! Browse what's available and save your favorites.";
        }

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
              <h1 style="color: #92400e; margin: 0 0 8px 0; font-size: 24px;">${headline}</h1>
              <p style="color: #a16207; margin: 0;">${urgencyNote}</p>
            </div>

            <p>Hi ${family.displayName},</p>

            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0; font-size: 14px;"><strong>${stats.totalSessions}</strong> camp sessions available in ${brand.cityName}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>${stats.organizationCount}</strong> organizations offering camps</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>${stats.registrationOpenPct}%</strong> have registration open</p>
              ${stats.filledSessions > 0 ? `<p style="margin: 4px 0; font-size: 14px; color: #dc2626;"><strong>${stats.filledSessions}</strong> already sold out</p>` : ''}
            </div>

            <p style="text-align: center; margin: 24px 0;">
              <a href="https://${brand.domain}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Plan Your Summer</a>
            </p>

            ${emailFooter(brand.brandName, brand.domain, true)}
          </div>
        `;

        const text = `${headline}\n\n${urgencyNote}\n\nHi ${family.displayName},\n\n${stats.totalSessions} camp sessions available in ${brand.cityName}\n${stats.organizationCount} organizations offering camps\n${stats.registrationOpenPct}% have registration open${stats.filledSessions > 0 ? `\n${stats.filledSessions} already sold out` : ''}\n\nPlan your summer: https://${brand.domain}${textFooter(brand.brandName, brand.domain, true)}`;

        // Dedupe key for this week
        const now = new Date();
        const weekKey = `${now.getFullYear()}-W${Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;

        const emailId = await resend.sendEmail(ctx, {
          from: `${brand.brandName} <${brand.fromEmail}>`,
          to: [family.email],
          subject: `${headline} — ${brand.cityName} Camp Update`,
          html,
          text,
        });

        await ctx.runMutation(internal.emailAutomation.mutations.recordAutomatedEmail, {
          familyId: family.familyId,
          emailType: 'summer_countdown',
          emailId: emailId as string,
          dedupeKey: weekKey,
        });

        sent++;
      } catch (error) {
        errors.push(
          `Countdown to ${family.email}: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    console.log(`Summer countdown: ${sent} sent, ${errors.length} errors`);
    return { sent, errors };
  },
});

// ============================================
// CAMP REQUEST FULFILLED
// ============================================

export const sendCampRequestFulfilledEmail = internalAction({
  args: {
    requestId: v.id('campRequests'),
  },
  handler: async (ctx, args) => {
    const details = await ctx.runQuery(
      internal.emailAutomation.queries.getCampRequestDetails,
      { requestId: args.requestId },
    );

    if (!details || details.alreadySent) return { sent: false };

    const campUrl = details.websiteUrl
      ? `<p style="margin: 12px 0;"><a href="${details.websiteUrl}" style="display: inline-block; padding: 10px 20px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">View Camp Details</a></p>`
      : '';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
          <h1 style="color: #16a34a; margin: 0 0 8px 0; font-size: 22px;">Camp Added!</h1>
          <p style="color: #047857; margin: 0;">We added <strong>${details.campName}</strong> to ${details.cityName} Camps</p>
        </div>

        <p>Hi ${details.displayName},</p>

        <p>Great news! The camp you requested — <strong>${details.campName}</strong>${details.organizationName ? ` by ${details.organizationName}` : ''} — has been added to ${details.brandName}.</p>

        <p>You can now browse their sessions, save your favorites, and add them to your summer planner.</p>

        ${campUrl}

        <p style="text-align: center; margin: 24px 0;">
          <a href="https://${details.domain}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Check It Out</a>
        </p>

        ${emailFooter(details.brandName, details.domain, false)}
      </div>
    `;

    const text = `Camp Added!\n\nHi ${details.displayName},\n\nGreat news! The camp you requested — ${details.campName}${details.organizationName ? ` by ${details.organizationName}` : ''} — has been added to ${details.brandName}.\n\nYou can now browse their sessions, save your favorites, and add them to your summer planner.\n\nCheck it out: https://${details.domain}${textFooter(details.brandName, details.domain, false)}`;

    const emailId = await resend.sendEmail(ctx, {
      from: `${details.brandName} <${details.fromEmail}>`,
      to: [details.email],
      subject: `We added ${details.campName} to ${details.cityName} Camps!`,
      html,
      text,
    });

    await ctx.runMutation(internal.emailAutomation.mutations.recordAutomatedEmail, {
      familyId: details.familyId,
      emailType: 'camp_request_fulfilled',
      emailId: emailId as string,
      dedupeKey: args.requestId,
    });

    return { sent: true };
  },
});

// ============================================
// PAYWALL UPGRADE NUDGE
// ============================================

export const sendPaywallNudgeEmail = internalAction({
  args: {
    familyId: v.id('families'),
    savedCamps: v.array(
      v.object({
        campName: v.string(),
        organizationName: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Get family info
    const brand = await ctx.runQuery(internal.notifications.queries.getFamilyCityBrand, {
      familyId: args.familyId,
    });

    // Get family email
    const families = await ctx.runQuery(
      internal.emailAutomation.queries.getDigestEligibleFamilies,
    );
    const family = families.find((f) => f.familyId === args.familyId);
    if (!family || !brand) return { sent: false };

    // Check if we already sent a paywall nudge recently (within 7 days)
    // We use the existing query infrastructure - just check the record
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekKey = `paywall-${Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))}`;

    const savedCampsHtml = args.savedCamps
      .map(
        (c) =>
          `<li style="margin: 4px 0;"><strong>${c.campName}</strong> <span style="color: #666;">by ${c.organizationName}</span></li>`,
      )
      .join('');

    const savedCampsText = args.savedCamps
      .map((c) => `- ${c.campName} by ${c.organizationName}`)
      .join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${family.displayName},</p>

        <p>You've been busy planning! You've saved <strong>5 camps</strong> so far:</p>

        <ul style="line-height: 1.8;">
          ${savedCampsHtml}
        </ul>

        <p>With a ${brand.brandName} Premium subscription, you can save <strong>unlimited camps</strong> and plan your entire summer without limits.</p>

        <div style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 2px solid #93c5fd; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          <p style="font-size: 20px; font-weight: bold; color: #1e40af; margin: 0 0 8px 0;">
            Upgrade for $29/year
          </p>
          <p style="color: #3b82f6; margin: 0;">
            Unlimited saved camps &middot; Full summer planner &middot; Priority support
          </p>
        </div>

        <p style="text-align: center; margin: 24px 0;">
          <a href="https://${brand.domain}/settings" style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Upgrade Now</a>
        </p>

        ${emailFooter(brand.brandName, brand.domain, true)}
      </div>
    `;

    const text = `Hi ${family.displayName},\n\nYou've been busy planning! You've saved 5 camps so far:\n\n${savedCampsText}\n\nWith a ${brand.brandName} Premium subscription, you can save unlimited camps and plan your entire summer without limits.\n\nUpgrade for $29/year: https://${brand.domain}/settings${textFooter(brand.brandName, brand.domain, true)}`;

    const emailId = await resend.sendEmail(ctx, {
      from: `${brand.brandName} <${brand.fromEmail}>`,
      to: [family.email],
      subject: `You've saved 5 camps — unlock unlimited with ${brand.brandName} Premium`,
      html,
      text,
    });

    await ctx.runMutation(internal.emailAutomation.mutations.recordAutomatedEmail, {
      familyId: args.familyId,
      emailType: 'paywall_nudge',
      emailId: emailId as string,
      dedupeKey: weekKey,
    });

    return { sent: true };
  },
});

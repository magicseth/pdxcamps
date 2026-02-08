'use node';

/**
 * Per-Family Email Send Actions
 *
 * Individual email sending actions called by workflows.
 * Each action handles one family's email for one automation type.
 * Separated from the batch processing logic for workflow durability.
 */

import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { resend } from '../email';

// ---- Helpers ----

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
// RE-ENGAGEMENT (per family)
// ============================================

export const sendReEngagementForFamily = internalAction({
  args: {
    familyId: v.id('families'),
    email: v.string(),
    displayName: v.string(),
    primaryCityId: v.id('cities'),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; skipped?: boolean; reason?: string; emailId?: string }> => {
    const brand = await ctx.runQuery(internal.emailAutomation.queries.getCityBrand, {
      cityId: args.primaryCityId,
    });
    if (!brand) return { sent: false, skipped: true, reason: 'no_brand' };

    const newSessions = await ctx.runQuery(
      internal.emailAutomation.queries.getRecentSessionsForCity,
      { cityId: args.primaryCityId, limit: 3 },
    );

    if (newSessions.length === 0) return { sent: false, skipped: true, reason: 'no_new_sessions' };

    const sessionCardsHtml = newSessions
      .map(
        (s: any) => `
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
        (s: any) =>
          `- ${s.campName} (${s.organizationName})\n  ${formatDate(s.startDate)} - ${formatDate(s.endDate)} | ${formatPrice(s.price)}`,
      )
      .join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${args.displayName},</p>
        <p>We've added <strong>${newSessions.length} new camp${newSessions.length > 1 ? 's' : ''}</strong> near you since your last visit. Here's a preview:</p>
        ${sessionCardsHtml}
        <p style="text-align: center; margin: 24px 0;">
          <a href="https://${brand.domain}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">See What's New</a>
        </p>
        ${emailFooter(brand.brandName, brand.domain, true)}
      </div>
    `;

    const text = `Hi ${args.displayName},\n\nWe've added ${newSessions.length} new camp${newSessions.length > 1 ? 's' : ''} near you since your last visit:\n\n${sessionCardsText}\n\nSee what's new: https://${brand.domain}${textFooter(brand.brandName, brand.domain, true)}`;

    const emailId = await resend.sendEmail(ctx, {
      from: `${brand.brandName} <${brand.fromEmail}>`,
      to: [args.email],
      subject: `${newSessions.length} new camp${newSessions.length > 1 ? 's' : ''} added near you`,
      html,
      text,
    });

    return { sent: true, emailId: emailId as string };
  },
});

// ============================================
// WEEKLY DIGEST (per family)
// ============================================

export const sendWeeklyDigestForFamily = internalAction({
  args: {
    familyId: v.id('families'),
    email: v.string(),
    displayName: v.string(),
    primaryCityId: v.id('cities'),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; skipped?: boolean; reason?: string; emailId?: string }> => {
    const brand = await ctx.runQuery(internal.emailAutomation.queries.getCityBrand, {
      cityId: args.primaryCityId,
    });
    if (!brand) return { sent: false, skipped: true, reason: 'no_brand' };

    const data: any = await ctx.runQuery(
      internal.emailAutomation.queries.getWeeklyDigestData,
      { familyId: args.familyId, cityId: args.primaryCityId },
    );

    if (data.newSessionsThisWeek === 0 && data.fillingUp === 0 && data.savedCampUpdates.length === 0) {
      return { sent: false, skipped: true, reason: 'nothing_to_report' };
    }

    // Build saved camps section
    let savedCampsHtml = '';
    let savedCampsText = '';
    if (data.savedCampUpdates.length > 0) {
      savedCampsHtml = `<h2 style="color: #1a1a1a; font-size: 18px; margin-top: 24px;">Your Saved Camps</h2>`;
      for (const camp of data.savedCampUpdates) {
        const statusLabel = camp.status === 'active' ? '&#x2705; Open' : camp.status === 'sold_out' ? '&#x274C; Sold Out' : camp.status;
        const spotsLabel = camp.spotsRemaining !== null ? ` &middot; ${camp.spotsRemaining} spots left` : '';
        savedCampsHtml += `<p style="margin: 4px 0; font-size: 14px;">${statusLabel} <strong>${camp.campName}</strong>${spotsLabel}</p>`;
        savedCampsText += `- ${camp.campName}: ${camp.status}${camp.spotsRemaining !== null ? ` (${camp.spotsRemaining} spots left)` : ''}\n`;
      }
    }

    // Build new camps section
    let newCampsHtml = '';
    let newCampsText = '';
    if (data.newCampDetails.length > 0) {
      newCampsHtml = `<h2 style="color: #1a1a1a; font-size: 18px; margin-top: 24px;">New This Week</h2>`;
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
        <p style="color: #666; margin-top: 0;">Hi ${args.displayName}, here's this week's update for ${brand.cityName}.</p>
        ${statsHtml}
        ${savedCampsHtml}
        ${newCampsHtml}
        <p style="text-align: center; margin: 24px 0;">
          <a href="https://${brand.domain}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Your Planner</a>
        </p>
        ${emailFooter(brand.brandName, brand.domain, true)}
      </div>
    `;

    const text = `Your Summer Planning Update\n\nHi ${args.displayName}, here's this week's update for ${brand.cityName}.\n\n${data.totalActiveSessions} active sessions${data.newSessionsThisWeek > 0 ? ` | ${data.newSessionsThisWeek} new this week` : ''}${data.fillingUp > 0 ? ` | ${data.fillingUp} filling up` : ''}\n\n${savedCampsText}${newCampsText}\nView your planner: https://${brand.domain}${textFooter(brand.brandName, brand.domain, true)}`;

    const emailId = await resend.sendEmail(ctx, {
      from: `${brand.brandName} <${brand.fromEmail}>`,
      to: [args.email],
      subject: `Your Summer Planning Update — ${brand.cityName}`,
      html,
      text,
    });

    return { sent: true, emailId: emailId as string };
  },
});

// ============================================
// SUMMER COUNTDOWN (per family)
// ============================================

export const sendSummerCountdownForFamily = internalAction({
  args: {
    familyId: v.id('families'),
    email: v.string(),
    displayName: v.string(),
    primaryCityId: v.id('cities'),
    weeksUntilSummer: v.number(),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; emailId?: string }> => {
    const brand = await ctx.runQuery(internal.emailAutomation.queries.getCityBrand, {
      cityId: args.primaryCityId,
    });
    if (!brand) return { sent: false };

    const stats: any = await ctx.runQuery(internal.emailAutomation.queries.getSummerCountdownStats, {
      cityId: args.primaryCityId,
    });

    const weeks = args.weeksUntilSummer;

    let headline: string;
    let urgencyNote: string;
    if (weeks <= 2) {
      headline = `Summer starts in ${weeks} week${weeks > 1 ? 's' : ''}!`;
      urgencyNote = 'This is it — the final stretch before summer camps begin. Many popular sessions are already full.';
    } else if (weeks <= 4) {
      headline = `Just ${weeks} weeks until summer`;
      urgencyNote = 'The most popular camps are filling up fast. Now is the time to lock in your spots.';
    } else if (weeks <= 8) {
      headline = `${weeks} weeks until summer — time to plan`;
      urgencyNote = 'Early birds get the best picks. Start browsing now while you have the most options.';
    } else {
      headline = `Summer is ${weeks} weeks away`;
      urgencyNote = "It's never too early to start planning! Browse what's available and save your favorites.";
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
          <h1 style="color: #92400e; margin: 0 0 8px 0; font-size: 24px;">${headline}</h1>
          <p style="color: #a16207; margin: 0;">${urgencyNote}</p>
        </div>
        <p>Hi ${args.displayName},</p>
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

    const text = `${headline}\n\n${urgencyNote}\n\nHi ${args.displayName},\n\n${stats.totalSessions} camp sessions available in ${brand.cityName}\n${stats.organizationCount} organizations offering camps\n${stats.registrationOpenPct}% have registration open${stats.filledSessions > 0 ? `\n${stats.filledSessions} already sold out` : ''}\n\nPlan your summer: https://${brand.domain}${textFooter(brand.brandName, brand.domain, true)}`;

    const emailId = await resend.sendEmail(ctx, {
      from: `${brand.brandName} <${brand.fromEmail}>`,
      to: [args.email],
      subject: `${headline} — ${brand.cityName} Camp Update`,
      html,
      text,
    });

    return { sent: true, emailId: emailId as string };
  },
});

// ============================================
// NEAR-PAYWALL NUDGE (per family)
// ============================================

export const sendNearPaywallNudge = internalAction({
  args: {
    familyId: v.id('families'),
    email: v.string(),
    displayName: v.string(),
    savedCampNames: v.array(v.string()),
    primaryCityId: v.id('cities'),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; emailId?: string }> => {
    const brand = await ctx.runQuery(internal.emailAutomation.queries.getCityBrand, {
      cityId: args.primaryCityId,
    });
    if (!brand) return { sent: false };

    const campListHtml = args.savedCampNames
      .map((name) => `<li style="margin: 4px 0;">${name}</li>`)
      .join('');

    const campListText = args.savedCampNames.map((name) => `- ${name}`).join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${args.displayName},</p>
        <p>You've saved <strong>${args.savedCampNames.length} camps</strong> so far — nice work planning your summer!</p>
        <ul style="padding-left: 20px; margin: 12px 0;">
          ${campListHtml}
        </ul>
        <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">You have 1 free save remaining</p>
          <p style="margin: 0; color: #a16207; font-size: 14px;">
            Free accounts can save up to 5 camps. Upgrade to Premium for <strong>unlimited saves</strong>,
            calendar sync, sharing, and more.
          </p>
        </div>
        <p style="text-align: center; margin: 24px 0;">
          <a href="https://${brand.domain}/upgrade" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Upgrade to Premium</a>
        </p>
        <p style="color: #666; font-size: 13px;">Or keep browsing with your remaining free save at <a href="https://${brand.domain}" style="color: #E5A33B;">${brand.domain}</a>.</p>
        ${emailFooter(brand.brandName, brand.domain, true)}
      </div>
    `;

    const text = `Hi ${args.displayName},\n\nYou've saved ${args.savedCampNames.length} camps so far — nice work planning your summer!\n\n${campListText}\n\nYou have 1 free save remaining. Free accounts can save up to 5 camps. Upgrade to Premium for unlimited saves, calendar sync, sharing, and more.\n\nUpgrade: https://${brand.domain}/upgrade\n\nOr keep browsing at https://${brand.domain}${textFooter(brand.brandName, brand.domain, true)}`;

    const emailId = await resend.sendEmail(ctx, {
      from: `${brand.brandName} <${brand.fromEmail}>`,
      to: [args.email],
      subject: `You have 1 free camp save left — upgrade for unlimited`,
      html,
      text,
    });

    return { sent: true, emailId: emailId as string };
  },
});

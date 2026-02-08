'use node';

/**
 * Lead Nurture Email Send Actions
 *
 * Sends nurture drip emails to captured leads.
 * Called by the leadNurtureWorkflow via step.runAction.
 */

import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { resend } from '../email';

function formatPrice(cents: number): string {
  return cents > 0 ? `$${(cents / 100).toFixed(0)}` : 'Free';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function emailFooter(brandName: string, domain: string): string {
  return `
    <p style="color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
      — The ${brandName} Team<br/>
      <a href="https://${domain}" style="color: #E5A33B;">${domain}</a>
    </p>
  `;
}

function textFooter(brandName: string, domain: string): string {
  return `\n---\n— The ${brandName} Team\n${domain}`;
}

interface SessionInfo {
  campName: string;
  organizationName: string;
  startDate: string;
  endDate: string;
  price: number;
}

function sessionCardsHtml(sessions: SessionInfo[]): string {
  return sessions
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
}

function sessionCardsText(sessions: SessionInfo[]): string {
  return sessions
    .map(
      (s) =>
        `- ${s.campName} (${s.organizationName})\n  ${formatDate(s.startDate)} - ${formatDate(s.endDate)} | ${formatPrice(s.price)}`,
    )
    .join('\n');
}

export const sendLeadNurtureEmail = internalAction({
  args: {
    leadId: v.string(),
    email: v.string(),
    citySlug: v.string(),
    emailIndex: v.number(), // 0, 1, or 2
  },
  handler: async (ctx, args): Promise<{ sent: boolean; emailId?: string }> => {
    // Get city brand info by slug
    const brand = await ctx.runQuery(internal.leads.queries.getCityBrandBySlug, {
      citySlug: args.citySlug,
    });
    if (!brand) return { sent: false };

    // Get camp data for email content
    const sessions: SessionInfo[] = await ctx.runQuery(
      internal.leads.queries.getSessionsForNurture,
      { cityId: brand.cityId as any, emailIndex: args.emailIndex },
    );

    const totalSessions: number = await ctx.runQuery(
      internal.leads.queries.getActiveCitySessionCount,
      { cityId: brand.cityId as any },
    );

    const signupUrl = `https://${brand.domain}`;
    const discoverUrl = `https://${brand.domain}/discover/${args.citySlug}`;

    let subject: string;
    let html: string;
    let text: string;

    if (args.emailIndex === 0) {
      // Email 1: Welcome + popular camps
      subject = `Here's what ${brand.cityName} parents are booking this summer`;

      const campsSection =
        sessions.length > 0
          ? `<p>Here are some popular camps families are looking at:</p>${sessionCardsHtml(sessions)}`
          : `<p>We have <strong>${totalSessions} camp sessions</strong> from local organizations ready for you to explore.</p>`;

      const campsText =
        sessions.length > 0
          ? `Here are some popular camps families are looking at:\n\n${sessionCardsText(sessions)}`
          : `We have ${totalSessions} camp sessions from local organizations ready for you to explore.`;

      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 22px;">Welcome to ${brand.brandName}!</h1>
          <p>Thanks for joining! We help ${brand.cityName} families find and plan summer camps for their kids.</p>
          ${campsSection}
          <p style="text-align: center; margin: 24px 0;">
            <a href="${discoverUrl}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Browse Camps</a>
          </p>
          ${emailFooter(brand.brandName, brand.domain)}
        </div>
      `;

      text = `Welcome to ${brand.brandName}!\n\nThanks for joining! We help ${brand.cityName} families find and plan summer camps for their kids.\n\n${campsText}\n\nBrowse camps: ${discoverUrl}${textFooter(brand.brandName, brand.domain)}`;
    } else if (args.emailIndex === 1) {
      // Email 2: Recent additions
      subject = `New camps just added in ${brand.cityName}`;

      const campsSection =
        sessions.length > 0
          ? `<p>Here are some recently added camps:</p>${sessionCardsHtml(sessions)}`
          : `<p>We're adding new camps every day. Come see what's new!</p>`;

      const campsText =
        sessions.length > 0
          ? `Here are some recently added camps:\n\n${sessionCardsText(sessions)}`
          : `We're adding new camps every day. Come see what's new!`;

      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 22px;">New camps in ${brand.cityName}</h1>
          <p>We've been busy adding more camp options for ${brand.cityName} families. There are now <strong>${totalSessions} sessions</strong> to choose from!</p>
          ${campsSection}
          <p style="text-align: center; margin: 24px 0;">
            <a href="${discoverUrl}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">See All Camps</a>
          </p>
          ${emailFooter(brand.brandName, brand.domain)}
        </div>
      `;

      text = `New camps in ${brand.cityName}\n\nWe've been busy adding more camp options for ${brand.cityName} families. There are now ${totalSessions} sessions to choose from!\n\n${campsText}\n\nSee all camps: ${discoverUrl}${textFooter(brand.brandName, brand.domain)}`;
    } else {
      // Email 3: Urgency + signup CTA
      subject = `Don't miss out — ${brand.cityName} camps are filling up`;

      const campsSection =
        sessions.length > 0
          ? `<p>These popular camps still have spots:</p>${sessionCardsHtml(sessions)}`
          : '';

      const campsText =
        sessions.length > 0
          ? `These popular camps still have spots:\n\n${sessionCardsText(sessions)}\n\n`
          : '';

      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
            <h1 style="color: #92400e; margin: 0 0 8px 0; font-size: 24px;">Camps are filling up!</h1>
            <p style="color: #a16207; margin: 0;">Popular ${brand.cityName} summer camps won't last long.</p>
          </div>
          <p>Summer will be here before you know it, and the most popular camps fill up fast.</p>
          <p>Create a free account to:</p>
          <ul style="line-height: 1.8;">
            <li><strong>Save favorites</strong> — Keep track of camps you like</li>
            <li><strong>Plan your summer</strong> — See your whole summer at a glance</li>
            <li><strong>Get notified</strong> — Know when spots open up</li>
          </ul>
          ${campsSection}
          <p style="text-align: center; margin: 24px 0;">
            <a href="${signupUrl}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Create Free Account</a>
          </p>
          ${emailFooter(brand.brandName, brand.domain)}
        </div>
      `;

      text = `Camps are filling up!\n\nPopular ${brand.cityName} summer camps won't last long.\n\nSummer will be here before you know it, and the most popular camps fill up fast.\n\nCreate a free account to:\n- Save favorites — Keep track of camps you like\n- Plan your summer — See your whole summer at a glance\n- Get notified — Know when spots open up\n\n${campsText}Create free account: ${signupUrl}${textFooter(brand.brandName, brand.domain)}`;
    }

    const emailId = await resend.sendEmail(ctx, {
      from: `${brand.brandName} <${brand.fromEmail}>`,
      to: [args.email],
      subject,
      html,
      text,
    });

    return { sent: true, emailId: emailId as string };
  },
});

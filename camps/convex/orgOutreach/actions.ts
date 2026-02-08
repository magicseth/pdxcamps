'use node';

/**
 * Org Outreach Actions
 *
 * Actions for sending outreach emails to organizations.
 * Manual-trigger only — no crons or auto-sending.
 */

import { action } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { resend } from '../email';

// ============================================
// EMAIL TEMPLATES
// ============================================

function emailFooter(brandName: string, domain: string): string {
  return `
    <p style="color: #666; font-size: 14px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
      Best,<br/>
      Seth<br/>
      <span style="color: #666;">Creator of ${brandName}</span><br/>
      <a href="https://${domain}" style="color: #E5A33B;">${domain}</a>
    </p>
  `;
}

function buildIntroEmail(params: {
  orgName: string;
  brandName: string;
  domain: string;
  sessionCount: number;
  familyCount: number;
  orgSlug: string;
}): { subject: string; html: string; text: string } {
  const { orgName, brandName, domain, sessionCount, familyCount, orgSlug } = params;

  const statsLine =
    sessionCount > 0
      ? `We're already featuring <strong>${sessionCount} camp session${sessionCount > 1 ? 's' : ''}</strong> from ${orgName}`
      : `We'd love to feature <strong>${orgName}</strong>`;

  const familyLine =
    familyCount > 0 ? `${familyCount} families are using ${brandName} to discover camps` : '';

  const subject = `Featuring ${orgName} on ${brandName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Hello,</p>

      <p>I'm reaching out from <strong>${brandName}</strong>, a free platform helping local families discover and plan summer camps for their kids.</p>

      <p>${statsLine} on our platform.${familyLine ? ` <strong>${familyLine}</strong> right now.` : ''}</p>

      <p><strong>What we offer camp providers:</strong></p>
      <ul>
        <li>Free exposure to families actively planning summer camps</li>
        <li>Direct links to your registration page — no middleman</li>
        <li>Your own organization page: <a href="https://${domain}/org/${orgSlug}" style="color: #E5A33B;">https://${domain}/org/${orgSlug}</a></li>
        <li>No fees or commissions — we're a free service for families</li>
      </ul>

      <p>Would you like to claim your listing? Just reply to this email and we'll get you set up with the ability to update your information directly.</p>

      ${emailFooter(brandName, domain)}
    </div>
  `;

  const text = `Hello,

I'm reaching out from ${brandName}, a free platform helping local families discover and plan summer camps for their kids.

${sessionCount > 0 ? `We're already featuring ${sessionCount} camp session${sessionCount > 1 ? 's' : ''} from ${orgName}` : `We'd love to feature ${orgName}`} on our platform.${familyCount > 0 ? ` ${familyCount} families are using ${brandName} to discover camps right now.` : ''}

What we offer camp providers:
- Free exposure to families actively planning summer camps
- Direct links to your registration page — no middleman
- Your own organization page: https://${domain}/org/${orgSlug}
- No fees or commissions — we're a free service for families

Would you like to claim your listing? Just reply to this email and we'll get you set up with the ability to update your information directly.

Best,
Seth
Creator of ${brandName}
https://${domain}`;

  return { subject, html, text };
}

function buildValuePropEmail(params: {
  orgName: string;
  brandName: string;
  domain: string;
  sessionCount: number;
  familyCount: number;
  orgSlug: string;
}): { subject: string; html: string; text: string } {
  const { orgName, brandName, domain, familyCount, orgSlug } = params;

  const subject = `How ${orgName} appears to parents on ${brandName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Hi there,</p>

      <p>I wanted to follow up on my previous email about ${orgName} on ${brandName}.</p>

      <p>Here's how families see your camps when they visit <a href="https://${domain}/org/${orgSlug}" style="color: #E5A33B;">your page on ${brandName}</a>:</p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 16px 0;">
        <p style="font-weight: 600; margin: 0 0 8px 0; font-size: 18px;">${orgName}</p>
        <p style="margin: 0; color: #666;">Families can browse sessions, compare with other camps, and click through directly to your registration.</p>
      </div>

      ${familyCount > 0 ? `<p>We currently help <strong>${familyCount} families</strong> plan their summers. Adding more details to your listing (images, descriptions) helps parents choose your camps.</p>` : ''}

      <p><strong>Want to update your listing?</strong> Just reply to this email with any corrections or additions:</p>
      <ul>
        <li>Updated descriptions or images</li>
        <li>Missing sessions or schedule changes</li>
        <li>Preferred contact information</li>
      </ul>

      ${emailFooter(brandName, domain)}
    </div>
  `;

  const text = `Hi there,

I wanted to follow up on my previous email about ${orgName} on ${brandName}.

Here's how families see your camps when they visit your page on ${brandName}: https://${domain}/org/${orgSlug}

Families can browse sessions, compare with other camps, and click through directly to your registration.

${familyCount > 0 ? `We currently help ${familyCount} families plan their summers. Adding more details to your listing (images, descriptions) helps parents choose your camps.` : ''}

Want to update your listing? Just reply to this email with any corrections or additions:
- Updated descriptions or images
- Missing sessions or schedule changes
- Preferred contact information

Best,
Seth
Creator of ${brandName}
https://${domain}`;

  return { subject, html, text };
}

function buildSocialProofEmail(params: {
  orgName: string;
  brandName: string;
  domain: string;
  orgSlug: string;
}): { subject: string; html: string; text: string } {
  const { orgName, brandName, domain, orgSlug } = params;

  const subject = `Last chance to claim ${orgName}'s listing on ${brandName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Hello,</p>

      <p>I wanted to reach out one more time about ${orgName}'s presence on ${brandName}.</p>

      <p>Several camp organizations have already claimed their listings and are updating their information directly. Claimed listings get:</p>

      <ul>
        <li><strong>Priority placement</strong> in search results</li>
        <li><strong>Verified badge</strong> showing parents the info is up-to-date</li>
        <li><strong>Direct control</strong> over descriptions, images, and session details</li>
      </ul>

      <p>Your listing is live at <a href="https://${domain}/org/${orgSlug}" style="color: #E5A33B;">https://${domain}/org/${orgSlug}</a> — families are already finding it.</p>

      <p>If you'd like to take ownership of it, just reply to this email. It takes less than 5 minutes to set up.</p>

      <p>If you'd prefer we remove your listing, just let me know and we'll take it down.</p>

      ${emailFooter(brandName, domain)}
    </div>
  `;

  const text = `Hello,

I wanted to reach out one more time about ${orgName}'s presence on ${brandName}.

Several camp organizations have already claimed their listings and are updating their information directly. Claimed listings get:

- Priority placement in search results
- Verified badge showing parents the info is up-to-date
- Direct control over descriptions, images, and session details

Your listing is live at https://${domain}/org/${orgSlug} — families are already finding it.

If you'd like to take ownership of it, just reply to this email. It takes less than 5 minutes to set up.

If you'd prefer we remove your listing, just let me know and we'll take it down.

Best,
Seth
Creator of ${brandName}
https://${domain}`;

  return { subject, html, text };
}

// ============================================
// SEND ACTIONS
// ============================================

// Helper to send a single outreach email given data from getOrgForOutreach
async function sendOutreachEmail(
  ctx: { runMutation: any },
  resendCtx: any,
  data: {
    outreach: { sequenceStep: number; emailAddress: string; status: string };
    org: { name: string; slug: string };
    brandName: string;
    domain: string;
    fromEmail: string;
    sessionCount: number;
    familyCount: number;
  },
  outreachId: any,
): Promise<{ success: boolean; emailId: string }> {
  const emailParams = {
    orgName: data.org.name,
    brandName: data.brandName,
    domain: data.domain,
    sessionCount: data.sessionCount,
    familyCount: data.familyCount,
    orgSlug: data.org.slug,
  };

  // Pick template based on sequence step
  let email;
  switch (data.outreach.sequenceStep) {
    case 1:
      email = buildIntroEmail(emailParams);
      break;
    case 2:
      email = buildValuePropEmail(emailParams);
      break;
    case 3:
      email = buildSocialProofEmail(emailParams);
      break;
    default:
      throw new Error(`Invalid sequence step: ${data.outreach.sequenceStep}`);
  }

  // Send via Resend
  const emailId = await resend.sendEmail(resendCtx, {
    from: `${data.brandName} <${data.fromEmail}>`,
    to: [data.outreach.emailAddress],
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  // Update outreach record
  await ctx.runMutation(internal.orgOutreach.mutations.updateOutreachStatus, {
    outreachId,
    status: 'sent',
    emailId: emailId as string,
  });

  return { success: true, emailId: emailId as string };
}

/**
 * Send a single outreach email.
 * Reads the outreach record, picks the right template based on sequenceStep,
 * sends via Resend, and updates the record.
 */
export const sendOrgOutreach = action({
  args: {
    outreachId: v.id('orgOutreach'),
  },
  handler: async (ctx, args): Promise<{ success: boolean; emailId: string }> => {
    const data = await ctx.runQuery(internal.orgOutreach.queries.getOrgForOutreach, {
      outreachId: args.outreachId,
    });

    if (!data) throw new Error('Outreach record not found');
    if (data.outreach.status !== 'pending') {
      throw new Error(`Outreach is not pending (status: ${data.outreach.status})`);
    }

    return sendOutreachEmail(ctx, ctx, data, args.outreachId);
  },
});

/**
 * Send outreach emails for all pending records (batch).
 * Used for the "Send All Pending" button in admin UI.
 */
export const sendAllPendingOutreach = action({
  args: {},
  handler: async (ctx): Promise<{ sent: number; errors: string[]; total: number }> => {
    const queue = await ctx.runQuery(internal.orgOutreach.queries.getPendingOutreach, {});

    let sent = 0;
    const errors: string[] = [];

    for (const record of queue) {
      try {
        const data = await ctx.runQuery(internal.orgOutreach.queries.getOrgForOutreach, {
          outreachId: record._id,
        });

        if (!data || data.outreach.status !== 'pending') continue;

        await sendOutreachEmail(ctx, ctx, data, record._id);
        sent++;
      } catch (err) {
        errors.push(`${record.emailAddress}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return { sent, errors, total: queue.length };
  },
});

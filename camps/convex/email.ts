/**
 * Email Service
 *
 * Uses @convex-dev/resend component for sending emails.
 * Used for:
 * - Contact outreach to camp organizations
 * - User notifications
 * - Registration reminders
 */

import { action, internalAction, internalMutation } from "./_generated/server";
import { components } from "./_generated/api";
import { Resend, vOnEmailEventArgs } from "@convex-dev/resend";
import { v } from "convex/values";

// Initialize Resend client
// Note: To enable email event handling, add onEmailEvent option after
// creating the handler in a separate file to avoid circular reference
export const resend: Resend = new Resend(components.resend, {});

/**
 * Handle email status events from Resend webhook
 * Called by the resend component when webhook events are received
 */
export const handleEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  handler: async (ctx, args) => {
    // Log email events for debugging
    console.log(`Email event: ${args.event} for email ${args.id}`);

    // Could add custom handling here:
    // - Track delivery success/failure in database
    // - Alert on bounces or spam complaints
    // - Update outreach status
  },
});

/**
 * Store an inbound email received via webhook
 */
export const storeInboundEmail = internalMutation({
  args: {
    resendId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    textBody: v.optional(v.string()),
    htmlBody: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Parse the from field to extract email and name
    // Format is typically "Name <email@example.com>" or just "email@example.com"
    const fromMatch = args.from.match(/^(?:(.+?)\s*<)?([^<>]+)>?$/);
    const fromEmail = fromMatch?.[2]?.trim() || args.from;
    const fromName = fromMatch?.[1]?.trim();

    // Try to match to an organization by email
    const orgs = await ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("email"), fromEmail))
      .collect();
    const matchedOrganizationId = orgs[0]?._id;

    const emailId = await ctx.db.insert("inboundEmails", {
      resendId: args.resendId,
      from: args.from,
      to: args.to,
      subject: args.subject,
      textBody: args.textBody,
      htmlBody: args.htmlBody,
      fromEmail,
      fromName,
      status: "received",
      matchedOrganizationId,
      receivedAt: Date.now(),
    });

    console.log(`Inbound email stored: ${emailId} from ${fromEmail}`);
    return emailId;
  },
});

// Default sender - should match verified domain in Resend
const FROM_EMAIL = "hello@pdxcamps.com";
const FROM_NAME = "PDX Camps";

/**
 * Send a contact outreach email to a camp organization
 */
export const sendContactOutreach = action({
  args: {
    to: v.string(),
    organizationName: v.string(),
    contactName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const greeting = args.contactName ? `Hi ${args.contactName}` : "Hello";

    const result = await resend.sendEmail(ctx, {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [args.to],
      subject: `Featuring ${args.organizationName} on PDX Camps`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>${greeting},</p>

          <p>I'm reaching out from <strong>PDX Camps</strong>, a free platform helping Portland families discover and plan summer camps for their kids.</p>

          <p>We've noticed <strong>${args.organizationName}</strong> and would love to feature your camps on our platform. This gives families an easy way to find your programs when planning their summer.</p>

          <p><strong>What we're asking:</strong></p>
          <ul>
            <li>Permission to list your camp sessions on PDX Camps</li>
            <li>We'll link directly to your registration page</li>
            <li>Families can save and compare your camps alongside others</li>
          </ul>

          <p><strong>What you get:</strong></p>
          <ul>
            <li>Free exposure to families actively planning summer camps</li>
            <li>No fees or commissions - we're a free service</li>
            <li>Direct links to your registration</li>
          </ul>

          <p>Would you be open to being featured? Just reply to this email and we'll get you set up.</p>

          <p>Best,<br/>
          The PDX Camps Team<br/>
          <a href="https://pdxcamps.com">pdxcamps.com</a></p>
        </div>
      `,
      text: `
${greeting},

I'm reaching out from PDX Camps, a free platform helping Portland families discover and plan summer camps for their kids.

We've noticed ${args.organizationName} and would love to feature your camps on our platform. This gives families an easy way to find your programs when planning their summer.

What we're asking:
- Permission to list your camp sessions on PDX Camps
- We'll link directly to your registration page
- Families can save and compare your camps alongside others

What you get:
- Free exposure to families actively planning summer camps
- No fees or commissions - we're a free service
- Direct links to your registration

Would you be open to being featured? Just reply to this email and we'll get you set up.

Best,
The PDX Camps Team
https://pdxcamps.com
      `,
    });

    return result;
  },
});

/**
 * Send a generic email (internal use)
 */
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
    replyTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await resend.sendEmail(ctx, {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo ? [args.replyTo] : undefined,
    });

    return result;
  },
});

/**
 * Send a registration reminder email
 */
export const sendRegistrationReminder = action({
  args: {
    to: v.string(),
    parentName: v.string(),
    childName: v.string(),
    campName: v.string(),
    organizationName: v.string(),
    registrationUrl: v.optional(v.string()),
    weekLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const registerLink = args.registrationUrl
      ? `<p><a href="${args.registrationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Register Now</a></p>`
      : "";

    const result = await resend.sendEmail(ctx, {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [args.to],
      subject: `Reminder: Register ${args.childName} for ${args.campName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Hi ${args.parentName},</p>

          <p>This is a friendly reminder that you saved <strong>${args.campName}</strong> by ${args.organizationName} for ${args.childName}.</p>

          <p><strong>Week:</strong> ${args.weekLabel}</p>

          <p>Camp registrations can fill up fast! Make sure to register soon if you haven't already.</p>

          ${registerLink}

          <p>Happy planning!</p>

          <p style="color: #666; font-size: 14px; margin-top: 24px;">
            — The PDX Camps Team<br/>
            <a href="https://pdxcamps.com" style="color: #E5A33B;">pdxcamps.com</a>
          </p>
        </div>
      `,
    });

    return result;
  },
});

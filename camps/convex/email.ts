/**
 * Email Service
 *
 * Uses @convex-dev/resend component for sending emails.
 * Used for:
 * - Contact outreach to camp organizations
 * - User notifications
 * - Registration reminders
 */

import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { Resend, vOnEmailEventArgs } from "@convex-dev/resend";
import { v } from "convex/values";

// Initialize Resend client
// testMode: false allows sending to real email addresses (not just @resend.dev)
export const resend: Resend = new Resend(components.resend, {
  testMode: false,
});

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
 * Forwarding is handled in the HTTP handler using Resend SDK
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
    const matchedOrg = await ctx.db
      .query("organizations")
      .withIndex("by_email", (q) => q.eq("email", fromEmail))
      .first();
    const matchedOrganizationId = matchedOrg?._id;

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
 * Test the organization outreach email by sending to current user
 */
export const testOutreachEmail = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; email: string }> => {
    // Get the current user's email
    const family = await ctx.runQuery(internal.email.getCurrentFamilyForEmail);
    if (!family) {
      throw new Error("No family found for current user");
    }

    // Send test outreach email to the user
    await resend.sendEmail(ctx, {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [family.email],
      subject: `Featuring Test Organization on PDX Camps`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <p style="background: #fef3c7; padding: 12px; border-radius: 6px; font-size: 14px;">
            <strong>TEST EMAIL</strong> — This is what organizations receive when we reach out.
          </p>

          <p>Hello,</p>

          <p>I'm reaching out from <strong>PDX Camps</strong>, a free platform helping Portland families discover and plan summer camps for their kids.</p>

          <p>We've noticed <strong>Test Organization</strong> and would love to feature your camps on our platform. This gives families an easy way to find your programs when planning their summer.</p>

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
          Seth<br/>
          <span style="color: #666;">Portland dad and creator of PDX Camps</span><br/>
          <a href="https://pdxcamps.com">pdxcamps.com</a></p>
        </div>
      `,
    });

    return { success: true, email: family.email };
  },
});

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
          Seth<br/>
          <span style="color: #666;">Portland dad and creator of PDX Camps</span><br/>
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
Seth
Portland dad and creator of PDX Camps
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
 * Send welcome email to new users after onboarding
 */
export const sendWelcomeEmail = internalAction({
  args: {
    to: v.string(),
    displayName: v.string(),
    cityName: v.string(),
    brandName: v.optional(v.string()),
    domain: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const brandName = args.brandName || FROM_NAME;
    const domain = args.domain || "pdxcamps.com";
    const fromEmail = args.fromEmail || FROM_EMAIL;

    const result = await resend.sendEmail(ctx, {
      from: `${brandName} <${fromEmail}>`,
      to: [args.to],
      subject: `Welcome to ${brandName}, ${args.displayName}!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 24px 0;">
            <h1 style="color: #1a1a1a; margin: 0;">Welcome to ${brandName}!</h1>
          </div>

          <p>Hi ${args.displayName},</p>

          <p>Thanks for joining ${brandName}! We're excited to help you plan an amazing summer for your family in ${args.cityName}.</p>

          <p>Your account is all set up and ready to go. Here's what you can do right now:</p>

          <ul style="line-height: 1.8;">
            <li><strong>Browse camps</strong> — Discover summer camps from dozens of local organizations</li>
            <li><strong>Save favorites</strong> — Keep track of camps you're interested in</li>
            <li><strong>Plan your summer</strong> — See your whole summer at a glance with our week-by-week planner</li>
          </ul>

          <p style="text-align: center; margin: 32px 0;">
            <a href="https://${domain}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Start Exploring Camps</a>
          </p>

          <p>Happy planning!</p>

          <p style="color: #666; font-size: 14px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
            — The ${brandName} Team<br/>
            <a href="https://${domain}" style="color: #E5A33B;">${domain}</a>
          </p>
        </div>
      `,
      text: `
Hi ${args.displayName},

Thanks for joining ${brandName}! We're excited to help you plan an amazing summer for your family in ${args.cityName}.

Your account is all set up and ready to go. Here's what you can do right now:

- Browse camps — Discover summer camps from dozens of local organizations
- Save favorites — Keep track of camps you're interested in
- Plan your summer — See your whole summer at a glance with our week-by-week planner

Start exploring at https://${domain}

Happy planning!

— The ${brandName} Team
https://${domain}
      `,
    });

    return result;
  },
});

/**
 * Send tips & tricks email (scheduled for day after signup)
 */
export const sendTipsEmail = internalAction({
  args: {
    to: v.string(),
    displayName: v.string(),
    cityName: v.string(),
    brandName: v.optional(v.string()),
    domain: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const brandName = args.brandName || FROM_NAME;
    const domain = args.domain || "pdxcamps.com";
    const fromEmail = args.fromEmail || FROM_EMAIL;

    const result = await resend.sendEmail(ctx, {
      from: `${brandName} <${fromEmail}>`,
      to: [args.to],
      subject: `Get the most out of ${brandName} — Tips for ${args.cityName} families`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Hi ${args.displayName},</p>

          <p>Now that you've had a day to explore, here are some tips to help you find the perfect camps for your family:</p>

          <h3 style="color: #1a1a1a; margin-top: 24px;">📅 Use the Summer Planner</h3>
          <p>Our week-by-week planner shows you exactly which weeks are covered and where you have gaps. Add family vacations and trips to see your complete summer schedule.</p>

          <h3 style="color: #1a1a1a; margin-top: 24px;">🔍 Filter by What Matters</h3>
          <p>Looking for something specific? Filter camps by:</p>
          <ul>
            <li><strong>Age range</strong> — Only see camps your kids qualify for</li>
            <li><strong>Location</strong> — Find camps close to home or work</li>
            <li><strong>Organization</strong> — Browse by your favorite providers</li>
            <li><strong>Price</strong> — Stay within your budget</li>
          </ul>

          <h3 style="color: #1a1a1a; margin-top: 24px;">⭐ Save Camps to Compare</h3>
          <p>Found a camp you like? Save it to your list! You can compare multiple options before deciding which to register for.</p>

          <h3 style="color: #1a1a1a; margin-top: 24px;">🔔 Register Early</h3>
          <p>Popular camps fill up fast — especially in ${args.cityName}! When you find something you love, click through to register right away.</p>

          <p style="text-align: center; margin: 32px 0;">
            <a href="https://${domain}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Continue Planning</a>
          </p>

          <p>Questions? Just reply to this email — we'd love to hear from you!</p>

          <p style="color: #666; font-size: 14px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
            — The ${brandName} Team<br/>
            <a href="https://${domain}" style="color: #E5A33B;">${domain}</a>
          </p>
        </div>
      `,
      text: `
Hi ${args.displayName},

Now that you've had a day to explore, here are some tips to help you find the perfect camps for your family:

📅 USE THE SUMMER PLANNER
Our week-by-week planner shows you exactly which weeks are covered and where you have gaps. Add family vacations and trips to see your complete summer schedule.

🔍 FILTER BY WHAT MATTERS
Looking for something specific? Filter camps by:
- Age range — Only see camps your kids qualify for
- Location — Find camps close to home or work
- Organization — Browse by your favorite providers
- Price — Stay within your budget

⭐ SAVE CAMPS TO COMPARE
Found a camp you like? Save it to your list! You can compare multiple options before deciding which to register for.

🔔 REGISTER EARLY
Popular camps fill up fast — especially in ${args.cityName}! When you find something you love, click through to register right away.

Continue planning at https://${domain}

Questions? Just reply to this email — we'd love to hear from you!

— The ${brandName} Team
https://${domain}
      `,
    });

    return result;
  },
});

/**
 * Trigger welcome email sequence for the current user (admin use)
 * Sends welcome email immediately and schedules tips email for 24 hours later
 */
export const triggerWelcomeSequence = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; email: string }> => {
    // Get the current user's family info
    const family = await ctx.runQuery(internal.email.getCurrentFamilyForEmail);
    if (!family) {
      throw new Error("No family found for current user");
    }

    const cityName = family.cityName || "your area";
    const brandName = family.brandName;
    const domain = family.domain;
    const fromEmail = family.fromEmail;

    // Send welcome email immediately
    await resend.sendEmail(ctx, {
      from: `${brandName} <${fromEmail}>`,
      to: [family.email],
      subject: `Welcome to ${brandName}, ${family.displayName}!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 24px 0;">
            <h1 style="color: #1a1a1a; margin: 0;">Welcome to ${brandName}!</h1>
          </div>

          <p>Hi ${family.displayName},</p>

          <p>Thanks for joining ${brandName}! We're excited to help you plan an amazing summer for your family in ${cityName}.</p>

          <p>Your account is all set up and ready to go. Here's what you can do right now:</p>

          <ul style="line-height: 1.8;">
            <li><strong>Browse camps</strong> — Discover summer camps from dozens of local organizations</li>
            <li><strong>Save favorites</strong> — Keep track of camps you're interested in</li>
            <li><strong>Plan your summer</strong> — See your whole summer at a glance with our week-by-week planner</li>
          </ul>

          <p style="text-align: center; margin: 32px 0;">
            <a href="https://${domain}" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Start Exploring Camps</a>
          </p>

          <p>Happy planning!</p>

          <p style="color: #666; font-size: 14px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
            — The ${brandName} Team<br/>
            <a href="https://${domain}" style="color: #E5A33B;">${domain}</a>
          </p>
        </div>
      `,
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

    return { success: true, email: family.email };
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

/**
 * List recent inbound emails for admin view
 */
export const listInboundEmails = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("inboundEmails")
      .order("desc")
      .take(args.limit || 20);

    return emails;
  },
});

/**
 * Internal query to get current user's family with city and brand info
 * Used by triggerWelcomeSequence to avoid circular references
 */
export const getCurrentFamilyForEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const family = await ctx.db
      .query("families")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", identity.subject))
      .first();

    if (!family) return null;

    // Get city with brand info
    const city = await ctx.db.get(family.primaryCityId);

    return {
      email: family.email,
      displayName: family.displayName,
      cityName: city?.name || null,
      // Brand info with defaults
      brandName: city?.brandName || "PDX Camps",
      domain: city?.domain || "pdxcamps.com",
      fromEmail: city?.fromEmail || "hello@pdxcamps.com",
    };
  },
});

/**
 * Get the most recent inbound email that's not from Seth
 * Used for reply routing when we can't find routing info in the email
 */
export const getMostRecentNonSethInbound = internalQuery({
  args: {},
  handler: async (ctx) => {
    const emails = await ctx.db
      .query("inboundEmails")
      .order("desc")
      .take(20);

    // Find the most recent one not from Seth and with a valid email
    const nonSethEmail = emails.find(
      (e) =>
        !e.fromEmail.includes("seth@magicseth.com") &&
        e.fromEmail !== "unknown" &&
        e.fromEmail.includes("@")
    );

    return nonSethEmail || null;
  },
});

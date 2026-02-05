"use node";

/**
 * Notification Actions
 *
 * Main entry point for the hourly notification digest.
 * Sends notifications to families when:
 * 1. A camp they saved opens for registration
 * 2. A camp they saved has low availability (< 5 spots)
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { resend } from "../email";
import { Id } from "../_generated/dataModel";

const LOW_AVAILABILITY_THRESHOLD = 5;
const FROM_NAME_DEFAULT = "PDX Camps";
const FROM_EMAIL_DEFAULT = "hello@pdxcamps.com";

// Helper to format time
function formatTime(time: { hour: number; minute: number }): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const minute = time.minute.toString().padStart(2, "0");
  return `${hour12}:${minute} ${ampm}`;
}

// Helper to format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Helper to format price
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

interface SessionNotification {
  sessionId: Id<"sessions">;
  changeType: "registration_opened" | "low_availability";
  changeId?: Id<"scrapeChanges">;
  session: {
    campName: string;
    organizationName: string;
    startDate: string;
    endDate: string;
    dropOffTime: { hour: number; minute: number };
    pickUpTime: { hour: number; minute: number };
    locationName: string;
    locationAddress: string;
    price: number;
    externalRegistrationUrl: string | null;
    spotsRemaining?: number;
  };
  childName: string;
}

interface FamilyDigest {
  familyId: Id<"families">;
  email: string;
  displayName: string;
  notifications: SessionNotification[];
  brandName: string;
  domain: string;
  fromEmail: string;
}

/**
 * Build HTML email content for a family digest.
 */
function buildDigestEmailHtml(digest: FamilyDigest): string {
  const { displayName, notifications, brandName, domain } = digest;

  const registrationOpened = notifications.filter(
    (n) => n.changeType === "registration_opened"
  );
  const lowAvailability = notifications.filter(
    (n) => n.changeType === "low_availability"
  );

  let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">Camp Updates for You</h1>
      <p style="color: #666; margin-top: 0;">Hi ${displayName}, here's what's happening with camps you're watching.</p>
  `;

  // Registration Opened Section
  if (registrationOpened.length > 0) {
    html += `
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h2 style="color: #16a34a; font-size: 18px; margin-top: 0;">🎉 Now Open for Registration</h2>
    `;

    for (const notif of registrationOpened) {
      const { session, childName } = notif;
      const dateRange =
        session.startDate === session.endDate
          ? formatDate(session.startDate)
          : `${formatDate(session.startDate)} - ${formatDate(session.endDate)}`;

      html += `
        <div style="background: white; border-radius: 6px; padding: 12px; margin: 12px 0; border: 1px solid #dcfce7;">
          <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">${session.campName}</h3>
          <p style="margin: 4px 0; color: #666; font-size: 14px;">${session.organizationName}</p>
          <p style="margin: 4px 0; color: #666; font-size: 14px;">📅 ${dateRange}</p>
          <p style="margin: 4px 0; color: #666; font-size: 14px;">⏰ ${formatTime(session.dropOffTime)} - ${formatTime(session.pickUpTime)}</p>
          ${session.locationAddress ? `<p style="margin: 4px 0; color: #666; font-size: 14px;">📍 ${session.locationName}</p>` : ""}
          <p style="margin: 4px 0; color: #666; font-size: 14px;">💰 ${formatPrice(session.price)}</p>
          <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">👦 Saved for <strong>${childName}</strong></p>
          ${
            session.externalRegistrationUrl
              ? `<p style="margin: 12px 0 0 0;"><a href="${session.externalRegistrationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Register Now</a></p>`
              : ""
          }
        </div>
      `;
    }

    html += `</div>`;
  }

  // Low Availability Section
  if (lowAvailability.length > 0) {
    html += `
      <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h2 style="color: #d97706; font-size: 18px; margin-top: 0;">⚡ Filling Up Fast</h2>
    `;

    for (const notif of lowAvailability) {
      const { session, childName } = notif;
      const dateRange =
        session.startDate === session.endDate
          ? formatDate(session.startDate)
          : `${formatDate(session.startDate)} - ${formatDate(session.endDate)}`;

      html += `
        <div style="background: white; border-radius: 6px; padding: 12px; margin: 12px 0; border: 1px solid #fde68a;">
          <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">${session.campName}</h3>
          <p style="margin: 4px 0; font-size: 14px;"><strong style="color: #dc2626;">Only ${session.spotsRemaining} spot${session.spotsRemaining === 1 ? "" : "s"} left!</strong></p>
          <p style="margin: 4px 0; color: #666; font-size: 14px;">${session.organizationName}</p>
          <p style="margin: 4px 0; color: #666; font-size: 14px;">📅 ${dateRange}</p>
          <p style="margin: 4px 0; color: #666; font-size: 14px;">⏰ ${formatTime(session.dropOffTime)} - ${formatTime(session.pickUpTime)}</p>
          <p style="margin: 4px 0; color: #666; font-size: 14px;">💰 ${formatPrice(session.price)}</p>
          <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">👦 Saved for <strong>${childName}</strong></p>
          ${
            session.externalRegistrationUrl
              ? `<p style="margin: 12px 0 0 0;"><a href="${session.externalRegistrationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #d97706; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Register Now</a></p>`
              : ""
          }
        </div>
      `;
    }

    html += `</div>`;
  }

  html += `
      <p style="color: #666; font-size: 14px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
        You're receiving this because you saved these camps on ${brandName}.<br/>
        <a href="https://${domain}" style="color: #E5A33B;">View your summer planner</a>
      </p>
    </div>
  `;

  return html;
}

/**
 * Build plain text email content for a family digest.
 */
function buildDigestEmailText(digest: FamilyDigest): string {
  const { displayName, notifications, brandName, domain } = digest;

  const registrationOpened = notifications.filter(
    (n) => n.changeType === "registration_opened"
  );
  const lowAvailability = notifications.filter(
    (n) => n.changeType === "low_availability"
  );

  let text = `Camp Updates for You\n\nHi ${displayName}, here's what's happening with camps you're watching.\n\n`;

  if (registrationOpened.length > 0) {
    text += `🎉 NOW OPEN FOR REGISTRATION\n`;
    text += `${"=".repeat(30)}\n\n`;

    for (const notif of registrationOpened) {
      const { session, childName } = notif;
      const dateRange =
        session.startDate === session.endDate
          ? formatDate(session.startDate)
          : `${formatDate(session.startDate)} - ${formatDate(session.endDate)}`;

      text += `${session.campName}\n`;
      text += `${session.organizationName}\n`;
      text += `📅 ${dateRange}\n`;
      text += `⏰ ${formatTime(session.dropOffTime)} - ${formatTime(session.pickUpTime)}\n`;
      if (session.locationAddress) {
        text += `📍 ${session.locationName}\n`;
      }
      text += `💰 ${formatPrice(session.price)}\n`;
      text += `👦 Saved for ${childName}\n`;
      if (session.externalRegistrationUrl) {
        text += `Register: ${session.externalRegistrationUrl}\n`;
      }
      text += `\n`;
    }
  }

  if (lowAvailability.length > 0) {
    text += `⚡ FILLING UP FAST\n`;
    text += `${"=".repeat(30)}\n\n`;

    for (const notif of lowAvailability) {
      const { session, childName } = notif;
      const dateRange =
        session.startDate === session.endDate
          ? formatDate(session.startDate)
          : `${formatDate(session.startDate)} - ${formatDate(session.endDate)}`;

      text += `${session.campName}\n`;
      text += `⚠️ Only ${session.spotsRemaining} spot${session.spotsRemaining === 1 ? "" : "s"} left!\n`;
      text += `${session.organizationName}\n`;
      text += `📅 ${dateRange}\n`;
      text += `⏰ ${formatTime(session.dropOffTime)} - ${formatTime(session.pickUpTime)}\n`;
      text += `💰 ${formatPrice(session.price)}\n`;
      text += `👦 Saved for ${childName}\n`;
      if (session.externalRegistrationUrl) {
        text += `Register: ${session.externalRegistrationUrl}\n`;
      }
      text += `\n`;
    }
  }

  text += `---\n`;
  text += `You're receiving this because you saved these camps on ${brandName}.\n`;
  text += `View your summer planner: https://${domain}\n`;

  return text;
}

/**
 * Build email subject based on notifications.
 */
function buildEmailSubject(digest: FamilyDigest): string {
  const registrationOpened = digest.notifications.filter(
    (n) => n.changeType === "registration_opened"
  );
  const lowAvailability = digest.notifications.filter(
    (n) => n.changeType === "low_availability"
  );

  // If only registration opened
  if (registrationOpened.length > 0 && lowAvailability.length === 0) {
    if (registrationOpened.length === 1) {
      return `${registrationOpened[0].session.campName} is now open for registration`;
    }
    return `${registrationOpened.length} camps you saved are now open for registration`;
  }

  // If only low availability
  if (lowAvailability.length > 0 && registrationOpened.length === 0) {
    if (lowAvailability.length === 1) {
      return `Only ${lowAvailability[0].session.spotsRemaining} spots left for ${lowAvailability[0].session.campName}`;
    }
    return `${lowAvailability.length} camps you saved are filling up fast`;
  }

  // If both
  return `Camp updates: ${digest.notifications.length} camps you're watching`;
}

/**
 * Process hourly notification digest.
 * This is the main cron entry point.
 */
export const processHourlyDigest = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    emailsSent: number;
    notificationsSent: number;
    errors: string[];
  }> => {
    const errors: string[] = [];
    let emailsSent = 0;
    let notificationsSent = 0;

    try {
      // 1. Get recent registration opens (last 2 hours to catch any missed)
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const registrationOpens = await ctx.runQuery(
        internal.notifications.queries.getRecentRegistrationOpens,
        { sinceTime: twoHoursAgo }
      );

      // 2. Get sessions with low availability
      const lowAvailabilitySessions = await ctx.runQuery(
        internal.notifications.queries.getSessionsWithLowAvailability,
        { threshold: LOW_AVAILABILITY_THRESHOLD }
      );

      // 3. Build notification list per family
      const familyNotifications = new Map<
        Id<"families">,
        {
          email: string;
          displayName: string;
          notifications: SessionNotification[];
        }
      >();

      // Process registration opens
      for (const { changeId, sessionId, session } of registrationOpens) {
        const families = await ctx.runQuery(
          internal.notifications.queries.getFamiliesWithInterestedRegistrations,
          { sessionId }
        );

        for (const family of families) {
          // Check if already notified
          const alreadySent = await ctx.runQuery(
            internal.notifications.queries.hasNotificationBeenSent,
            {
              familyId: family.familyId,
              sessionId,
              changeType: "registration_opened",
            }
          );

          if (alreadySent) continue;

          // Add to family's notifications
          if (!familyNotifications.has(family.familyId)) {
            familyNotifications.set(family.familyId, {
              email: family.email,
              displayName: family.displayName,
              notifications: [],
            });
          }

          familyNotifications.get(family.familyId)!.notifications.push({
            sessionId,
            changeType: "registration_opened",
            changeId,
            session,
            childName: family.childName,
          });
        }
      }

      // Process low availability
      for (const { sessionId, spotsRemaining, session } of lowAvailabilitySessions) {
        const families = await ctx.runQuery(
          internal.notifications.queries.getFamiliesWithInterestedRegistrations,
          { sessionId }
        );

        for (const family of families) {
          // Check if already notified
          const alreadySent = await ctx.runQuery(
            internal.notifications.queries.hasNotificationBeenSent,
            {
              familyId: family.familyId,
              sessionId,
              changeType: "low_availability",
            }
          );

          if (alreadySent) continue;

          // Add to family's notifications
          if (!familyNotifications.has(family.familyId)) {
            familyNotifications.set(family.familyId, {
              email: family.email,
              displayName: family.displayName,
              notifications: [],
            });
          }

          familyNotifications.get(family.familyId)!.notifications.push({
            sessionId,
            changeType: "low_availability",
            session: { ...session, spotsRemaining },
            childName: family.childName,
          });

          // Update the availability snapshot
          await ctx.runMutation(
            internal.notifications.mutations.updateAvailabilitySnapshot,
            {
              sessionId,
              enrolledCount:
                (session as unknown as { capacity?: number }).capacity !== undefined
                  ? ((session as unknown as { capacity?: number }).capacity || 0) - spotsRemaining
                  : 0,
              capacity:
                (session as unknown as { capacity?: number }).capacity || spotsRemaining,
            }
          );
        }
      }

      // 4. Send emails to each family
      for (const [familyId, data] of familyNotifications) {
        if (data.notifications.length === 0) continue;

        // Get brand info for this family
        const brand = await ctx.runQuery(
          internal.notifications.queries.getFamilyCityBrand,
          { familyId }
        );

        const digest: FamilyDigest = {
          familyId,
          email: data.email,
          displayName: data.displayName,
          notifications: data.notifications,
          brandName: brand?.brandName || FROM_NAME_DEFAULT,
          domain: brand?.domain || "pdxcamps.com",
          fromEmail: brand?.fromEmail || FROM_EMAIL_DEFAULT,
        };

        try {
          const subject = buildEmailSubject(digest);
          const html = buildDigestEmailHtml(digest);
          const text = buildDigestEmailText(digest);

          const emailId = await resend.sendEmail(ctx, {
            from: `${digest.brandName} <${digest.fromEmail}>`,
            to: [digest.email],
            subject,
            html,
            text,
          });

          emailsSent++;

          // Record each notification as sent
          for (const notif of data.notifications) {
            await ctx.runMutation(
              internal.notifications.mutations.markNotificationSent,
              {
                familyId,
                sessionId: notif.sessionId,
                changeType: notif.changeType,
                emailId: emailId as string,
              }
            );

            // Mark the scrape change as notified (if applicable)
            if (notif.changeId) {
              await ctx.runMutation(
                internal.notifications.mutations.markScrapeChangeNotified,
                { changeId: notif.changeId }
              );
            }

            notificationsSent++;
          }
        } catch (error) {
          errors.push(
            `Failed to send email to ${data.email}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      console.log(
        `Notification digest complete: ${emailsSent} emails sent, ${notificationsSent} notifications`
      );

      return {
        success: true,
        emailsSent,
        notificationsSent,
        errors,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Fatal error: ${errorMsg}`);
      console.error("Notification digest failed:", error);

      return {
        success: false,
        emailsSent,
        notificationsSent,
        errors,
      };
    }
  },
});

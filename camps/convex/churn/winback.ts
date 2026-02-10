'use node';

/**
 * Win-back Email Actions
 *
 * 3-email sequence sent after cancellation:
 * - Day 3: "We miss you" + what they're losing
 * - Day 7: Retention offer (discount or pause)
 * - Day 14: Final reminder before data cleanup
 */

import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { resend } from '../email';

export const sendWinbackEmail = internalAction({
  args: {
    familyId: v.id('families'),
    emailNumber: v.number(), // 1, 2, or 3
  },
  handler: async (ctx, args) => {
    // Get family info
    const family: any = await ctx.runQuery(internal.churn.queries.getFamilyForWinback, {
      familyId: args.familyId,
    });
    if (!family) return;

    // Get city brand info
    const brand: any = await ctx.runQuery(internal.emailAutomation.queries.getCityBrand, {
      cityId: family.primaryCityId,
    });
    if (!brand) return;

    // Get their saved camp count for personalization
    const savedCount: number = await ctx.runQuery(internal.churn.queries.getSavedCampCount, {
      familyId: args.familyId,
    });

    const { subject, html, text } = buildWinbackEmail(
      args.emailNumber,
      family.displayName,
      savedCount,
      brand,
    );

    await resend.sendEmail(ctx, {
      from: `${brand.brandName} <${brand.fromEmail}>`,
      to: [family.email],
      subject,
      html,
      text,
    });
  },
});

function buildWinbackEmail(
  emailNumber: number,
  displayName: string,
  savedCount: number,
  brand: { brandName: string; domain: string; fromEmail: string },
): { subject: string; html: string; text: string } {
  const footer = `
    <p style="color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
      — The ${brand.brandName} Team<br/>
      <a href="https://${brand.domain}" style="color: #E5A33B;">${brand.domain}</a><br/>
      <a href="https://${brand.domain}/settings" style="color: #999;">Manage email preferences</a>
    </p>
  `;

  const textFooter = `\n---\n— The ${brand.brandName} Team\n${brand.domain}\nManage email preferences: https://${brand.domain}/settings`;

  if (emailNumber === 1) {
    // Day 3: "We miss you"
    return {
      subject: `Your ${savedCount} saved camps are waiting for you`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Hi ${displayName},</p>
          <p>We noticed you recently canceled your ${brand.brandName} Premium subscription. We're sorry to see you go!</p>
          ${savedCount > 0 ? `
            <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; font-weight: 600; color: #92400e;">You have ${savedCount} saved camp${savedCount > 1 ? 's' : ''}</p>
              <p style="margin: 8px 0 0; color: #a16207; font-size: 14px;">
                Without Premium, you'll only be able to keep ${Math.min(savedCount, 5)} and won't be able to add more once you reach the free limit.
              </p>
            </div>
          ` : ''}
          <p>Here's what you'll lose access to:</p>
          <ul style="color: #666; font-size: 14px;">
            <li>Unlimited camp saves</li>
            <li>Full 12-week summer view</li>
            <li>Calendar sync (Google, Apple, Outlook)</li>
            <li>Plan sharing with family & friends</li>
          </ul>
          <p style="text-align: center; margin: 24px 0;">
            <a href="https://${brand.domain}/upgrade" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Resubscribe</a>
          </p>
          ${footer}
        </div>
      `,
      text: `Hi ${displayName},\n\nWe noticed you recently canceled your ${brand.brandName} Premium subscription. We're sorry to see you go!\n\n${savedCount > 0 ? `You have ${savedCount} saved camps. Without Premium, you'll only be able to keep ${Math.min(savedCount, 5)}.\n\n` : ''}What you'll lose:\n- Unlimited camp saves\n- Full 12-week summer view\n- Calendar sync\n- Plan sharing\n\nResubscribe: https://${brand.domain}/upgrade${textFooter}`,
    };
  }

  if (emailNumber === 2) {
    // Day 7: Retention offer
    return {
      subject: `Special offer: Come back to ${brand.brandName} Premium`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Hi ${displayName},</p>
          <p>It's been a week since you left ${brand.brandName} Premium. We'd love to have you back.</p>
          <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
            <p style="font-size: 20px; font-weight: 700; color: #92400e; margin: 0 0 8px;">Come back for $2.99/month</p>
            <p style="color: #a16207; margin: 0; font-size: 14px;">That's 40% off our regular price. All premium features included.</p>
          </div>
          <p style="text-align: center; margin: 24px 0;">
            <a href="https://${brand.domain}/upgrade?offer=winback" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Claim Your Discount</a>
          </p>
          <p style="color: #666; font-size: 13px; text-align: center;">This offer expires in 7 days.</p>
          ${footer}
        </div>
      `,
      text: `Hi ${displayName},\n\nIt's been a week since you left ${brand.brandName} Premium. We'd love to have you back.\n\nSpecial offer: Come back for $2.99/month — that's 40% off. All premium features included.\n\nClaim your discount: https://${brand.domain}/upgrade?offer=winback\n\nThis offer expires in 7 days.${textFooter}`,
    };
  }

  // Email 3: Day 14 - Final reminder
  return {
    subject: `Last chance: Your ${brand.brandName} savings expire soon`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${displayName},</p>
        <p>This is a final heads-up: your special offer to rejoin ${brand.brandName} Premium at <strong>$2.99/month</strong> is about to expire.</p>
        ${savedCount > 0 ? `<p>Your ${savedCount} saved camp${savedCount > 1 ? 's are' : ' is'} still waiting for you.</p>` : ''}
        <p style="text-align: center; margin: 24px 0;">
          <a href="https://${brand.domain}/upgrade?offer=winback" style="display: inline-block; padding: 14px 28px; background-color: #E5A33B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Rejoin at $2.99/month</a>
        </p>
        <p style="color: #666; font-size: 13px;">We hope to see you back. If not, no worries — your account will remain active on the free plan.</p>
        ${footer}
      </div>
    `,
    text: `Hi ${displayName},\n\nThis is a final heads-up: your special offer to rejoin ${brand.brandName} Premium at $2.99/month is about to expire.\n\n${savedCount > 0 ? `Your ${savedCount} saved camps are still waiting for you.\n\n` : ''}Rejoin: https://${brand.domain}/upgrade?offer=winback\n\nIf not, no worries — your account will remain active on the free plan.${textFooter}`,
  };
}

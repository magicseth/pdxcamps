'use node';

import { internalAction } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Send org claim verification email via Resend.
 */
export const sendClaimVerificationEmail = internalAction({
  args: {
    claimId: v.id('orgClaims'),
    email: v.string(),
    orgName: v.string(),
    token: v.string(),
  },
  handler: async (_ctx, args) => {
    // Import Resend dynamically to avoid issues in non-node context
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const verifyUrl = `${process.env.SITE_URL || 'https://pdxcamps.com'}/org-dashboard/verify?token=${args.token}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify Your Organization</h2>
        <p>You've requested to claim <strong>${args.orgName}</strong> on our camp platform.</p>
        <p>Click the button below to verify your ownership and access your organization dashboard:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="background: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Verify & Access Dashboard
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #6b7280; font-size: 14px;">This link expires in 7 days.</p>
      </div>
    `;

    const text = `Verify your organization claim for ${args.orgName}.\n\nClick here to verify: ${verifyUrl}\n\nIf you didn't request this, ignore this email.`;

    await resend.emails.send({
      from: 'Camp Empire <hello@pdxcamps.com>',
      to: [args.email],
      subject: `Verify your claim for ${args.orgName}`,
      html,
      text,
    });

    return { sent: true };
  },
});

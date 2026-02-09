"use node";

import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { resend } from '../email';

export const notifyNewPartnerApplication = internalAction({
  args: {
    organizationName: v.string(),
    contactName: v.string(),
    email: v.string(),
    organizationType: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await resend.sendEmail(ctx, {
      from: 'PDX Camps <hello@pdxcamps.com>',
      to: ['seth@magicseth.com'],
      subject: `New partner application: ${args.organizationName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">New Partner Application</h2>

          <table style="border-collapse: collapse; width: 100%;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Organization:</td>
              <td style="padding: 8px 0;">${args.organizationName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Contact:</td>
              <td style="padding: 8px 0;">${args.contactName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${args.email}">${args.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Type:</td>
              <td style="padding: 8px 0;">${args.organizationType}</td>
            </tr>
            ${args.message ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Message:</td>
              <td style="padding: 8px 0;">${args.message}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Time:</td>
              <td style="padding: 8px 0;">${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}</td>
            </tr>
          </table>
        </div>
      `,
      text: `New partner application!\n\nOrganization: ${args.organizationName}\nContact: ${args.contactName}\nEmail: ${args.email}\nType: ${args.organizationType}${args.message ? `\nMessage: ${args.message}` : ''}\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`,
    });
  },
});

export const sendPartnerApprovalEmail = internalAction({
  args: {
    email: v.string(),
    contactName: v.string(),
    organizationName: v.string(),
    partnerCode: v.string(),
  },
  handler: async (ctx, args) => {
    const partnerLink = `https://pdxcamps.com/p/${args.partnerCode}`;

    await resend.sendEmail(ctx, {
      from: 'PDX Camps <hello@pdxcamps.com>',
      to: [args.email],
      subject: `Your PDX Camps partner application has been approved!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Welcome to the PDX Camps Partner Program!</h2>

          <p>Hi ${args.contactName},</p>

          <p>Great news — your partner application for <strong>${args.organizationName}</strong> has been approved!</p>

          <p>Here's your unique partner link:</p>

          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <a href="${partnerLink}" style="font-size: 16px; font-weight: bold; color: #0369a1;">${partnerLink}</a>
          </div>

          <p><strong>How it works:</strong></p>
          <ul>
            <li>Share your link with families in your community</li>
            <li>When they sign up and upgrade to Premium, you earn <strong>20% commission</strong> on their subscription for the first year</li>
            <li>Track your referrals and earnings on your <a href="https://pdxcamps.com/partner/dashboard" style="color: #0369a1; font-weight: bold;">Partner Dashboard</a></li>
          </ul>

          <p>Thanks for helping families in your community discover summer camps!</p>

          <p>Best,<br/>Seth<br/><span style="color: #666;">PDX Camps</span></p>
        </div>
      `,
      text: `Hi ${args.contactName},\n\nYour partner application for ${args.organizationName} has been approved!\n\nYour partner link: ${partnerLink}\n\nShare this link with families. When they sign up and upgrade to Premium, you earn 20% commission for the first year.\n\nTrack your referrals and earnings: https://pdxcamps.com/partner/dashboard\n\nThanks!\nSeth, PDX Camps`,
    });
  },
});

export const sendPartnerRejectionEmail = internalAction({
  args: {
    email: v.string(),
    contactName: v.string(),
    organizationName: v.string(),
  },
  handler: async (ctx, args) => {
    await resend.sendEmail(ctx, {
      from: 'PDX Camps <hello@pdxcamps.com>',
      to: [args.email],
      subject: `Update on your PDX Camps partner application`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Hi ${args.contactName},</p>

          <p>Thank you for your interest in the PDX Camps Partner Program.</p>

          <p>After reviewing your application for <strong>${args.organizationName}</strong>, we've decided not to move forward at this time.</p>

          <p>If you have any questions, feel free to reply to this email.</p>

          <p>Best,<br/>Seth<br/><span style="color: #666;">PDX Camps</span></p>
        </div>
      `,
      text: `Hi ${args.contactName},\n\nThank you for your interest in the PDX Camps Partner Program.\n\nAfter reviewing your application for ${args.organizationName}, we've decided not to move forward at this time.\n\nIf you have any questions, feel free to reply to this email.\n\nBest,\nSeth, PDX Camps`,
    });
  },
});

export const sendPartnerDigestEmail = internalAction({
  args: {
    email: v.string(),
    contactName: v.string(),
    organizationName: v.string(),
    partnerCode: v.string(),
    newReferrals: v.number(),
    newCommissionsCents: v.number(),
    totalEarningsCents: v.number(),
    totalPaidOutCents: v.number(),
    monthLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const partnerLink = `https://pdxcamps.com/p/${args.partnerCode}`;
    const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    await resend.sendEmail(ctx, {
      from: 'PDX Camps <hello@pdxcamps.com>',
      to: [args.email],
      subject: `Your PDX Camps partner earnings — ${args.monthLabel}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Monthly Partner Summary</h2>

          <p>Hi ${args.contactName},</p>

          <p>Here's your partner summary for <strong>${args.monthLabel}</strong>:</p>

          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; font-weight: bold;">New referrals this month</td>
              <td style="padding: 8px 0; text-align: right;">${args.newReferrals}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; font-weight: bold;">New commissions</td>
              <td style="padding: 8px 0; text-align: right;">${formatCents(args.newCommissionsCents)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; font-weight: bold;">Total earnings</td>
              <td style="padding: 8px 0; text-align: right;">${formatCents(args.totalEarningsCents)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Total paid out</td>
              <td style="padding: 8px 0; text-align: right;">${formatCents(args.totalPaidOutCents)}</td>
            </tr>
          </table>

          <p>Your partner link: <a href="${partnerLink}">${partnerLink}</a></p>

          <p>Keep sharing to earn more! Every family that upgrades through your link earns you 20% for their first year.</p>

          <p>Best,<br/>Seth<br/><span style="color: #666;">PDX Camps</span></p>
        </div>
      `,
      text: `Hi ${args.contactName},\n\nPartner summary for ${args.monthLabel}:\n\nNew referrals: ${args.newReferrals}\nNew commissions: ${formatCents(args.newCommissionsCents)}\nTotal earnings: ${formatCents(args.totalEarningsCents)}\nTotal paid out: ${formatCents(args.totalPaidOutCents)}\n\nYour link: ${partnerLink}\n\nBest,\nSeth, PDX Camps`,
    });
  },
});

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

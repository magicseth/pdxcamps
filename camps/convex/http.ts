import { httpRouter } from 'convex/server';
import { components, internal } from './_generated/api';
import { registerRoutes } from '@convex-dev/stripe';
import { httpAction } from './_generated/server';
import { resend } from './email';

const http = httpRouter();

// Register Stripe webhook handler at /stripe/webhook
// Configure in Stripe Dashboard: https://<your-convex-deployment>.convex.site/stripe/webhook
registerRoutes(http, components.stripe, {
  webhookPath: '/stripe/webhook',
});

// Register Resend webhook handler for email delivery events
// Configure in Resend Dashboard: https://deafening-schnauzer-923.convex.site/resend-webhook
http.route({
  path: '/resend-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    return await resend.handleResendEventWebhook(ctx, req);
  }),
});

// Inbound email webhook - receives emails sent to @pdxcamps.com
// Configure in Resend Dashboard: https://deafening-schnauzer-923.convex.site/resend-inbound-webhook
http.route({
  path: "/resend-inbound-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await req.json();

      // Log the full payload for debugging
      console.log("Inbound email payload:", JSON.stringify(body, null, 2));

      // Resend inbound webhook only sends metadata - we need to fetch the body
      // https://resend.com/docs/dashboard/webhooks/inbound-emails
      const data = body.data || body;
      const { email_id, from, to, subject } = data;

      if (!email_id) {
        console.error("No email_id in inbound webhook payload");
        return new Response(JSON.stringify({ error: "No email_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Fetch the full email content from Resend API
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.error("RESEND_API_KEY not set");
        return new Response(JSON.stringify({ error: "API key not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const emailResponse = await fetch(
        `https://api.resend.com/emails/${email_id}`,
        {
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
          },
        }
      );

      let textBody: string | undefined;
      let htmlBody: string | undefined;

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        console.log("Fetched email data:", JSON.stringify(emailData, null, 2));
        textBody = emailData.text;
        htmlBody = emailData.html;
      } else {
        console.error("Failed to fetch email:", emailResponse.status, await emailResponse.text());
      }

      await ctx.runMutation(internal.email.storeInboundEmail, {
        resendId: email_id,
        from: from || "unknown",
        to: Array.isArray(to) ? to : [to || "unknown"],
        subject: subject || "(no subject)",
        textBody,
        htmlBody,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Inbound email error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to process inbound email" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;

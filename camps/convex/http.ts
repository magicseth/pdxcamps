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
// Configure in Resend Dashboard: https://deafening-schnauzer-923.convex.site/inbound-email
http.route({
  path: "/inbound-email",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await req.json();

      // Log the full payload for debugging
      console.log("Inbound email payload:", JSON.stringify(body, null, 2));

      // Resend inbound webhook payload is nested under 'data'
      // https://resend.com/docs/dashboard/webhooks/inbound-emails
      const data = body.data || body; // Handle both nested and flat structures
      const { from, to, subject, text, html } = data;

      await ctx.runMutation(internal.email.storeInboundEmail, {
        resendId: body.id || data.id || `inbound-${Date.now()}`,
        from: from || "unknown",
        to: Array.isArray(to) ? to : [to || "unknown"],
        subject: subject || "(no subject)",
        textBody: text,
        htmlBody: html,
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

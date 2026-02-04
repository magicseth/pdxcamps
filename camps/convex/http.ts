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

      // Only handle email.received events
      if (body.type !== "email.received") {
        return new Response(JSON.stringify({ ignored: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const data = body.data || body;
      const { email_id, from, to, subject } = data;

      if (!email_id) {
        console.error("No email_id in inbound webhook payload");
        return new Response(JSON.stringify({ error: "No email_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.error("RESEND_API_KEY not set");
        return new Response(JSON.stringify({ error: "API key not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Forward the email using Resend API
      const forwardResponse = await fetch(
        "https://api.resend.com/emails/received/forward",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_id: email_id,
            to: "seth@magicseth.com",
            from: "hello@pdxcamps.com",
          }),
        }
      );

      if (!forwardResponse.ok) {
        console.error("Failed to forward email:", await forwardResponse.text());
      } else {
        const forwardData = await forwardResponse.json();
        console.log("Forwarded email:", forwardData);
      }

      // Also store in database for admin view
      // Fetch the email content for storage
      const emailResponse = await fetch(
        `https://api.resend.com/emails/received/${email_id}`,
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
        textBody = emailData.text;
        htmlBody = emailData.html;
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

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

      // Check if this is Seth replying to a forwarded email
      const isSethReply = from.includes("seth@magicseth.com");

      // Fetch the email content
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

      if (isSethReply) {
        // This is Seth replying - extract original recipient and send reply
        console.log("Seth reply detected. Subject:", subject);
        console.log("Body preview:", textBody?.slice(0, 500));

        // Look for routing info in subject OR body
        // Subject format: "Re: [From: original@email.com] Original Subject"
        // Body format: "[Reply routing: original@email.com]"
        let originalSender: string | null = null;

        // Try subject first
        const subjectMatch = subject.match(/\[From: ([^\]]+)\]/);
        if (subjectMatch) {
          originalSender = subjectMatch[1];
          console.log("Found sender in subject:", originalSender);
        }

        // Try body if not in subject
        if (!originalSender && textBody) {
          const bodyMatch = textBody.match(/\[Reply routing: ([^\]]+)\]/);
          if (bodyMatch) {
            originalSender = bodyMatch[1];
            console.log("Found sender in body:", originalSender);
          }
        }

        // If still not found, look up the most recent inbound email that's not from Seth
        if (!originalSender) {
          const recentInbound = await ctx.runQuery(internal.email.getMostRecentNonSethInbound);
          if (recentInbound) {
            originalSender = recentInbound.fromEmail;
            console.log("Found sender from recent inbound:", originalSender);
          }
        }

        if (originalSender) {

          // Extract just Seth's reply (before the quoted content)
          // Look for common quote markers
          let replyText = textBody || "";
          const quoteMarkers = [
            /\n\s*On .+ wrote:\s*\n/i,           // "On Mon, Jan 1, 2024 at 10:00 AM X wrote:"
            /\n\s*-{3,}\s*Original Message\s*-{3,}/i,  // "--- Original Message ---"
            /\n\s*>{1,}/,                         // "> quoted text"
            /\n\s*From: .+\n/i,                   // "From: someone"
          ];

          for (const marker of quoteMarkers) {
            const match = replyText.match(marker);
            if (match && match.index !== undefined) {
              replyText = replyText.substring(0, match.index).trim();
              break;
            }
          }

          // Clean up the subject (remove the [From: ...] tag)
          const cleanSubject = subject
            .replace(/\[From: [^\]]+\]\s*/g, "")
            .replace(/^Re:\s*/i, "");

          // Send reply using Node action
          await ctx.runAction(internal.emailForward.sendReply, {
            to: originalSender,
            subject: `Re: ${cleanSubject}`,
            text: replyText,
          });
          console.log(`Sent reply to ${originalSender}`);
        } else {
          console.log("Seth's email but couldn't find original sender in subject or body");
        }
      } else {
        // Forward to Seth using Node action (preserves attachments)
        await ctx.runAction(internal.emailForward.forwardToSeth, {
          emailId: email_id,
          originalFrom: from,
          originalSubject: subject || "(no subject)",
        });
        console.log(`Forwarded email from ${from} to Seth`);
      }

      // Store in database for admin view
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

import { httpRouter } from 'convex/server';
import { components, internal } from './_generated/api';
import { registerRoutes } from '@convex-dev/stripe';
import { httpAction } from './_generated/server';
import { resend } from './email';

const http = httpRouter();

// ============ CITY ASSET ROUTES ============
// Using pathPrefix to support dynamic path segments

/**
 * Serve city icon from Convex storage
 * Route: /city-icon/{citySlug}
 * Falls back to a default icon if city doesn't have one
 */
http.route({
  pathPrefix: '/city-icon/',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    // Extract city slug from path: /city-icon/san-francisco-bay-area -> san-francisco-bay-area
    const citySlug = url.pathname.replace('/city-icon/', '').replace(/\/$/, '');

    if (!citySlug) {
      return new Response('City slug required', { status: 400 });
    }

    // Look up city by slug
    const city = await ctx.runQuery(internal.cities.queries.getCityBySlugInternal, {
      slug: citySlug,
    });

    // Serve the city's icon from storage if it exists
    if (!city?.iconStorageId) {
      return new Response('Icon not found', { status: 404 });
    }

    const blob = await ctx.storage.get(city.iconStorageId);
    if (!blob) {
      return new Response('Icon file not found', { status: 404 });
    }

    return new Response(blob, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }),
});

/**
 * Serve city header image from Convex storage
 * Route: /city-header/{citySlug}
 */
http.route({
  pathPrefix: '/city-header/',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const citySlug = url.pathname.replace('/city-header/', '').replace(/\/$/, '');

    if (!citySlug) {
      return new Response('City slug required', { status: 400 });
    }

    // Look up city by slug
    const city = await ctx.runQuery(internal.cities.queries.getCityBySlugInternal, {
      slug: citySlug,
    });

    if (!city || !city.headerImageStorageId) {
      return new Response('Header image not found', { status: 404 });
    }

    // Get the blob from storage
    const blob = await ctx.storage.get(city.headerImageStorageId);
    if (!blob) {
      return new Response('Header image file not found', { status: 404 });
    }

    return new Response(blob, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }),
});

/**
 * Serve icon by domain - useful for favicon requests
 * Route: /icon-by-domain/{domain}
 */
http.route({
  pathPrefix: '/icon-by-domain/',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const domain = url.pathname.replace('/icon-by-domain/', '').replace(/\/$/, '');

    if (!domain) {
      return new Response('Domain required', { status: 400 });
    }

    // Look up city by domain
    const city = await ctx.runQuery(internal.cities.queries.getCityByDomainInternal, {
      domain,
    });

    if (!city || !city.iconStorageId) {
      return new Response('Icon not found', { status: 404 });
    }

    const blob = await ctx.storage.get(city.iconStorageId);
    if (!blob) {
      return new Response('Icon file not found', { status: 404 });
    }

    return new Response(blob, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }),
});

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
  path: '/resend-inbound-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await req.json();

      // Only handle email.received events
      if (body.type !== 'email.received') {
        return new Response(JSON.stringify({ ignored: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const data = body.data || body;
      const { email_id, from, to, subject } = data;

      console.log('Inbound email - from:', from, 'to:', to, 'subject:', subject);

      if (!email_id) {
        console.error('No email_id in inbound webhook payload');
        return new Response(JSON.stringify({ error: 'No email_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check if this is Seth replying to a forwarded email
      const isSethReply = from.includes('seth@magicseth.com');

      // Fetch the email content using SDK (requires Node.js action)
      const emailContent = await ctx.runAction(internal.emailForward.getReceivedEmailContent, {
        emailId: email_id,
      });

      let textBody: string | undefined = emailContent.text ?? undefined;
      let htmlBody: string | undefined = emailContent.html ?? undefined;

      if (emailContent.error) {
        console.error('Failed to fetch email content:', emailContent.error);
      } else {
        console.log('Fetched email content successfully');
      }

      if (isSethReply) {
        // This is Seth replying - extract original recipient and send reply
        console.log('Seth reply detected. Subject:', subject);
        console.log('Body preview:', textBody?.slice(0, 500));

        // Look for routing info in subject OR body
        // Subject format: "Re: [From: original@email.com] Original Subject"
        // Body format: "[Reply routing: original@email.com]"
        let originalSender: string | null = null;

        // Try subject first
        const subjectMatch = subject.match(/\[From: ([^\]]+)\]/);
        if (subjectMatch) {
          originalSender = subjectMatch[1];
          console.log('Found sender in subject:', originalSender);
        }

        // Try body if not in subject
        if (!originalSender && textBody) {
          const bodyMatch = textBody.match(/\[Reply routing: ([^\]]+)\]/);
          if (bodyMatch) {
            originalSender = bodyMatch[1];
            console.log('Found sender in body:', originalSender);
          }
        }

        // If still not found, look up the most recent inbound email that's not from Seth
        if (!originalSender) {
          const recentInbound = await ctx.runQuery(internal.email.getMostRecentNonSethInbound);
          if (recentInbound) {
            originalSender = recentInbound.fromEmail;
            console.log('Found sender from recent inbound:', originalSender);
          }
        }

        if (originalSender) {
          // Extract just Seth's reply (before the quoted content)
          // Look for common quote markers
          const fullText = textBody || '';
          let replyText = fullText;
          const quoteMarkers = [
            /\n\s*On .+ wrote:\s*\n/i, // "On Mon, Jan 1, 2024 at 10:00 AM X wrote:"
            /\n\s*-{3,}\s*Original Message\s*-{3,}/i, // "--- Original Message ---"
            /\n\s*From: .+\nSent: /i, // Outlook style
            /\n\s*-{3,}\s*Forwarded message\s*-{3,}/i, // Forwarded message
          ];

          for (const marker of quoteMarkers) {
            const match = replyText.match(marker);
            if (match && match.index !== undefined && match.index > 10) {
              // Only strip if there's meaningful content before the quote
              replyText = replyText.substring(0, match.index).trim();
              break;
            }
          }

          // If stripping removed everything, use the full text
          if (!replyText.trim()) {
            replyText = fullText;
          }

          console.log('Reply text to send:', replyText.slice(0, 200));

          // Clean up the subject (remove the [From: ...] tag)
          const cleanSubject = subject.replace(/\[From: [^\]]+\]\s*/g, '').replace(/^Re:\s*/i, '');

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
          originalSubject: subject || '(no subject)',
        });
        console.log(`Forwarded email from ${from} to Seth`);
      }

      // Store in database for admin view
      await ctx.runMutation(internal.email.storeInboundEmail, {
        resendId: email_id,
        from: from || 'unknown',
        to: Array.isArray(to) ? to : [to || 'unknown'],
        subject: subject || '(no subject)',
        textBody,
        htmlBody,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Inbound email error:', error);
      return new Response(JSON.stringify({ error: 'Failed to process inbound email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

export default http;

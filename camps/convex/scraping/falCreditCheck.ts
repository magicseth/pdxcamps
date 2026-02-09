'use node';

/**
 * FAL.ai Credit Monitoring
 *
 * Detects when fal.ai credits are exhausted (Forbidden error),
 * pauses image generation, and checks periodically for restoration.
 * Sends email alerts both when paused and when credits are back.
 */

import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { fal } from '@fal-ai/client';
import { resend } from '../email';

// Configure FAL client
fal.config({
  credentials: process.env.FAL_API_KEY,
});

const REPORT_EMAIL = 'seth@magicseth.com';
const FROM_EMAIL = 'hello@pdxcamps.com';
const FROM_NAME = 'PDX Camps';
const FLAG_KEY = 'fal_image_generation';

/**
 * Check if fal.ai credits are available by making a minimal API call.
 * If credits are back, clears the paused flag and sends a notification.
 * Called by cron every hour when generation is paused.
 */
export const checkFalCredits = internalAction({
  args: {},
  handler: async (ctx): Promise<{ status: string }> => {
    // Check current flag
    const flag = await ctx.runQuery(internal.scraping.falCreditQueries.getFlag, {
      key: FLAG_KEY,
    });

    // Only check if currently paused
    if (!flag || flag.value !== 'paused') {
      return { status: 'not_paused' };
    }

    try {
      // Try a minimal fal.ai call to check if credits are available
      // We use a tiny, cheap model call with minimal params
      await fal.subscribe('fal-ai/flux-pro/v1.1', {
        input: {
          prompt: 'test',
          image_size: 'square',
          num_images: 1,
          safety_tolerance: '2',
        },
      });

      // If we got here, credits are back!
      await ctx.runMutation(internal.scraping.falCreditQueries.setFlag, {
        key: FLAG_KEY,
        value: 'active',
        message: `Credits restored at ${new Date().toISOString()}`,
      });

      // Send "credits restored" email
      await resend.sendEmail(ctx, {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [REPORT_EMAIL],
        subject: '🟢 FAL.ai credits restored — image generation resumed',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #16a34a; font-size: 20px;">FAL.ai Credits Restored</h1>
            <p>The fal.ai API is responding normally again. Image generation will resume on the next cron cycle (every 6 hours).</p>
            <p style="color: #666; font-size: 14px;">Paused since: ${flag.message || 'unknown'}</p>
            <p style="color: #666; font-size: 14px;">Restored at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST</p>
          </div>
        `,
      });

      console.log('[FalCredits] Credits restored, generation resumed');
      return { status: 'restored' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('Forbidden') || message.includes('403')) {
        console.log('[FalCredits] Still no credits — staying paused');
        return { status: 'still_paused' };
      }

      // Some other error — log but don't change state
      console.error('[FalCredits] Unexpected error during credit check:', message);
      return { status: 'check_error' };
    }
  },
});

/**
 * Pause image generation and send alert email.
 * Called when a Forbidden error is detected during image generation.
 */
export const pauseAndNotify = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    // Check if already paused to avoid duplicate emails
    const flag = await ctx.runQuery(internal.scraping.falCreditQueries.getFlag, {
      key: FLAG_KEY,
    });

    if (flag?.value === 'paused') {
      console.log('[FalCredits] Already paused, skipping duplicate notification');
      return;
    }

    const pausedAt = new Date().toISOString();

    // Set the paused flag
    await ctx.runMutation(internal.scraping.falCreditQueries.setFlag, {
      key: FLAG_KEY,
      value: 'paused',
      message: `Paused at ${pausedAt} due to Forbidden (credits exhausted)`,
    });

    // Send alert email
    await resend.sendEmail(ctx, {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [REPORT_EMAIL],
      subject: '🔴 FAL.ai credits exhausted — image generation paused',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc2626; font-size: 20px;">FAL.ai Credits Exhausted</h1>
          <p>Image generation has been <strong>automatically paused</strong> because fal.ai returned a <code>Forbidden</code> error, which means the API credits are used up.</p>
          <h2 style="font-size: 16px; color: #333;">What to do:</h2>
          <ol style="color: #444; line-height: 1.6;">
            <li>Go to <a href="https://fal.ai/dashboard" style="color: #2563eb;">fal.ai dashboard</a> and add more credits</li>
            <li>Image generation will <strong>automatically resume</strong> once credits are detected (checked every hour)</li>
          </ol>
          <p style="color: #666; font-size: 14px;">Paused at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST</p>
          <p style="color: #666; font-size: 14px;">The credit checker runs hourly. You'll get another email when credits are restored.</p>
        </div>
      `,
    });

    console.log('[FalCredits] Paused image generation and sent alert email');
  },
});

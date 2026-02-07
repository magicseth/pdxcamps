'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { Resend } from 'resend';

/**
 * Fetch the content of a received email using the SDK
 */
export const getReceivedEmailContent = internalAction({
  args: {
    emailId: v.string(),
  },
  handler: async (ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not set');
    }

    const resend = new Resend(resendApiKey);

    try {
      const { data, error } = await resend.emails.receiving.get(args.emailId);

      if (error) {
        console.error('Failed to get email content:', error);
        return { text: undefined, html: undefined, error: error.message };
      }

      console.log('Fetched email content, keys:', Object.keys(data || {}));
      return {
        text: data?.text,
        html: data?.html,
        error: undefined,
      };
    } catch (err) {
      console.error('Error fetching email:', err);
      return { text: undefined, html: undefined, error: String(err) };
    }
  },
});

/**
 * Forward an inbound email to Seth using Resend SDK
 * Runs in Node.js environment to access the SDK
 */
export const forwardToSeth = internalAction({
  args: {
    emailId: v.string(),
    originalFrom: v.string(),
    originalSubject: v.string(),
  },
  handler: async (ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not set');
    }

    const resend = new Resend(resendApiKey);

    // Tag subject with original sender for reply routing
    const taggedSubject = `[From: ${args.originalFrom}] ${args.originalSubject}`;

    // Use the SDK's forward helper - handles fetching content + attachments
    const { data, error } = await resend.emails.receiving.forward({
      emailId: args.emailId,
      to: 'seth@magicseth.com',
      from: 'PDX Camps <hello@pdxcamps.com>',
      // Add custom text that includes the tagged subject for reply routing
      passthrough: false,
      text: `[Reply routing: ${args.originalFrom}]\nOriginal subject: ${args.originalSubject}\n\n---\n`,
    });

    if (error) {
      console.error('Failed to forward email:', error);
      throw new Error(`Forward failed: ${error.message}`);
    }

    console.log('Forwarded email to Seth:', data);
    return data;
  },
});

/**
 * Send Seth's reply back to the original sender
 */
export const sendReply = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not set');
    }

    const resend = new Resend(resendApiKey);

    // Ensure we have content to send
    const textContent = args.text?.trim() || '(no message)';

    const { data, error } = await resend.emails.send({
      from: 'Seth <hello@pdxcamps.com>',
      to: [args.to],
      subject: args.subject,
      text: textContent,
      html: args.html || undefined,
      replyTo: ['hello@pdxcamps.com'],
    });

    if (error) {
      console.error('Failed to send reply:', error);
      throw new Error(`Send failed: ${error.message}`);
    }

    console.log('Sent reply to:', args.to, data);
    return data;
  },
});

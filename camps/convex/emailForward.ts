"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

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
      throw new Error("RESEND_API_KEY not set");
    }

    const resend = new Resend(resendApiKey);

    // Fetch the email content first
    const emailData = await resend.emails.receiving.get(args.emailId);
    if (emailData.error) {
      console.error("Failed to fetch email:", emailData.error);
      throw new Error(`Fetch failed: ${emailData.error.message}`);
    }

    // Tag subject with original sender for reply routing
    const taggedSubject = `[From: ${args.originalFrom}] ${args.originalSubject}`;

    // Send fresh email with tagged subject
    const { data, error } = await resend.emails.send({
      to: "seth@magicseth.com",
      from: "PDX Camps <hello@pdxcamps.com>",
      subject: taggedSubject,
      text: emailData.data?.text || "(no content)",
      html: emailData.data?.html || undefined,
      replyTo: ["hello@pdxcamps.com"],
    });

    if (error) {
      console.error("Failed to forward email:", error);
      throw new Error(`Forward failed: ${error.message}`);
    }

    console.log("Forwarded email to Seth:", data);
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
      throw new Error("RESEND_API_KEY not set");
    }

    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from: "Seth <hello@pdxcamps.com>",
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
      replyTo: ["hello@pdxcamps.com"],
    });

    if (error) {
      console.error("Failed to send reply:", error);
      throw new Error(`Send failed: ${error.message}`);
    }

    console.log("Sent reply to:", args.to, data);
    return data;
  },
});

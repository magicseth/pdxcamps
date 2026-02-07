'use node';

/**
 * Contact Info Extractor
 *
 * Uses Stagehand to extract contact information from camp/organization websites
 * so we can reach out and ask permission for inclusion.
 */

import { action } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';

// Schema for contact information
const ContactInfoSchema = z.object({
  email: z.string().optional().describe('Primary contact email address'),
  phone: z.string().optional().describe('Primary contact phone number'),
  contactName: z.string().optional().describe('Name of the contact person if available'),
  contactTitle: z.string().optional().describe('Title/role of the contact person (e.g., Director, Manager)'),
  address: z.string().optional().describe('Physical address if available'),
});

export type ContactInfo = z.infer<typeof ContactInfoSchema>;

/**
 * Extract contact information from a website using Stagehand
 */
export const extractContactInfo = action({
  args: {
    url: v.string(),
    organizationId: v.optional(v.id('organizations')),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    contactInfo?: ContactInfo;
    error?: string;
  }> => {
    let stagehand: Stagehand | null = null;

    try {
      console.log(`[ContactExtractor] Starting extraction for: ${args.url}`);

      // Initialize Stagehand
      stagehand = new Stagehand({
        env: 'BROWSERBASE',
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        model: {
          modelName: 'anthropic/claude-sonnet-4-20250514',
          apiKey: process.env.MODEL_API_KEY!,
        },
        disablePino: true,
        verbose: 0,
      });

      await stagehand.init();
      console.log('[ContactExtractor] Stagehand initialized');

      const page = stagehand.context.pages()[0];

      // Navigate to the main URL
      await page.goto(args.url, { waitUntil: 'domcontentloaded', timeoutMs: 30000 });
      await page.waitForTimeout(3000);

      // Extract contact information
      console.log('[ContactExtractor] Extracting contact info...');

      const instruction = `Extract all contact information from this page. Look carefully for:
- Email addresses (especially info@, contact@, hello@, registration@, or any camp-related email)
- Phone numbers (in any format)
- Physical addresses
- Contact person names and their titles/roles (e.g., Camp Director, Program Manager)

Check the header, footer, sidebar, and main content areas. Also look for "Contact Us", "About", or "Connect" sections.`;

      const extractResult = await stagehand.extract(instruction, ContactInfoSchema);

      await stagehand.close();
      stagehand = null;

      console.log('[ContactExtractor] Extraction complete:', extractResult);

      // Cast the result to our expected type
      const contactInfo = extractResult as ContactInfo;

      // If we have an organization ID, save the contact info
      if (args.organizationId && contactInfo) {
        await ctx.runMutation(internal.scraping.contactExtractorHelpers.updateOrgContactInfo, {
          organizationId: args.organizationId,
          email: contactInfo.email,
          phone: contactInfo.phone,
        });
        console.log('[ContactExtractor] Updated organization contact info');
      }

      return {
        success: true,
        contactInfo,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ContactExtractor] Error:', errorMessage);

      if (stagehand) {
        try {
          await stagehand.close();
        } catch {
          // Ignore close errors
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

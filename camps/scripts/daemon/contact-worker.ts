/**
 * Contact extraction worker — extracts email/phone from org websites using Stagehand
 */

import { ContactInfo } from './types';
import { client, writeLog, logQueueStatus, createStagehand } from './shared';
import { api } from '../../convex/_generated/api';

/**
 * Extract contact info from a URL locally using Stagehand
 */
async function extractContactLocally(
  url: string,
  log: (msg: string) => void,
): Promise<{ success: boolean; contactInfo?: ContactInfo; error?: string }> {
  let stagehand: any = null;

  try {
    stagehand = await createStagehand('haiku');
    const page = stagehand.context.pages()[0];

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Use Stagehand's extract with a zod-like schema
    const { z } = await import('zod');
    const ContactInfoSchema = z.object({
      email: z.string().optional().describe('Primary contact email address'),
      phone: z.string().optional().describe('Primary contact phone number'),
      contactName: z.string().optional().describe('Name of the contact person'),
      contactTitle: z.string().optional().describe('Title/role of the contact person'),
      address: z.string().optional().describe('Physical address'),
    });

    const instruction = `Extract all contact information from this page. Look carefully for:
- Email addresses (especially info@, contact@, hello@, registration@, or any camp-related email)
- Phone numbers (in any format)
- Physical addresses
- Contact person names and their titles/roles (e.g., Camp Director, Program Manager)

Check the header, footer, sidebar, and main content areas. Also look for "Contact Us", "About", or "Connect" sections.`;

    const extractResult = await stagehand.extract(instruction, ContactInfoSchema);

    await stagehand.close();
    stagehand = null;

    return {
      success: true,
      contactInfo: extractResult as ContactInfo,
    };
  } catch (error) {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {}
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process organizations that need contact info extraction
 */
export async function processContactExtraction(verbose: boolean = false) {
  const log = (msg: string) => {
    writeLog(msg);
    console.log(msg);
  };

  // Get orgs needing contact info
  const orgsNeedingContact = await client.query(
    api.scraping.contactExtractorHelpers.getOrgsNeedingContactInfo,
    { limit: 3 },
  );

  if (!orgsNeedingContact || orgsNeedingContact.length === 0) {
    if (verbose) log('📧 No orgs need contact extraction');
    return;
  }

  log(`📧 Processing ${orgsNeedingContact.length} orgs for contact extraction...`);

  for (const org of orgsNeedingContact) {
    if (!org.website) continue;

    await logQueueStatus('   ');
    log(`   🔍 ${org.name}: ${org.website}`);

    try {
      const result = await extractContactLocally(org.website, log);

      // Save results to Convex
      await client.mutation(api.scraping.contactExtractorHelpers.saveOrgContactInfo, {
        organizationId: org._id,
        email: result.contactInfo?.email,
        phone: result.contactInfo?.phone,
      });

      if (result.success && result.contactInfo) {
        const info = result.contactInfo;
        if (info.email || info.phone) {
          log(`   ✅ Found: ${info.email || '-'} | ${info.phone || '-'}`);
        } else {
          log(`   ⚠️ No contact info on page`);
        }
      } else {
        log(`   ❌ Error: ${result.error || 'unknown'}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log(`   ❌ Error: ${errorMsg}`);

      // Still mark as attempted so we don't retry immediately
      try {
        await client.mutation(api.scraping.contactExtractorHelpers.saveOrgContactInfo, {
          organizationId: org._id,
        });
      } catch {}
    }
  }
}

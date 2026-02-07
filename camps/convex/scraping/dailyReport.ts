'use node';

/**
 * Daily Scraper Report
 *
 * Sends a daily email report with scraping statistics.
 */

import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { resend } from '../email';

const REPORT_EMAIL = 'seth@magicseth.com';
const FROM_EMAIL = 'hello@pdxcamps.com';
const FROM_NAME = 'PDX Camps';

/**
 * Send daily scraper report email.
 * Called by cron every morning.
 */
export const sendDailyReport = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
    try {
      // Get stats from the last 24 hours
      const stats = await ctx.runQuery(internal.scraping.dailyReportQueries.getDailyStats);

      // Get automation metrics
      const metrics = await ctx.runQuery(internal.scraping.scraperAutomation.getAutomationMetrics);

      // Get recent alerts
      const alerts = await ctx.runQuery(internal.scraping.dailyReportQueries.getRecentAlerts);

      // Format the date
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Build the email
      const subject = `📊 Scraper Report: ${stats.jobsCompleted} jobs, ${stats.sessionsFound} sessions found`;

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">Daily Scraper Report</h1>
          <p style="color: #666; margin-top: 0;">${dateStr}</p>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 0;">📈 Last 24 Hours</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Jobs Completed</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${stats.jobsCompleted}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Jobs Failed</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: ${stats.jobsFailed > 0 ? '#dc2626' : '#16a34a'};">${stats.jobsFailed}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Sessions Found</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${stats.sessionsFound}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Sessions Created</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #16a34a;">${stats.sessionsCreated}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">Sessions Updated</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${stats.sessionsUpdated}</td>
              </tr>
            </table>
          </div>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 0;">🔧 System Health</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Active Sources</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${metrics.sources.active}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Healthy Scrapers</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #16a34a;">${metrics.health.healthy}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Degraded Scrapers</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: ${metrics.health.degraded > 0 ? '#f59e0b' : '#16a34a'};">${metrics.health.degraded}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Failing Scrapers</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: ${metrics.health.failing > 0 ? '#dc2626' : '#16a34a'};">${metrics.health.failing}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Sources Without Scraper</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${metrics.sources.withoutScraper}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">Dev Requests Pending</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${metrics.devRequests.pending}</td>
              </tr>
            </table>
          </div>

          ${
            alerts.length > 0
              ? `
          <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h2 style="color: #dc2626; font-size: 18px; margin-top: 0;">⚠️ Recent Alerts (${alerts.length})</h2>
            <ul style="margin: 0; padding-left: 20px;">
              ${alerts
                .slice(0, 5)
                .map(
                  (alert: { message: string; severity: string }) => `
                <li style="padding: 4px 0; color: ${alert.severity === 'error' ? '#dc2626' : '#f59e0b'};">
                  ${alert.message}
                </li>
              `,
                )
                .join('')}
            </ul>
            ${alerts.length > 5 ? `<p style="color: #666; font-size: 14px; margin-bottom: 0;">...and ${alerts.length - 5} more</p>` : ''}
          </div>
          `
              : `
          <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h2 style="color: #16a34a; font-size: 18px; margin-top: 0;">✅ No Recent Alerts</h2>
            <p style="margin: 0; color: #666;">All systems operating normally.</p>
          </div>
          `
          }

          <p style="color: #666; font-size: 14px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
            This is an automated report from PDX Camps scraper infrastructure.<br/>
            <a href="https://dashboard.convex.dev" style="color: #E5A33B;">View Convex Dashboard</a>
          </p>
        </div>
      `;

      const text = `
Daily Scraper Report - ${dateStr}

📈 LAST 24 HOURS
- Jobs Completed: ${stats.jobsCompleted}
- Jobs Failed: ${stats.jobsFailed}
- Sessions Found: ${stats.sessionsFound}
- Sessions Created: ${stats.sessionsCreated}
- Sessions Updated: ${stats.sessionsUpdated}

🔧 SYSTEM HEALTH
- Active Sources: ${metrics.sources.active}
- Healthy Scrapers: ${metrics.health.healthy}
- Degraded Scrapers: ${metrics.health.degraded}
- Failing Scrapers: ${metrics.health.failing}
- Sources Without Scraper: ${metrics.sources.withoutScraper}
- Dev Requests Pending: ${metrics.devRequests.pending}

${
  alerts.length > 0
    ? `⚠️ RECENT ALERTS (${alerts.length})
${alerts
  .slice(0, 5)
  .map((a: { message: string }) => `- ${a.message}`)
  .join('\n')}
${alerts.length > 5 ? `...and ${alerts.length - 5} more` : ''}`
    : '✅ No recent alerts - all systems operating normally.'
}

---
Automated report from PDX Camps scraper infrastructure.
      `;

      await resend.sendEmail(ctx, {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [REPORT_EMAIL],
        subject,
        html,
        text,
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send daily report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

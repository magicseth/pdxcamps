import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-primary hover:text-primary-dark text-sm mb-8 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Terms of Service</h1>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            <strong>Effective Date:</strong> February 3, 2025
            <br />
            <strong>Last Updated:</strong> February 3, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              By accessing or using PDX Camps ("the Service") at pdxcamps.com, you agree to be bound by these Terms of
              Service and our{' '}
              <Link href="/privacy" className="text-primary hover:text-primary-dark">
                Privacy Policy
              </Link>
              . If you do not agree to these terms, please do not use the Service.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              These terms apply to all visitors, users, and others who access the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">2. Description of Service</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              PDX Camps is a planning tool that helps families discover and organize summer camps for their children in
              the Portland, Oregon area. Our service includes:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Browsing and searching summer camp listings</li>
              <li>Creating a personalized summer schedule for your children</li>
              <li>Tracking which weeks are covered by camps</li>
              <li>Sharing your schedule with other families</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              <strong>Important:</strong> PDX Camps does not operate any camps. We aggregate publicly available
              information about summer camps for informational purposes only. You are responsible for verifying all camp
              details, availability, pricing, and registration directly with the camp providers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">3. User Accounts</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              To access certain features of the Service, you must create an account using Google Sign-In. By creating an
              account, you agree to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Not share your account with others</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You must be at least 18 years old to create an account. The Service is intended for parents and guardians
              to plan activities for their children.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">4. Subscription and Payments</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              PDX Camps offers both free and premium subscription options:
            </p>

            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">4.1 Free Tier</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Free accounts include limited access to planning features as described on our website.
            </p>

            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">4.2 Premium Subscriptions</h3>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Payments are processed securely through Stripe</li>
              <li>Monthly subscriptions renew automatically until canceled</li>
              <li>You may cancel your subscription at any time from your account settings</li>
              <li>Upon cancellation, you retain access until the end of your current billing period</li>
              <li>Summer Pass is a one-time payment for seasonal access (typically May through August)</li>
            </ul>

            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">4.3 Refunds</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Refund requests are handled on a case-by-case basis. To request a refund, contact us at{' '}
              <a href="mailto:support@pdxcamps.com" className="text-primary hover:text-primary-dark">
                support@pdxcamps.com
              </a>{' '}
              within 14 days of purchase.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">5. Acceptable Use</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You agree to use the Service only for lawful purposes. You may not:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the rights of others</li>
              <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
              <li>Use automated tools to scrape, copy, or redistribute our content</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Upload malicious code or content</li>
              <li>Impersonate any person or entity</li>
              <li>Use the Service for commercial purposes without our written consent</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">6. Intellectual Property</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              The Service and its original content (excluding user-provided content and third-party camp information)
              are owned by PDX Camps and are protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Camp listings include information from third-party camp providers. This information is used for
              informational purposes to help families plan their summer.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">7. User Content</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You retain ownership of content you create on the Service (such as your summer plans and child profiles).
              By using the Service, you grant us a limited license to store and display this content as necessary to
              provide the Service.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              When you share your plan with other users, you authorize us to display that content to those users.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
              IMPLIED. WE DO NOT WARRANT THAT:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Camp information is accurate, complete, or current</li>
              <li>Any specific camp or session will be available</li>
              <li>The Service will be uninterrupted or error-free</li>
              <li>Defects will be corrected</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              <strong>
                Always verify camp details, including dates, prices, ages, and availability, directly with the camp
                provider before registering.
              </strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">9. Limitation of Liability</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, PDX CAMPS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Loss of profits, data, or goodwill</li>
              <li>Service interruption or computer damage</li>
              <li>Any damages arising from camp registrations or attendance</li>
              <li>Reliance on information provided through the Service</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Our total liability shall not exceed the amount you paid us in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">10. Indemnification</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You agree to indemnify and hold harmless PDX Camps and its officers, directors, employees, and agents from
              any claims, damages, losses, or expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">11. Termination</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We may terminate or suspend your account at any time, with or without cause, with or without notice. You
              may delete your account at any time from your account settings.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Upon termination, your right to use the Service will immediately cease. Provisions of these Terms that by
              their nature should survive termination shall survive.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">12. Changes to Terms</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting
              the updated Terms on this page and updating the "Last Updated" date. Your continued use of the Service
              after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">13. Governing Law</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the State of Oregon, United
              States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">14. Dispute Resolution</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Any disputes arising from these Terms or the Service shall first be attempted to be resolved through
              good-faith negotiation. If resolution cannot be reached within 30 days, disputes shall be resolved through
              binding arbitration in Portland, Oregon.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">15. Contact Us</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              If you have questions about these Terms of Service, please contact us:
            </p>
            <ul className="list-none text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>
                <strong>Email:</strong>{' '}
                <a href="mailto:support@pdxcamps.com" className="text-primary hover:text-primary-dark">
                  support@pdxcamps.com
                </a>
              </li>
              <li>
                <strong>Website:</strong>{' '}
                <a href="https://pdxcamps.com" className="text-primary hover:text-primary-dark">
                  pdxcamps.com
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

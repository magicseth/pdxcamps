import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-primary hover:text-primary-dark text-sm mb-8 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Privacy Policy</h1>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            <strong>Effective Date:</strong> February 3, 2025
            <br />
            <strong>Last Updated:</strong> February 3, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">1. Introduction</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              PDX Camps ("we," "our," or "us") operates the PDX Camps website and service at pdxcamps.com. This Privacy
              Policy explains how we collect, use, disclose, and safeguard your information when you use our service. We
              are committed to protecting your privacy and handling your data in an open and transparent manner.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              By using PDX Camps, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">
              2.1 Information from Google Sign-In
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              When you sign in using Google, we receive and store the following information from your Google account:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>
                <strong>Email address:</strong> Used to identify your account and send important notifications
              </li>
              <li>
                <strong>Name:</strong> Used to personalize your experience
              </li>
              <li>
                <strong>Profile picture:</strong> Displayed in the app interface (optional)
              </li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We only request basic profile information. We do not request access to your Google contacts, calendar,
              drive, or any other Google services.
            </p>

            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">2.2 Information You Provide</h3>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>
                <strong>Family information:</strong> Children's first names and birth years (used to show
                age-appropriate camps)
              </li>
              <li>
                <strong>Camp preferences:</strong> Saved camps, registrations, and planning data
              </li>
              <li>
                <strong>Family events:</strong> Vacations or events you add to your planner
              </li>
            </ul>

            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">
              2.3 Information Collected Automatically
            </h3>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>
                <strong>Device information:</strong> Browser type, operating system
              </li>
              <li>
                <strong>Usage data:</strong> Pages visited, features used, time spent
              </li>
              <li>
                <strong>IP address:</strong> Used for security and general location (city-level)
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              3. How We Use Your Information
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>
                <strong>Provide our service:</strong> Create your account, save your plans, show relevant camps
              </li>
              <li>
                <strong>Personalize your experience:</strong> Show age-appropriate camps for your children
              </li>
              <li>
                <strong>Process payments:</strong> Handle subscription billing through Stripe
              </li>
              <li>
                <strong>Communicate with you:</strong> Send important account updates and respond to support requests
              </li>
              <li>
                <strong>Improve our service:</strong> Analyze usage patterns to enhance features
              </li>
              <li>
                <strong>Ensure security:</strong> Detect and prevent fraud or abuse
              </li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              <strong>We do not use your data for advertising purposes.</strong> We do not sell, rent, or share your
              personal information with advertisers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              4. How We Share Your Information
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              <strong>We do not sell your personal information.</strong> We may share information only in these limited
              circumstances:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>
                <strong>Service providers:</strong> We use trusted third-party services to operate PDX Camps:
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Convex (database hosting)</li>
                  <li>Stripe (payment processing)</li>
                  <li>WorkOS (authentication)</li>
                  <li>Vercel (website hosting)</li>
                </ul>
                These providers only access data necessary to perform their services and are contractually obligated to
                protect your information.
              </li>
              <li>
                <strong>With your consent:</strong> When you choose to share your summer plan with other families using
                our share feature
              </li>
              <li>
                <strong>Legal requirements:</strong> When required by law, court order, or to protect our rights
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">5. Data Security</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We implement appropriate technical and organizational measures to protect your personal data:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>All data is encrypted in transit using HTTPS/TLS</li>
              <li>Data is encrypted at rest in our database</li>
              <li>Authentication is handled by WorkOS, a security-focused identity provider</li>
              <li>Payment information is processed by Stripe and never stored on our servers</li>
              <li>We conduct regular security reviews of our systems</li>
              <li>Access to personal data is limited to authorized personnel only</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              6. Data Retention and Deletion
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We retain your personal data only as long as necessary to provide our services:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>
                <strong>Active accounts:</strong> Data is retained while your account is active
              </li>
              <li>
                <strong>Deleted accounts:</strong> Personal data is deleted within 30 days of account deletion
              </li>
              <li>
                <strong>Payment records:</strong> Retained as required by law for tax and accounting purposes
              </li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              <strong>You can delete your account at any time</strong> from your account settings page. Upon deletion,
              we will remove your personal data from our systems, except where retention is required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">7. Your Rights and Choices</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You have the following rights regarding your personal data:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>
                <strong>Access:</strong> Request a copy of your personal data
              </li>
              <li>
                <strong>Correction:</strong> Update or correct inaccurate information
              </li>
              <li>
                <strong>Deletion:</strong> Delete your account and associated data
              </li>
              <li>
                <strong>Export:</strong> Download your data in a portable format
              </li>
              <li>
                <strong>Revoke access:</strong> Disconnect Google sign-in from your Google account settings
              </li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              To exercise these rights, contact us at{' '}
              <a href="mailto:privacy@pdxcamps.com" className="text-primary hover:text-primary-dark">
                privacy@pdxcamps.com
              </a>{' '}
              or use the options in your account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">8. Children's Privacy</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              PDX Camps is designed for parents and guardians to plan summer activities for their children. We do not
              knowingly collect information directly from children under 13. The children's information we store (first
              names and birth years) is provided by parents/guardians for the purpose of showing age-appropriate camp
              recommendations.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              If you believe we have inadvertently collected information from a child under 13, please contact us
              immediately at{' '}
              <a href="mailto:privacy@pdxcamps.com" className="text-primary hover:text-primary-dark">
                privacy@pdxcamps.com
              </a>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">9. Cookies and Tracking</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">We use essential cookies to:</p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Keep you signed in to your account</li>
              <li>Remember your preferences</li>
              <li>Ensure security of your session</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We may use analytics to understand how our service is used. You can control cookies through your browser
              settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              10. Google API Services Disclosure
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              PDX Camps' use and transfer of information received from Google APIs adheres to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-dark"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-4">Specifically, we:</p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Only use Google user data to provide and improve user-facing features of PDX Camps</li>
              <li>Do not transfer Google user data to third parties except as necessary to provide our service</li>
              <li>Do not use Google user data for advertising</li>
              <li>Do not sell Google user data</li>
              <li>Allow users to revoke access at any time through Google account settings</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              11. International Data Transfers
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Your data may be processed on servers located in the United States. If you are located outside the United
              States, your information will be transferred to, stored, and processed in the United States where our
              servers are located.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">12. Changes to This Policy</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Posting the updated policy on this page</li>
              <li>Updating the "Last Updated" date</li>
              <li>Sending an email notification for significant changes</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">13. Contact Us</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <ul className="list-none text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>
                <strong>Email:</strong>{' '}
                <a href="mailto:privacy@pdxcamps.com" className="text-primary hover:text-primary-dark">
                  privacy@pdxcamps.com
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

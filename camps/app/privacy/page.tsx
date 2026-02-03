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

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
          Privacy Policy
        </h1>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Last updated: February 2025
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              1. Introduction
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              PDX Camps ("we," "our," or "us") respects your privacy and is committed to protecting your personal data.
              This Privacy Policy explains how we collect, use, and safeguard your information when you use our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              2. Information We Collect
            </h2>

            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">
              Information you provide:
            </h3>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Account information (email address, name)</li>
              <li>Family information (children's first names, ages)</li>
              <li>Camp preferences and saved plans</li>
              <li>Payment information (processed securely by Stripe)</li>
            </ul>

            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">
              Information collected automatically:
            </h3>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Device and browser information</li>
              <li>IP address and general location</li>
              <li>Usage data (pages visited, features used)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              3. How We Use Your Information
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We use your information to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Provide and improve our Service</li>
              <li>Create and manage your account</li>
              <li>Process payments and subscriptions</li>
              <li>Send important updates about your account or the Service</li>
              <li>Respond to your questions and support requests</li>
              <li>Analyze usage to improve our features</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              4. Information Sharing
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We do not sell your personal information. We may share information with:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li><strong>Service providers:</strong> Companies that help us operate (e.g., Stripe for payments, Convex for data storage)</li>
              <li><strong>Legal requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>With your consent:</strong> When you choose to share your plan with other families</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              5. Data Security
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We implement appropriate security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication through WorkOS</li>
              <li>Regular security reviews</li>
              <li>Limited employee access to personal data</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              6. Children's Privacy
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Our Service is designed for parents and guardians to plan activities for their children.
              We only collect children's first names and ages as provided by parents. We do not knowingly
              collect information directly from children under 13.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              7. Your Rights
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and associated data</li>
              <li>Export your data</li>
              <li>Opt out of marketing communications</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              To exercise these rights, contact us at{' '}
              <a href="mailto:privacy@pdxcamps.com" className="text-primary hover:text-primary-dark">
                privacy@pdxcamps.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              8. Cookies
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We use essential cookies to keep you logged in and remember your preferences.
              We may use analytics cookies to understand how you use our Service.
              You can control cookies through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              9. Changes to This Policy
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of material changes
              by posting the updated policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              10. Contact Us
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              If you have questions about this Privacy Policy or our data practices, please contact us at{' '}
              <a href="mailto:privacy@pdxcamps.com" className="text-primary hover:text-primary-dark">
                privacy@pdxcamps.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

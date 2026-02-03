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

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
          Terms of Service
        </h1>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Last updated: February 2025
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              By accessing and using PDX Camps ("the Service"), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              2. Description of Service
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              PDX Camps is a planning tool that helps families discover and organize summer camps for their children.
              We aggregate publicly available information about summer camps in the Portland area and provide tools
              to help you plan your summer schedule.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We do not operate any camps ourselves. All camp information is provided for informational purposes only.
              You are responsible for verifying camp details, availability, and registration directly with camp providers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              3. User Accounts
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              To use certain features of the Service, you must create an account. You are responsible for:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate and complete information</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              4. Subscription and Payments
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              PDX Camps offers both free and premium subscription tiers. Premium features require payment.
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Payments are processed securely through Stripe</li>
              <li>Monthly subscriptions can be canceled anytime; access continues until the end of the billing period</li>
              <li>Summer Pass is a one-time payment for seasonal access</li>
              <li>Refunds are handled on a case-by-case basis; contact us at support@pdxcamps.com</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              5. Acceptable Use
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Scrape, copy, or redistribute our content without permission</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Impersonate any person or entity</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              6. Disclaimer of Warranties
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              The Service is provided "as is" without warranties of any kind. We do not guarantee:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 mb-4 space-y-2">
              <li>The accuracy, completeness, or timeliness of camp information</li>
              <li>Availability of any specific camp or session</li>
              <li>Uninterrupted or error-free operation of the Service</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Always verify camp details directly with the camp provider before registering.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              7. Limitation of Liability
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              To the maximum extent permitted by law, PDX Camps shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages arising from your use of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              8. Changes to Terms
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We may update these Terms from time to time. We will notify you of material changes by posting
              the new Terms on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              9. Contact Us
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              If you have questions about these Terms, please contact us at{' '}
              <a href="mailto:support@pdxcamps.com" className="text-primary hover:text-primary-dark">
                support@pdxcamps.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import Link from 'next/link';
import { api } from '../../convex/_generated/api';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export function PartnerLandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            PDX Camps
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </a>
            <a
              href="/sign-up"
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
            >
              Get Started Free
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-surface/30 via-white to-accent/10" />
          <div className="absolute top-20 right-0 w-96 h-96 bg-surface/40 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />

          <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent-dark rounded-full text-sm font-medium mb-6 border border-accent/30">
              Revenue-Share Partnership
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Earn money for your PTA
              <br />
              <span className="text-primary">by helping families plan summer camp.</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Share PDX Camps with your school community and earn 20% of every premium signup. No cap, no catch — the more families you help, the more your PTA earns.
            </p>
            <a
              href="#signup"
              className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold bg-accent text-white rounded-xl hover:bg-accent-dark shadow-lg shadow-accent/25 transition-all hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
            >
              Apply to Partner
              <span className="inline-block ml-1">→</span>
            </a>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How it works</h2>
              <p className="text-xl text-slate-600">Three steps to start earning for your PTA.</p>
            </div>

            <div className="space-y-12">
              <StepCard
                number={1}
                title="Sign up as a partner"
                description="Fill out the form below. We'll set you up with a unique referral link for your school community within 24 hours."
              />
              <StepCard
                number={2}
                title="Share your link with families"
                description="Put it in your PTA newsletter, school Facebook group, or parent email list. Families sign up and get a free camp planning tool."
              />
              <StepCard
                number={3}
                title="Earn 20% of every premium signup"
                description="When families from your community upgrade to Premium, you earn 20% of every payment — for the lifetime of their subscription."
              />
            </div>
          </div>
        </section>

        {/* The Math */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Do the math</h2>
              <p className="text-xl text-slate-600">Real numbers for a typical school community.</p>
            </div>

            <div className="bg-gradient-to-br from-primary via-primary-dark to-surface-dark rounded-2xl p-8 md:p-12 text-white">
              <div className="grid md:grid-cols-4 gap-6 text-center mb-8">
                <MathStep label="Families in your school" value="200" />
                <MathStep label="Click your link" value="10%" />
                <MathStep label="Upgrade to Premium" value="20%" />
                <MathStep label="Your 20% share" value="$160+" highlight />
              </div>
              <div className="text-center text-white/70 text-sm">
                Based on Premium at $19.99/year. Actual earnings vary. No cap on referrals.
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="bg-surface/15 rounded-2xl p-6 border border-surface/30 text-center">
                <div className="text-3xl font-bold text-primary mb-1">$0</div>
                <div className="text-slate-600">Cost to you</div>
              </div>
              <div className="bg-surface/15 rounded-2xl p-6 border border-surface/30 text-center">
                <div className="text-3xl font-bold text-primary mb-1">Lifetime</div>
                <div className="text-slate-600">Recurring commission</div>
              </div>
              <div className="bg-surface/15 rounded-2xl p-6 border border-surface/30 text-center">
                <div className="text-3xl font-bold text-primary mb-1">No cap</div>
                <div className="text-slate-600">On referrals or earnings</div>
              </div>
            </div>
          </div>
        </section>

        {/* What Families Get */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">What families in your community get</h2>
              <p className="text-xl text-slate-600">PDX Camps helps parents plan an amazing summer — for free.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <FeatureCard
                icon="🔍"
                title="Browse 100+ camps"
                description="Every summer camp in Portland, searchable by age, location, dates, and price."
              />
              <FeatureCard
                icon="📅"
                title="Week-by-week planner"
                description="Visual calendar showing the whole summer. See gaps, overlap, and coverage at a glance."
              />
              <FeatureCard
                icon="👨‍👩‍👧‍👦"
                title="Plan for all kids"
                description="Different ages, different interests? Plan for every child side by side."
              />
              <FeatureCard
                icon="👯"
                title="Coordinate with friends"
                description="See which camps friends are attending. Great for carpools and social comfort."
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Frequently asked questions</h2>
            </div>

            <div className="space-y-4">
              <FAQItem
                question="How do we get paid?"
                answer="We pay out via PayPal or check quarterly. You'll get a partner dashboard showing clicks, signups, and earnings in real time."
              />
              <FAQItem
                question="What does Premium cost families?"
                answer="Premium starts at $4.99 for a one-month pass and $19.99 for the full summer. The free plan is generous — families only upgrade if they find real value in the full planner features."
              />
              <FAQItem
                question="Is there a cap on what we can earn?"
                answer="No cap. The more families you refer, the more you earn. A PTA at a large school could easily earn $500+ per year."
              />
              <FAQItem
                question="What if a family cancels?"
                answer="You earn commission on completed payments. If a family gets a refund within our refund window, that commission is adjusted. Renewals keep earning."
              />
              <FAQItem
                question="Can other types of organizations partner?"
                answer="Absolutely! We work with PTAs, schools, nonprofits, parenting groups, daycares, and community organizations. If you serve families, we'd love to work with you."
              />
              <FAQItem
                question="Do families know we earn a commission?"
                answer="Your link is a standard referral link. Families get the same pricing regardless — there's no markup. You're simply helping them discover a useful tool."
              />
            </div>
          </div>
        </section>

        {/* Signup Form */}
        <section id="signup" className="py-20 px-4 bg-gradient-to-br from-primary via-primary-dark to-surface-dark">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Apply to partner</h2>
              <p className="text-xl text-white/80">
                Fill out the form below and we'll get you set up within 24 hours.
              </p>
            </div>
            <PartnerSignupForm />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-sm text-slate-500">PDX Camps — For Portland parents</p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <a href="/sign-in" className="hover:text-white transition-colors">
                Sign In
              </a>
              <a href="/terms" className="hover:text-white transition-colors">
                Terms
              </a>
              <a href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </a>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} PDX Camps. Made with ☀️ by parents for Portland.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// PARTNER PAGE COMPONENTS
// ============================================================================

function PartnerSignupForm() {
  const [formData, setFormData] = useState({
    organizationName: '',
    contactName: '',
    email: '',
    organizationType: '',
    message: '',
  });
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const submitApplication = useMutation(api.partners.mutations.submitPartnerApplication);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.organizationName.trim() || !formData.contactName.trim() || !formData.email.trim() || !formData.organizationType) return;

    setStatus('submitting');
    setErrorMessage('');

    try {
      const result = await submitApplication({
        organizationName: formData.organizationName.trim(),
        contactName: formData.contactName.trim(),
        email: formData.email.trim(),
        organizationType: formData.organizationType,
        message: formData.message.trim() || undefined,
      });

      if (result.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Something went wrong');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Application received!</h3>
        <p className="text-slate-600">
          We'll review your application and get back to you within 24 hours with your partner link and dashboard access.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-xl space-y-5">
      <div>
        <label htmlFor="orgName" className="block text-sm font-medium text-slate-700 mb-1">
          Organization name
        </label>
        <input
          id="orgName"
          type="text"
          required
          value={formData.organizationName}
          onChange={(e) => setFormData((prev) => ({ ...prev, organizationName: e.target.value }))}
          placeholder="Lincoln High School PTA"
          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="contactName" className="block text-sm font-medium text-slate-700 mb-1">
          Your name
        </label>
        <input
          id="contactName"
          type="text"
          required
          value={formData.contactName}
          onChange={(e) => setFormData((prev) => ({ ...prev, contactName: e.target.value }))}
          placeholder="Jane Smith"
          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="jane@lincolnpta.org"
          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="orgType" className="block text-sm font-medium text-slate-700 mb-1">
          Organization type
        </label>
        <select
          id="orgType"
          required
          value={formData.organizationType}
          onChange={(e) => setFormData((prev) => ({ ...prev, organizationType: e.target.value }))}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="">Select type...</option>
          <option value="PTA">PTA / PTO</option>
          <option value="school">School</option>
          <option value="nonprofit">Nonprofit</option>
          <option value="daycare">Daycare / Preschool</option>
          <option value="community">Community Group</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
          Anything else? <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="message"
          value={formData.message}
          onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
          rows={3}
          placeholder="Tell us about your community, how many families you reach, etc."
          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
        />
      </div>

      {status === 'error' && (
        <p className="text-red-600 text-sm">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full py-3 px-6 text-lg font-semibold bg-accent text-white rounded-xl hover:bg-accent-dark disabled:opacity-50 transition-colors shadow-lg shadow-accent/25"
      >
        {status === 'submitting' ? 'Submitting...' : 'Submit Application'}
      </button>

      <p className="text-xs text-slate-400 text-center">
        We'll review your application and respond within 24 hours.
      </p>
    </form>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl">
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-xl text-slate-900 mb-1">{title}</h3>
        <p className="text-slate-600 text-lg">{description}</p>
      </div>
    </div>
  );
}

function MathStep({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className={`text-3xl md:text-4xl font-bold mb-1 ${highlight ? 'text-accent' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-white/70 text-sm">{label}</div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-primary/30 hover:shadow-lg transition-all">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="font-semibold text-lg text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const id = question.replace(/\s+/g, '-').toLowerCase().slice(0, 30);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`faq-${id}`}
        className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
      >
        <span className="font-medium text-slate-900">{question}</span>
        <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {isOpen && (
        <div id={`faq-${id}`} role="region" aria-label={question} className="px-6 pb-4 text-slate-600">
          {answer}
        </div>
      )}
    </div>
  );
}

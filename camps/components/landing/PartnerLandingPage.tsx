'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { api } from '../../convex/_generated/api';
import { useMarket } from '../../hooks/useMarket';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export function PartnerLandingPage() {
  const market = useMarket();
  const landingStats = useQuery(api.sessions.queries.getLandingStats, {
    citySlug: market.slug,
  });

  const orgCount = landingStats?.orgCount ?? 100;
  const familyCount = landingStats?.familyCount ?? 0;
  const sessionCount = landingStats?.sessionCount ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            {market.tagline}
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/partner/dashboard"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Partner Login
            </Link>
            <a
              href="#signup"
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"
            >
              Apply Now
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-white to-primary/5" />
          <div className="absolute top-20 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

          <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium mb-6 border border-green-200">
              Earn 20% commission — paid quarterly
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Your PTA can earn <span className="text-accent">$500+</span>
              <br />
              helping families plan summer camp.
            </h1>
            <p className="text-xl text-slate-600 mb-4 max-w-2xl mx-auto leading-relaxed">
              Share {market.tagline} with your school community. When families sign up and go Premium,
              your PTA earns 20% of every payment. Zero cost, zero effort after setup.
            </p>
            {familyCount > 50 && (
              <p className="text-sm text-slate-500 mb-8">
                Join {familyCount.toLocaleString()}+ families already using {market.tagline}
              </p>
            )}
            <a
              href="#signup"
              className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold bg-accent text-white rounded-xl hover:bg-accent-dark shadow-lg shadow-accent/25 transition-all hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
            >
              Apply in 60 Seconds
            </a>
            <div className="mt-4">
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 text-lg font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="py-8 px-4 border-y border-slate-100 bg-slate-50/50">
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-2xl md:text-3xl font-bold text-primary">{orgCount}+</div>
              <div className="text-sm text-slate-500">Camp providers listed</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-primary">{sessionCount > 0 ? `${sessionCount.toLocaleString()}+` : '1,000+'}</div>
              <div className="text-sm text-slate-500">Sessions this summer</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-primary">100% free</div>
              <div className="text-sm text-slate-500">For families to start</div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Set up once, earn all summer</h2>
              <p className="text-xl text-slate-600">Takes about 5 minutes total.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-accent">1</span>
                </div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">Apply below</h3>
                <p className="text-slate-600">Fill out the form — we&apos;ll send your unique referral link within 24 hours.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-accent">2</span>
                </div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">Drop your link</h3>
                <p className="text-slate-600">Add it to your next PTA newsletter, Facebook group post, or parent email blast. One time.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-accent">3</span>
                </div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">Watch it grow</h3>
                <p className="text-slate-600">Track signups and earnings in your partner dashboard. We pay out quarterly via PayPal or check.</p>
              </div>
            </div>

            <div className="text-center mt-12">
              <a
                href="#signup"
                className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold bg-accent text-white rounded-xl hover:bg-accent-dark shadow-md transition-all"
              >
                Get Your Link
              </a>
            </div>
          </div>
        </section>

        {/* The Math — made concrete */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Real money, real fast</h2>
              <p className="text-xl text-slate-600">Here&apos;s what a typical school partnership looks like.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="grid md:grid-cols-2">
                {/* Small school */}
                <div className="p-8 md:border-r border-slate-200">
                  <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Small School (300 families)</div>
                  <div className="space-y-3 mb-6">
                    <EarningsRow label="Families that click your link" value="60" detail="20% click rate" />
                    <EarningsRow label="Sign up (free)" value="45" detail="75% signup rate" />
                    <EarningsRow label="Upgrade to Premium" value="7" detail="15% convert" />
                    <div className="border-t border-slate-200 pt-3">
                      <EarningsRow label="You earn (year 1)" value="$40+" detail="20% of $29/yr" highlight />
                    </div>
                  </div>
                </div>
                {/* Large school */}
                <div className="p-8 bg-accent/5">
                  <div className="text-sm font-medium text-accent-dark uppercase tracking-wider mb-2">Large School (800 families)</div>
                  <div className="space-y-3 mb-6">
                    <EarningsRow label="Families that click your link" value="160" detail="20% click rate" />
                    <EarningsRow label="Sign up (free)" value="120" detail="75% signup rate" />
                    <EarningsRow label="Upgrade to Premium" value="18" detail="15% convert" />
                    <div className="border-t border-slate-200 pt-3">
                      <EarningsRow label="You earn (year 1)" value="$104+" detail="20% of $29/yr" highlight />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center">
                <div className="text-3xl font-bold text-primary mb-1">$0</div>
                <div className="text-slate-600">Cost to your PTA</div>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center">
                <div className="text-3xl font-bold text-primary mb-1">Recurring</div>
                <div className="text-slate-600">Earn on every renewal</div>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center">
                <div className="text-3xl font-bold text-primary mb-1">No cap</div>
                <div className="text-slate-600">On referrals or earnings</div>
              </div>
            </div>

            <p className="text-center text-sm text-slate-400 mt-6">
              Based on Premium at $29/year. Actual earnings vary based on your community size and engagement.
            </p>
          </div>
        </section>

        {/* What parents get — make them want to share it */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-4">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Parents will thank you</h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                You&apos;re not selling anything — you&apos;re sharing a genuinely useful free tool
                that makes summer planning less stressful.
              </p>
            </div>

            <div className="mt-12 grid md:grid-cols-2 gap-6">
              <FeatureCard
                title="Every camp in one place"
                description={`${orgCount}+ camp providers with dates, prices, ages, and locations — searchable and filterable.`}
              />
              <FeatureCard
                title="Week-by-week summer planner"
                description="Visual calendar for each child. Parents see gaps instantly and fill them before camps sell out."
              />
              <FeatureCard
                title="Coordinate with school friends"
                description="Parents can share calendars and see which camps their kids' friends are attending. Great for carpools."
              />
              <FeatureCard
                title="Never miss a deadline"
                description="Price alerts, availability tracking, and registration reminders so families don't miss popular camps."
              />
            </div>

            <div className="mt-12 bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl p-8 border border-primary/10">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0 text-5xl">💬</div>
                <div>
                  <p className="text-lg text-slate-700 italic mb-2">
                    &ldquo;I spent hours every spring googling camps and making spreadsheets.
                    This does all of that in minutes. I wish I&apos;d had it years ago.&rdquo;
                  </p>
                  <p className="text-sm text-slate-500">— {market.name} parent of 2</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Objection handling */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Common questions</h2>
            </div>

            <div className="space-y-4">
              <FAQItem
                question="Is this really free for families?"
                answer={`Yes! Families can browse all ${orgCount}+ camp providers, save up to 5 camps, and use the planner completely free. Premium unlocks unlimited saves, friend coordination, and alerts — but the free plan is genuinely useful on its own.`}
              />
              <FAQItem
                question="How and when do we get paid?"
                answer="We pay out quarterly via PayPal or check. You also get a real-time partner dashboard showing every signup and commission as it happens."
              />
              <FAQItem
                question="What does Premium cost?"
                answer="Premium is $29/year for the Summer Pass or $4.99/month. Your PTA earns 20% of every payment for the first year after a family signs up through your link."
              />
              <FAQItem
                question="What if families sign up but don't upgrade?"
                answer="That's totally fine — they still get a useful free tool, and your school community benefits. You only earn commission on Premium upgrades, but families appreciate the recommendation either way."
              />
              <FAQItem
                question="How much effort is this?"
                answer="Almost none. Apply here, get your link, share it once in your PTA newsletter or Facebook group. That's it. The tool sells itself — parents need to plan summer camp regardless."
              />
              <FAQItem
                question="Can other organizations partner?"
                answer="Absolutely. We work with PTAs, schools, daycares, nonprofits, parenting groups, and community organizations. If you serve families, we'd love to work with you."
              />
              <FAQItem
                question="Do families know we earn a commission?"
                answer="Your link is a standard referral link. Families get the exact same pricing — there's no markup. You're simply helping them discover a useful tool."
              />
            </div>
          </div>
        </section>

        {/* Final CTA + Form */}
        <section id="signup" className="py-20 px-4 bg-gradient-to-br from-accent via-accent-dark to-primary-dark">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Start earning for your PTA</h2>
              <p className="text-xl text-white/80">
                Apply below — we&apos;ll send your partner link within 24 hours.
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
            <p className="text-sm text-slate-500">{market.tagline} — For {market.name} families</p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/partner/dashboard" className="hover:text-white transition-colors">
                Partner Dashboard
              </Link>
              <a href="/terms" className="hover:text-white transition-colors">
                Terms
              </a>
              <a href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </a>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} {market.tagline}. Made in {market.madeIn}.</p>
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
        <h3 className="text-2xl font-bold text-slate-900 mb-2">You&apos;re in!</h3>
        <p className="text-slate-600">
          We&apos;ll review your application and send your partner link and dashboard access within 24 hours.
          Check your email at <span className="font-medium text-slate-900">{formData.email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-xl space-y-5">
      <div className="grid sm:grid-cols-2 gap-5">
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
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-accent focus:border-transparent"
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
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-accent focus:border-transparent"
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
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
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
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-accent focus:border-transparent"
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
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
          How many families does your community reach? <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="message"
          value={formData.message}
          onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
          rows={2}
          placeholder="e.g. Our PTA serves 400 families at Lincoln Elementary"
          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
        />
      </div>

      {status === 'error' && (
        <p className="text-red-600 text-sm">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full py-3.5 px-6 text-lg font-semibold bg-accent text-white rounded-xl hover:bg-accent-dark disabled:opacity-50 transition-colors shadow-lg shadow-accent/25"
      >
        {status === 'submitting' ? 'Submitting...' : 'Submit Application'}
      </button>

      <p className="text-xs text-slate-400 text-center">
        No commitment. We&apos;ll respond within 24 hours.
      </p>
    </form>
  );
}

function EarningsRow({ label, value, detail, highlight }: { label: string; value: string; detail: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${highlight ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${highlight ? 'text-accent text-base' : 'text-slate-900'}`}>{value}</span>
        <span className="text-xs text-slate-400 ml-1.5">{detail}</span>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-primary/30 hover:shadow-lg transition-all">
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

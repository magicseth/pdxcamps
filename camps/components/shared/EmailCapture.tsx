'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import posthog from 'posthog-js';

interface EmailCaptureProps {
  source: string;
  citySlug: string;
  cityName?: string;
}

export function EmailCapture({ source, citySlug, cityName }: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const captureEmail = useMutation(api.leads.mutations.captureEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('submitting');
    setErrorMessage('');

    try {
      const result = await captureEmail({
        email: email.trim(),
        citySlug,
        source,
      });

      if (result.success) {
        posthog.capture('email_captured', {
          source,
          city_slug: citySlug,
        });
        setStatus('success');
        setEmail('');
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
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
        <p className="text-green-800 dark:text-green-300 font-medium text-lg">
          You're on the list!
        </p>
        <p className="text-green-600 dark:text-green-400 text-sm mt-1">
          We'll send you weekly camp updates for {cityName || 'your area'}.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
        Get weekly camp updates{cityName ? ` for ${cityName}` : ''}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        New sessions, price drops, and spots opening up — delivered to your inbox.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {status === 'submitting' ? 'Joining...' : 'Sign Up'}
        </button>
      </form>
      {status === 'error' && (
        <p className="text-red-600 dark:text-red-400 text-sm mt-2">{errorMessage}</p>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
        No spam, unsubscribe anytime.
      </p>
    </div>
  );
}

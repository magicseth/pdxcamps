'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import posthog from 'posthog-js';

interface AddChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddChildModal({ isOpen, onClose, onSuccess }: AddChildModalProps) {
  const [firstName, setFirstName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addChild = useMutation(api.children.mutations.addChild);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 18 }, (_, i) => currentYear - i);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError('Please enter a name');
      return;
    }

    if (!birthYear) {
      setError('Please select a birth year');
      return;
    }

    setIsSubmitting(true);

    try {
      // Use July 1st as a default date for the birth year
      const birthdate = `${birthYear}-07-01`;

      await addChild({
        firstName: firstName.trim(),
        birthdate,
        interests: [],
      });

      // Track child added event
      const childAge = currentYear - parseInt(birthYear);
      posthog.capture('child_added', {
        child_age: childAge,
        source: 'add_child_modal',
      });

      // Reset form
      setFirstName('');
      setBirthYear('');

      onSuccess?.();
      onClose();
    } catch (err) {
      posthog.captureException(err);
      setError(err instanceof Error ? err.message : 'Failed to add child');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-3">👶</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add a Child</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Add another child to your summer planner</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              First Name
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter name"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="birthYear" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Birth Year
            </label>
            <select
              id="birthYear"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Select year</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year} ({currentYear - year} years old)
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Adding...' : 'Add Child'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

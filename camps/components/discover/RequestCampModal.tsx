'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { api } from '../../convex/_generated/api';
import { useMarket } from '../../hooks/useMarket';
import posthog from 'posthog-js';

interface RequestCampModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RequestCampModal({ isOpen, onClose }: RequestCampModalProps) {
  const router = useRouter();
  const market = useMarket();
  const [campName, setCampName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const submitRequest = useMutation(api.campRequests.mutations.submitCampRequest);
  const myRequests = useQuery(api.campRequests.queries.listMyRequests);

  // Autocomplete query - only search when we have 2+ characters
  const suggestions = useQuery(
    api.camps.queries.autocompleteCamps,
    campName.length >= 2 ? { query: campName, citySlug: market.slug, limit: 5 } : 'skip',
  );

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || !suggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleSelectSuggestion = (camp: { _id: string; name: string; slug: string; organizationSlug?: string }) => {
    // Navigate to the camp's sessions in discover
    handleClose();
    router.push(`/discover/${market.slug}?search=${encodeURIComponent(camp.name)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!campName.trim()) {
      setError('Please enter the camp name');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitRequest({
        campName: campName.trim(),
        organizationName: organizationName.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (result.status === 'duplicate') {
        setError('Great news! This camp is already in our database. Try searching for it!');
      } else {
        // Track camp request submission
        posthog.capture('camp_request_submitted', {
          has_website_url: !!websiteUrl.trim(),
          has_organization: !!organizationName.trim(),
          has_location: !!location.trim(),
          has_notes: !!notes.trim(),
          market: market.slug,
        });
        setSubmitted(true);
      }
    } catch (err) {
      posthog.captureException(err);
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCampName('');
    setOrganizationName('');
    setWebsiteUrl('');
    setLocation('');
    setNotes('');
    setSubmitted(false);
    setError(null);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Request a Camp</h2>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4" aria-hidden="true">🎉</div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Request Submitted!</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                We'll add this camp to our database and notify you when it's available. This usually takes 1-2 business
                days.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Can't find a camp? Tell us about it and we'll add it to our database. The more info you provide, the
                faster we can add it!
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Camp Name with Autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Camp Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={campName}
                    onChange={(e) => {
                      setCampName(e.target.value);
                      setShowSuggestions(true);
                      setSelectedIndex(-1);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Start typing to search or add a camp..."
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                    autoComplete="off"
                  />

                  {/* Autocomplete suggestions */}
                  {showSuggestions && suggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden"
                    >
                      <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600">
                        Existing camps in {market.name}
                      </div>
                      {suggestions.map((camp, index) => (
                        <button
                          key={camp._id}
                          type="button"
                          onClick={() => handleSelectSuggestion(camp)}
                          className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center justify-between ${
                            index === selectedIndex ? 'bg-slate-50 dark:bg-slate-600' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">{camp.name}</div>
                            {camp.organizationName && (
                              <div className="text-sm text-slate-500 dark:text-slate-400">{camp.organizationName}</div>
                            )}
                          </div>
                          <span className="text-xs text-primary">View sessions</span>
                        </button>
                      ))}
                      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-600">
                        Not finding it? Fill out the form below to request it.
                      </div>
                    </div>
                  )}
                </div>

                {/* Organization Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g., Portland Parks & Recreation"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Website URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Website URL
                    <span className="text-slate-400 font-normal ml-1">(helps us find it faster!)</span>
                  </label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Southeast Portland"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Anything else we should know?
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., It's a week-long art camp in July..."
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !campName.trim()}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </button>
                </div>
              </form>

              {/* Previous Requests */}
              {myRequests && myRequests.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Your Previous Requests
                  </h3>
                  <div className="space-y-2">
                    {myRequests.slice(0, 5).map((request) => (
                      <div
                        key={request._id}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm"
                      >
                        <span className="text-slate-900 dark:text-white font-medium">{request.campName}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            request.status === 'completed'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : request.status === 'failed'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : request.status === 'duplicate'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}
                        >
                          {request.status === 'completed'
                            ? 'Added'
                            : request.status === 'failed'
                              ? 'Failed'
                              : request.status === 'duplicate'
                                ? 'Already exists'
                                : 'Processing...'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

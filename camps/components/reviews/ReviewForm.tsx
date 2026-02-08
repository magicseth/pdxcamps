'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import posthog from 'posthog-js';
import { InteractiveStarRating } from './StarRating';

export function ReviewForm({
  campId,
  onSuccess,
  onCancel,
}: {
  campId: Id<'camps'>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [yearAttended, setYearAttended] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitReview = useMutation(api.reviews.mutations.submitReview);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      await submitReview({
        campId,
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        yearAttended: yearAttended || undefined,
      });
      posthog.capture('review_submitted', {
        camp_id: campId,
        rating,
        has_title: !!title.trim(),
        has_body: !!body.trim(),
        year_attended: yearAttended || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">Write a Review</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rating *
        </label>
        <InteractiveStarRating rating={rating} onRate={setRating} />
      </div>

      <div>
        <label htmlFor="review-title" className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
          maxLength={100}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="review-body" className="block text-sm font-medium text-gray-700 mb-1">
          Review
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell other families about your experience..."
          rows={3}
          maxLength={2000}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>

      <div>
        <label htmlFor="review-year" className="block text-sm font-medium text-gray-700 mb-1">
          Year Attended
        </label>
        <select
          id="review-year"
          value={yearAttended}
          onChange={(e) => setYearAttended(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select year</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || rating === 0}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { StarRating } from './StarRating';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';

export function CampReviews({
  campId,
  isAuthenticated,
}: {
  campId: Id<'camps'>;
  isAuthenticated: boolean;
}) {
  const [showForm, setShowForm] = useState(false);

  const reviews = useQuery(api.reviews.queries.getReviewsForCamp, { campId });
  const summary = useQuery(api.reviews.queries.getCampRatingSummary, { campId });

  if (reviews === undefined || summary === undefined) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 bg-gray-200 rounded w-40" />
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Reviews</h3>
          {summary.reviewCount > 0 && (
            <div className="flex items-center gap-2">
              <StarRating rating={summary.averageRating} size="sm" />
              <span className="text-sm text-gray-600">
                {summary.averageRating} ({summary.reviewCount} review{summary.reviewCount !== 1 ? 's' : ''})
              </span>
            </div>
          )}
        </div>
        {isAuthenticated && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
          >
            Write a Review
          </button>
        )}
      </div>

      {showForm && (
        <ReviewForm
          campId={campId}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {reviews.length === 0 && !showForm ? (
        <p className="text-sm text-gray-500 py-4">
          No reviews yet.{' '}
          {isAuthenticated ? (
            <button
              onClick={() => setShowForm(true)}
              className="text-blue-600 hover:underline"
            >
              Be the first to review!
            </button>
          ) : (
            'Sign in to leave a review.'
          )}
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review._id}
              reviewerName={review.reviewerName}
              rating={review.rating}
              title={review.title}
              body={review.body}
              yearAttended={review.yearAttended}
              isVerified={review.isVerified}
              createdAt={review.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}

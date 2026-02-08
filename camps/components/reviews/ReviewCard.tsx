'use client';

import { StarRating } from './StarRating';
import { CheckIcon } from '../shared/icons';

interface ReviewCardProps {
  reviewerName: string;
  rating: number;
  title?: string;
  body?: string;
  yearAttended?: number;
  isVerified: boolean;
  createdAt: number;
}

export function ReviewCard({
  reviewerName,
  rating,
  title,
  body,
  yearAttended,
  isVerified,
  createdAt,
}: ReviewCardProps) {
  const date = new Date(createdAt);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <StarRating rating={rating} size="sm" />
            {isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckIcon className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
          {title && (
            <h4 className="font-semibold text-gray-900 mt-1">{title}</h4>
          )}
        </div>
      </div>

      {body && <p className="text-gray-700 text-sm mt-2">{body}</p>}

      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        <span>{reviewerName}</span>
        <span>{dateStr}</span>
        {yearAttended && <span>Attended {yearAttended}</span>}
      </div>
    </div>
  );
}

'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import Link from 'next/link';

interface FeaturedCarouselProps {
  cityId: string;
}

export function FeaturedCarousel({ cityId }: FeaturedCarouselProps) {
  const featured = useQuery(api.featured.queries.getActiveFeaturedCamps, {
    cityId: cityId as any,
  });

  if (!featured || featured.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-3">Featured Camps</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
        {featured.map((item: any) => (
          <Link
            key={item.listingId}
            href={item.campSlug ? `/discover/${item.orgSlug}/${item.campSlug}` : `/organization/${item.orgSlug}`}
            className="flex-shrink-0 w-64 rounded-xl border border-yellow-200 bg-gradient-to-b from-yellow-50 to-white overflow-hidden hover:shadow-md transition-shadow"
          >
            {item.imageUrl && (
              <div className="h-32 bg-gray-100">
                <img src={item.imageUrl} alt={item.campName || item.orgName} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">
                  {item.tier === 'spotlight' ? 'Spotlight' : 'Featured'}
                </span>
              </div>
              <h3 className="font-semibold text-sm line-clamp-1">{item.campName || item.orgName}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{item.orgName}</p>
              {item.nextSessionDate && (
                <p className="text-xs text-gray-500 mt-1">
                  Next: {new Date(item.nextSessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {item.nextSessionPrice !== undefined && ` - $${(item.nextSessionPrice / 100).toFixed(0)}`}
                </p>
              )}
              {item.campCount !== undefined && (
                <p className="text-xs text-gray-500 mt-1">{item.campCount} camp programs</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Id } from '../../convex/_generated/dataModel';

interface SessionPopupProps {
  session: {
    _id: Id<'sessions'>;
    startDate: string;
    endDate: string;
    price: number;
    currency: string;
    spotsLeft?: number;
    distanceFromHome?: number;
    camp: {
      name: string;
    };
    organization: {
      name: string;
    };
    location: {
      name: string;
    };
  };
}

export function SessionPopup({ session }: SessionPopupProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className="min-w-[200px] max-w-[280px]">
      <h3 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2">
        {session.camp.name}
      </h3>
      <p className="text-xs text-slate-500 mb-2">{session.organization.name}</p>

      <div className="space-y-1 text-xs text-slate-600 mb-3">
        <p>{formatDate(session.startDate)} - {formatDate(session.endDate)}</p>
        <p>{session.location.name}</p>
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">
            {formatPrice(session.price, session.currency)}
          </span>
          {session.distanceFromHome !== undefined && (
            <span className="text-primary">{session.distanceFromHome} mi</span>
          )}
        </div>
        {session.spotsLeft !== undefined && session.spotsLeft > 0 && (
          <p className="text-green-600">{session.spotsLeft} spots left</p>
        )}
        {session.spotsLeft === 0 && (
          <p className="text-red-600">Sold out</p>
        )}
      </div>

      <Link
        href={`/session/${session._id}`}
        className="block w-full text-center px-3 py-1.5 bg-primary text-white text-xs font-medium rounded hover:bg-primary-dark transition-colors"
      >
        View Details
      </Link>
    </div>
  );
}

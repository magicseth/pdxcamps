'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface CalendarExportProps {
  isPremium: boolean;
  shareToken?: string;
}

export function CalendarExport({ isPremium, shareToken }: CalendarExportProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  const events = useQuery(api.calendar.queries.getCalendarEvents, isPremium ? {} : 'skip');

  if (!isPremium) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sm">Calendar Export</h3>
            <p className="text-xs text-gray-500">Sync your camp schedule with Google Calendar, Apple Calendar, or Outlook.</p>
          </div>
          <a href="/upgrade" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700">
            Upgrade
          </a>
        </div>
      </div>
    );
  }

  if (!shareToken) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-500">Create a share link first to enable calendar export.</p>
      </div>
    );
  }

  const icalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/calendar/${shareToken}`;
  const webcalUrl = icalUrl.replace(/^https?:/, 'webcal:');
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webcalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium text-sm">Calendar Export</h3>
          <p className="text-xs text-gray-500">
            {events ? `${events.length} camp events` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          {showOptions ? 'Hide options' : 'Export'}
        </button>
      </div>

      {showOptions && (
        <div className="space-y-2 pt-2 border-t">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 text-sm"
          >
            <span className="text-lg">&#128197;</span>
            <div>
              <p className="font-medium">Google Calendar</p>
              <p className="text-xs text-gray-500">Subscribe and auto-update</p>
            </div>
          </a>

          <a
            href={webcalUrl}
            className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 text-sm"
          >
            <span className="text-lg">&#127823;</span>
            <div>
              <p className="font-medium">Apple Calendar / Outlook</p>
              <p className="text-xs text-gray-500">Opens in your default calendar app</p>
            </div>
          </a>

          <a
            href={icalUrl}
            download="camp-schedule.ics"
            className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 text-sm"
          >
            <span className="text-lg">&#128190;</span>
            <div>
              <p className="font-medium">Download .ics file</p>
              <p className="text-xs text-gray-500">Import into any calendar app</p>
            </div>
          </a>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 text-sm w-full text-left"
          >
            <span className="text-lg">{copied ? '&#10003;' : '&#128203;'}</span>
            <div>
              <p className="font-medium">{copied ? 'Copied!' : 'Copy calendar URL'}</p>
              <p className="text-xs text-gray-500">For manual subscription</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

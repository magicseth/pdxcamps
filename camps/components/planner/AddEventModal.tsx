'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

type EventType = 'vacation' | 'family_visit' | 'day_camp' | 'summer_school' | 'other';

const EVENT_TYPES: { value: EventType; label: string; icon: string }[] = [
  { value: 'vacation', label: 'Vacation', icon: '✈' },
  { value: 'family_visit', label: 'Family Visit', icon: '👨‍👩‍👧‍👦' },
  { value: 'day_camp', label: 'Day Camp', icon: '🏕' },
  { value: 'summer_school', label: 'Summer School', icon: '📚' },
  { value: 'other', label: 'Other', icon: '📅' },
];

const COLORS = [
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
];

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultChildIds?: Id<'children'>[];
}

export function AddEventModal({
  isOpen,
  onClose,
  defaultStartDate,
  defaultEndDate,
  defaultChildIds = [],
}: AddEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(defaultStartDate ?? '');
  const [endDate, setEndDate] = useState(defaultEndDate ?? '');
  const [eventType, setEventType] = useState<EventType>('vacation');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState('purple');
  const [selectedChildIds, setSelectedChildIds] = useState<Id<'children'>[]>(defaultChildIds);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const children = useQuery(api.children.queries.listChildren);
  const createEvent = useMutation(api.planner.mutations.createFamilyEvent);

  // ESC key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onClose();
    }
  }, [onClose, isSubmitting]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }

    if (selectedChildIds.length === 0) {
      setError('Please select at least one child');
      return;
    }

    try {
      setIsSubmitting(true);
      await createEvent({
        childIds: selectedChildIds,
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate,
        eventType,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        color,
      });

      // Reset form and close
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartDate(defaultStartDate ?? '');
    setEndDate(defaultEndDate ?? '');
    setEventType('vacation');
    setLocation('');
    setNotes('');
    setColor('purple');
    setSelectedChildIds(defaultChildIds);
    setError(null);
  };

  const toggleChild = (childId: Id<'children'>) => {
    setSelectedChildIds((prev) =>
      prev.includes(childId)
        ? prev.filter((id) => id !== childId)
        : [...prev, childId]
    );
  };

  const selectAllChildren = () => {
    if (children) {
      setSelectedChildIds(children.map((c) => c._id));
    }
  };

  // Handle click outside modal
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  }, [onClose, isSubmitting]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-event-modal-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 id="add-event-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Add Family Event
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            aria-label="Close"
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., San Diego Trip"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              required
              autoFocus
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Event Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setEventType(type.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                    eventType === type.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{type.icon}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                const day = today.getDay();
                const monday = new Date(today);
                monday.setDate(today.getDate() - day + 1);
                const friday = new Date(monday);
                friday.setDate(monday.getDate() + 4);
                setStartDate(monday.toISOString().split('T')[0]);
                setEndDate(friday.toISOString().split('T')[0]);
              }}
              className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                const day = today.getDay();
                const monday = new Date(today);
                monday.setDate(today.getDate() - day + 8);
                const friday = new Date(monday);
                friday.setDate(monday.getDate() + 4);
                setStartDate(monday.toISOString().split('T')[0]);
                setEndDate(friday.toISOString().split('T')[0]);
              }}
              className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              Next Week
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setStartDate(today.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
              }}
              className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              Today
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  setStartDate(newStartDate);
                  // Auto-set end date if empty or before new start date
                  if (!endDate || endDate < newStartDate) {
                    setEndDate(newStartDate);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Children Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Children *
              </label>
              {children && children.length > 1 && (
                <button
                  type="button"
                  onClick={selectAllChildren}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Select all
                </button>
              )}
            </div>
            {children === undefined ? (
              <div className="text-sm text-slate-500">Loading...</div>
            ) : children.length === 0 ? (
              <div className="text-sm text-slate-500">No children found</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {children.map((child) => (
                  <button
                    key={child._id}
                    type="button"
                    onClick={() => toggleChild(child._id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${
                      selectedChildIds.includes(child._id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs font-medium">
                      {child.firstName[0]}
                    </span>
                    {child.firstName}
                    {selectedChildIds.includes(child._id) && (
                      <span className="text-blue-500">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Location (optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., San Diego, CA"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Color
            </label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full ${c.class} ${
                    color === c.value
                      ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800'
                      : ''
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Notes (optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Notes (optional)
              </label>
              <span className={`text-xs ${notes.length > 450 ? 'text-orange-500' : 'text-slate-400'}`}>
                {notes.length}/500
              </span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Any additional details..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

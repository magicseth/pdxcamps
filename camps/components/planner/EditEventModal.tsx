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

interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    _id: Id<'familyEvents'>;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    eventType: EventType;
    location?: string;
    notes?: string;
    color?: string;
    childIds: Id<'children'>[];
  };
}

export function EditEventModal({ isOpen, onClose, event }: EditEventModalProps) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? '');
  const [startDate, setStartDate] = useState(event.startDate);
  const [endDate, setEndDate] = useState(event.endDate);
  const [eventType, setEventType] = useState<EventType>(event.eventType);
  const [location, setLocation] = useState(event.location ?? '');
  const [notes, setNotes] = useState(event.notes ?? '');
  const [color, setColor] = useState(event.color ?? 'purple');
  const [selectedChildIds, setSelectedChildIds] = useState<Id<'children'>[]>(event.childIds);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const children = useQuery(api.children.queries.listChildren);
  const updateEvent = useMutation(api.planner.mutations.updateFamilyEvent);
  const deleteEvent = useMutation(api.planner.mutations.deleteFamilyEvent);

  // Reset form when event changes
  useEffect(() => {
    setTitle(event.title);
    setDescription(event.description ?? '');
    setStartDate(event.startDate);
    setEndDate(event.endDate);
    setEventType(event.eventType);
    setLocation(event.location ?? '');
    setNotes(event.notes ?? '');
    setColor(event.color ?? 'purple');
    setSelectedChildIds(event.childIds);
    setError(null);
    setShowDeleteConfirm(false);
  }, [event]);

  // ESC key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting && !showDeleteConfirm) {
      onClose();
    }
  }, [onClose, isSubmitting, showDeleteConfirm]);

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
      await updateEvent({
        eventId: event._id,
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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSubmitting(true);
      await deleteEvent({ eventId: event._id });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleChild = (childId: Id<'children'>) => {
    setSelectedChildIds((prev) =>
      prev.includes(childId)
        ? prev.filter((id) => id !== childId)
        : [...prev, childId]
    );
  };

  // Handle click outside modal
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting && !showDeleteConfirm) {
      onClose();
    }
  }, [onClose, isSubmitting, showDeleteConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-event-modal-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 id="edit-event-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Edit Family Event
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close"
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm ? (
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Delete this event?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                &quot;{event.title}&quot; will be removed from your planner.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div role="alert" className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor="edit-event-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Title *
              </label>
              <input
                id="edit-event-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                required
                aria-required="true"
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-event-start-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Start Date *
                </label>
                <input
                  id="edit-event-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const newStartDate = e.target.value;
                    setStartDate(newStartDate);
                    // Auto-adjust end date if it's now before start date
                    if (endDate < newStartDate) {
                      setEndDate(newStartDate);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  required
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="edit-event-end-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  End Date *
                </label>
                <input
                  id="edit-event-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  required
                  aria-required="true"
                />
              </div>
            </div>

            {/* Children Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Children *
              </label>
              {children === undefined ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {children.map((child) => (
                    <button
                      key={child._id}
                      type="button"
                      onClick={() => toggleChild(child._id)}
                      aria-pressed={selectedChildIds.includes(child._id)}
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
              <label htmlFor="edit-event-location" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Location (optional)
              </label>
              <input
                id="edit-event-location"
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
                    aria-label={`Select ${c.label.toLowerCase()} color`}
                    aria-pressed={color === c.value}
                  />
                ))}
              </div>
            </div>

            {/* Notes (optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-event-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Notes (optional)
                </label>
                <span className={`text-xs ${notes.length > 450 ? 'text-orange-500' : 'text-slate-400'}`}>
                  {notes.length}/500
                </span>
              </div>
              <textarea
                id="edit-event-notes"
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
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-red-600 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Authenticated, Unauthenticated } from 'convex/react';
import { BottomNav } from '../../components/shared/BottomNav';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <BackIcon />
            <span className="font-medium">Back</span>
          </Link>
          <h1 className="text-lg font-bold">Settings</h1>
          <div className="w-16" />
        </div>
      </header>

      <main id="main-content" className="p-4 md:p-8">
        <Authenticated>
          <SettingsContent />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">
              Please sign in to view settings.
            </p>
            <a
              href="/sign-in"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Sign in
            </a>
          </div>
        </Unauthenticated>
      </main>

      <BottomNav />
    </div>
  );
}

function SettingsContent() {
  const family = useQuery(api.families.queries.getCurrentFamily);
  const children = useQuery(api.children.queries.listChildren);
  const cities = useQuery(api.cities.queries.listActiveCities);

  if (family === undefined || children === undefined) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse motion-reduce:animate-none space-y-6">
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Family Profile */}
      <FamilyProfileSection family={family} cities={cities || []} />

      {/* Children */}
      <ChildrenSection children={children} />

      {/* Account Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Account
        </h2>
        <div className="space-y-3">
          <Link
            href="/sign-out"
            className="block w-full px-4 py-3 text-left text-red-600 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Sign Out
          </Link>
        </div>
      </div>
    </div>
  );
}

function FamilyProfileSection({
  family,
  cities,
}: {
  family: {
    _id: Id<'families'>;
    displayName: string;
    email: string;
    primaryCityId: Id<'cities'>;
  } | null;
  cities: { _id: Id<'cities'>; name: string; slug: string }[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(family?.displayName ?? '');
  const [primaryCityId, setPrimaryCityId] = useState<Id<'cities'> | ''>(
    family?.primaryCityId ?? ''
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateFamily = useMutation(api.families.mutations.updateFamily);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    if (!primaryCityId) {
      setError('Please select a city');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await updateFamily({
        displayName: displayName.trim(),
        primaryCityId: primaryCityId as Id<'cities'>,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(family?.displayName ?? '');
    setPrimaryCityId(family?.primaryCityId ?? '');
    setError(null);
    setIsEditing(false);
  };

  if (!family) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
        <p className="text-slate-600 dark:text-slate-400">
          No family profile found.{' '}
          <Link href="/onboarding" className="text-blue-600 hover:underline">
            Complete setup
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Family Profile
        </h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Edit
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="settings-display-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              id="settings-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="settings-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              value={family.email}
              disabled
              aria-describedby="email-help"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400"
            />
            <p id="email-help" className="text-xs text-slate-500 mt-1">
              Email cannot be changed
            </p>
          </div>

          <div>
            <label htmlFor="settings-primary-city" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Primary City
            </label>
            <select
              id="settings-primary-city"
              value={primaryCityId}
              onChange={(e) => setPrimaryCityId(e.target.value as Id<'cities'>)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="">Select a city</option>
              {cities.map((city) => (
                <option key={city._id} value={city._id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Display Name
            </p>
            <p className="font-medium text-slate-900 dark:text-white">
              {family.displayName}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
            <p className="font-medium text-slate-900 dark:text-white">
              {family.email}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Primary City
            </p>
            <p className="font-medium text-slate-900 dark:text-white">
              {cities.find((c) => c._id === family.primaryCityId)?.name ??
                'Unknown'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ChildrenSection({
  children,
}: {
  children: {
    _id: Id<'children'>;
    firstName: string;
    lastName?: string;
    birthdate: string;
    currentGrade?: number;
    interests: string[];
  }[];
}) {
  const [editingChildId, setEditingChildId] = useState<Id<'children'> | null>(
    null
  );
  const [showAddChild, setShowAddChild] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Children
        </h2>
        <button
          onClick={() => setShowAddChild(true)}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <PlusIcon />
          Add Child
        </button>
      </div>

      {children.length === 0 ? (
        <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="text-4xl mb-3">👨‍👩‍👧‍👦</div>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            No children added yet. Add your children to start planning camps!
          </p>
          <button
            type="button"
            onClick={() => setShowAddChild(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Child
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {children.map((child) =>
            editingChildId === child._id ? (
              <EditChildForm
                key={child._id}
                child={child}
                onClose={() => setEditingChildId(null)}
              />
            ) : (
              <ChildCard
                key={child._id}
                child={child}
                onEdit={() => setEditingChildId(child._id)}
              />
            )
          )}
        </div>
      )}

      {showAddChild && (
        <AddChildModal onClose={() => setShowAddChild(false)} />
      )}
    </div>
  );
}

function ChildCard({
  child,
  onEdit,
}: {
  child: {
    _id: Id<'children'>;
    firstName: string;
    lastName?: string;
    birthdate: string;
    currentGrade?: number;
    interests: string[];
  };
  onEdit: () => void;
}) {
  const age = calculateAge(child.birthdate);
  const gradeLabel = child.currentGrade !== undefined ? getGradeLabel(child.currentGrade) : null;

  return (
    <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
          {child.firstName[0]}
        </div>
        <div>
          <p className="font-medium text-slate-900 dark:text-white">
            {child.firstName} {child.lastName}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {age} years old{gradeLabel ? ` • ${gradeLabel}` : ''}
          </p>
        </div>
      </div>
      <button
        onClick={onEdit}
        className="text-sm text-blue-600 hover:text-blue-700"
      >
        Edit
      </button>
    </div>
  );
}

function EditChildForm({
  child,
  onClose,
}: {
  child: {
    _id: Id<'children'>;
    firstName: string;
    lastName?: string;
    birthdate: string;
    currentGrade?: number;
    interests: string[];
  };
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState(child.firstName);
  const [lastName, setLastName] = useState(child.lastName ?? '');
  const [birthdate, setBirthdate] = useState(child.birthdate);
  const [currentGrade, setCurrentGrade] = useState<number | undefined>(
    child.currentGrade
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateChild = useMutation(api.children.mutations.updateChild);
  const deleteChild = useMutation(api.children.mutations.deactivateChild);

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!birthdate) {
      setError('Birthdate is required');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await updateChild({
        childId: child._id,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        birthdate,
        currentGrade,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update child');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSaving(true);
      await deleteChild({ childId: child._id });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove child');
      setIsSaving(false);
    }
  };

  if (showDeleteConfirm) {
    return (
      <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
          Are you sure you want to remove {child.firstName}? This will also
          remove their registrations.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-white dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
      {error && (
        <div role="alert" className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`edit-child-firstName-${child._id}`} className="block text-xs text-slate-500 mb-1">
            First Name *
          </label>
          <input
            type="text"
            id={`edit-child-firstName-${child._id}`}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            autoCapitalize="words"
            spellCheck="false"
            required
            aria-required="true"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label htmlFor={`edit-child-lastName-${child._id}`} className="block text-xs text-slate-500 mb-1">Last Name</label>
          <input
            type="text"
            id={`edit-child-lastName-${child._id}`}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            autoCapitalize="words"
            spellCheck="false"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`edit-child-birthdate-${child._id}`} className="block text-xs text-slate-500 mb-1">
            Birthdate *
          </label>
          <input
            type="date"
            id={`edit-child-birthdate-${child._id}`}
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
            aria-required="true"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label htmlFor={`edit-child-grade-${child._id}`} className="block text-xs text-slate-500 mb-1">Grade</label>
          <select
            id={`edit-child-grade-${child._id}`}
            value={currentGrade ?? ''}
            onChange={(e) =>
              setCurrentGrade(e.target.value ? parseInt(e.target.value) : undefined)
            }
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
          >
            <option value="">Not set</option>
            {GRADES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 text-red-600 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
        >
          Remove
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function AddChildModal({ onClose }: { onClose: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [currentGrade, setCurrentGrade] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const addChild = useMutation(api.children.mutations.addChild);

  // ESC key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isSaving) {
      onClose();
    }
  }, [onClose, isSaving]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose();
    }
  }, [onClose, isSaving]);

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!birthdate) {
      setError('Birthdate is required');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await addChild({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        birthdate,
        currentGrade,
        interests: [],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add child');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-child-modal-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="add-child-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Add Child
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close"
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="add-child-firstName" className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                First Name *
              </label>
              <input
                type="text"
                id="add-child-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                autoCapitalize="words"
                spellCheck="false"
                required
                aria-required="true"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="add-child-lastName" className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                Last Name
              </label>
              <input
                type="text"
                id="add-child-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                autoCapitalize="words"
                spellCheck="false"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="add-child-birthdate" className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                Birthdate *
              </label>
              <input
                type="date"
                id="add-child-birthdate"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
                aria-required="true"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="add-child-grade" className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                Grade
              </label>
              <select
                id="add-child-grade"
                value={currentGrade ?? ''}
                onChange={(e) =>
                  setCurrentGrade(
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">Not set</option>
                {GRADES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Adding...' : 'Add Child'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Constants
const GRADES = [
  { value: -1, label: 'Pre-K' },
  { value: 0, label: 'Kindergarten' },
  { value: 1, label: '1st Grade' },
  { value: 2, label: '2nd Grade' },
  { value: 3, label: '3rd Grade' },
  { value: 4, label: '4th Grade' },
  { value: 5, label: '5th Grade' },
  { value: 6, label: '6th Grade' },
  { value: 7, label: '7th Grade' },
  { value: 8, label: '8th Grade' },
  { value: 9, label: '9th Grade' },
  { value: 10, label: '10th Grade' },
  { value: 11, label: '11th Grade' },
  { value: 12, label: '12th Grade' },
];

// Helpers
function calculateAge(birthdate: string): number {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getGradeLabel(grade: number): string {
  const found = GRADES.find((g) => g.value === grade);
  return found?.label ?? `Grade ${grade}`;
}

// Icons
function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

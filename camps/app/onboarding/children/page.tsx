'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const COMMON_INTERESTS = [
  'Sports',
  'Arts',
  'STEM',
  'Nature',
  'Music',
  'Drama',
  'Swimming',
  'Cooking',
  'Dance',
  'Gaming',
];

const GRADE_OPTIONS = [
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

interface ChildFormData {
  firstName: string;
  lastName: string;
  birthdate: string;
  currentGrade: number | '';
  interests: string[];
}

const emptyChildForm: ChildFormData = {
  firstName: '',
  lastName: '',
  birthdate: '',
  currentGrade: '',
  interests: [],
};

export default function ChildrenSetupPage() {
  const router = useRouter();
  const family = useQuery(api.families.queries.getCurrentFamily);
  const children = useQuery(api.children.queries.listChildren);
  const addChild = useMutation(api.children.mutations.addChild);
  const completeOnboarding = useMutation(api.families.mutations.completeOnboarding);

  const [childForm, setChildForm] = useState<ChildFormData>(emptyChildForm);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);

  // Redirect if no family exists
  if (family !== undefined && family === null) {
    router.replace('/onboarding/family');
    return null;
  }

  const handleInterestToggle = (interest: string) => {
    setChildForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!childForm.firstName.trim()) {
      setError('Please enter a first name');
      return;
    }

    if (!childForm.birthdate) {
      setError('Please enter a birthdate');
      return;
    }

    setIsAddingChild(true);

    try {
      await addChild({
        firstName: childForm.firstName.trim(),
        lastName: childForm.lastName.trim() || undefined,
        birthdate: childForm.birthdate,
        currentGrade: childForm.currentGrade !== '' ? childForm.currentGrade : undefined,
        interests: childForm.interests,
      });
      setChildForm(emptyChildForm);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add child');
    } finally {
      setIsAddingChild(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (!children || children.length === 0) {
      setError('Please add at least one child to continue');
      return;
    }

    setIsCompleting(true);

    try {
      await completeOnboarding({});
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup');
      setIsCompleting(false);
    }
  };

  if (family === undefined || children === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hasChildren = children.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Add Your Children</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Tell us about the kids who&apos;ll be going to camps
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-xs font-semibold">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span>Family Profile</span>
              <span className="mx-2">-</span>
              <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-semibold">2</span>
              <span>Add Children</span>
            </div>
          </div>

          {/* List of added children */}
          {hasChildren && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Children Added ({children.length})
              </h3>
              <div className="space-y-2">
                {children.map((child) => (
                  <div
                    key={child._id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {child.firstName} {child.lastName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {child.interests.length > 0
                          ? child.interests.join(', ')
                          : 'No interests selected'}
                      </p>
                    </div>
                    <span className="text-green-600 dark:text-green-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add child form */}
          {showForm ? (
            <form onSubmit={handleAddChild} className="space-y-4">
              {hasChildren && (
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Add Another Child
                </h3>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={childForm.firstName}
                    onChange={(e) => setChildForm({ ...childForm, firstName: e.target.value })}
                    autoComplete="given-name"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                    disabled={isAddingChild}
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={childForm.lastName}
                    onChange={(e) => setChildForm({ ...childForm, lastName: e.target.value })}
                    autoComplete="family-name"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                    disabled={isAddingChild}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="birthdate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Birthdate *
                  </label>
                  <input
                    type="date"
                    id="birthdate"
                    value={childForm.birthdate}
                    onChange={(e) => setChildForm({ ...childForm, birthdate: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                    disabled={isAddingChild}
                  />
                </div>
                <div>
                  <label htmlFor="grade" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Current Grade
                  </label>
                  <select
                    id="grade"
                    value={childForm.currentGrade}
                    onChange={(e) => setChildForm({ ...childForm, currentGrade: e.target.value === '' ? '' : parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                    disabled={isAddingChild}
                  >
                    <option value="">Select grade</option>
                    {GRADE_OPTIONS.map((grade) => (
                      <option key={grade.value} value={grade.value}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Interests
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_INTERESTS.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => handleInterestToggle(interest)}
                      disabled={isAddingChild}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        childForm.interests.includes(interest)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isAddingChild}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
                >
                  {isAddingChild ? 'Adding...' : hasChildren ? 'Add Child' : 'Add First Child'}
                </button>
                {hasChildren && (
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    disabled={isAddingChild}
                    className="py-2 px-4 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowForm(true);
                setError(null);
              }}
              className="w-full py-2 px-4 border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 font-medium rounded-md hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              + Add Another Child
            </button>
          )}

          {/* Complete setup button */}
          {hasChildren && !showForm && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleCompleteSetup}
                disabled={isCompleting}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-md transition-colors"
              >
                {isCompleting ? 'Completing...' : 'Complete Setup'}
              </button>
              <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400">
                You can always add more children later in settings
              </p>
            </div>
          )}

          {hasChildren && showForm && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleCompleteSetup}
                disabled={isCompleting || isAddingChild}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-md transition-colors"
              >
                {isCompleting ? 'Completing...' : 'Skip and Complete Setup'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

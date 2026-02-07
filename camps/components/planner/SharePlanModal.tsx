'use client';

import { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export function SharePlanModal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: { _id: Id<'children'>; firstName: string; shareToken?: string }[];
}) {
  const generateFamilyToken = useMutation(api.children.mutations.generateFamilyShareToken);
  const [selectedChildIds, setSelectedChildIds] = useState<Set<Id<'children'>>>(new Set());
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize with all children selected
  useEffect(() => {
    if (isOpen && children.length > 0 && selectedChildIds.size === 0) {
      setSelectedChildIds(new Set(children.map(c => c._id)));
    }
  }, [isOpen, children, selectedChildIds.size]);

  // Reset share URL when selection changes
  useEffect(() => {
    setShareUrl(null);
  }, [selectedChildIds]);

  const toggleChild = (childId: Id<'children'>) => {
    const newSet = new Set(selectedChildIds);
    if (newSet.has(childId)) {
      newSet.delete(childId);
    } else {
      newSet.add(childId);
    }
    setSelectedChildIds(newSet);
  };

  const handleGenerateLink = async () => {
    if (selectedChildIds.size === 0) return;
    setIsGenerating(true);

    try {
      const childIds = Array.from(selectedChildIds);
      const token = await generateFamilyToken({ childIds });
      setShareUrl(`${window.location.origin}/share/family/${token}`);
    } catch (error) {
      console.error('Failed to generate share link:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedChildren = children.filter(c => selectedChildIds.has(c._id));

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    const names = selectedChildren.map(c => c.firstName).join(' & ');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${names}'s Summer Camp Plans`,
          text: `Check out our summer camp plans!`,
          url: shareUrl,
        });
      } catch (error) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Share Summer Schedule</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Child Selection */}
        {children.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select kids to include
            </label>
            <div className="flex flex-wrap gap-2">
              {children.map((child) => (
                <button
                  key={child._id}
                  onClick={() => toggleChild(child._id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedChildIds.has(child._id)
                      ? 'bg-accent text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {selectedChildIds.has(child._id) && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {child.firstName}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              One link will show all selected kids' schedules
            </p>
          </div>
        )}

        {/* Share Link */}
        {shareUrl ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Share link for {selectedChildren.map(c => c.firstName).join(' & ')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 font-medium"
                >
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            </div>

            <button
              onClick={handleShare}
              className="w-full py-4 bg-gradient-to-r from-accent to-accent-dark text-white font-bold text-lg rounded-xl hover:from-accent-dark hover:to-primary transition-all shadow-lg"
            >
              📤 Share with Friends & Family
            </button>

            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Friends will see a preview of your summer plans and can sign up to see details
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {selectedChildren.length === 0
                ? 'Select at least one child to share'
                : `Create a shareable link for ${selectedChildren.map(c => c.firstName).join(' & ')}'s summer`
              }
            </p>
            <button
              onClick={handleGenerateLink}
              disabled={isGenerating || selectedChildren.length === 0}
              className="w-full py-4 bg-gradient-to-r from-accent to-accent-dark text-white font-bold text-lg rounded-xl hover:from-accent-dark hover:to-primary transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : '🔗 Generate Share Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

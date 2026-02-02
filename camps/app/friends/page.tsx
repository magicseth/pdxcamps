'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import Link from 'next/link';
import { BottomNav } from '../../components/shared/BottomNav';

export default function FriendsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      <header className="sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
              <BackIcon />
              <span className="text-sm font-medium hidden sm:inline">Planner</span>
            </Link>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Friends</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              title="Settings"
              aria-label="Settings"
            >
              <SettingsIcon />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">☀️</span>
              <span className="font-bold hidden sm:inline">PDX Camps</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8 pb-24">
        <FriendRequests />
        <MyFriends />
        <AddFriend />
        <CalendarSharingSettings />
      </main>

      <BottomNav />
    </div>
  );
}

// ============ Friend Requests Section ============

function FriendRequests() {
  const pendingRequests = useQuery(api.social.queries.listPendingFriendRequests);
  const acceptRequest = useMutation(api.social.mutations.acceptFriendRequest);
  const declineRequest = useMutation(api.social.mutations.declineFriendRequest);
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (pendingRequests === undefined) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Friend Requests</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </section>
    );
  }

  const { sent, received } = pendingRequests;
  const hasPending = sent.length > 0 || received.length > 0;

  if (!hasPending) {
    return null;
  }

  const handleAccept = async (friendshipId: Id<"friendships">) => {
    setProcessingId(friendshipId);
    try {
      await acceptRequest({ friendshipId });
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      alert('Failed to accept friend request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (friendshipId: Id<"friendships">) => {
    setProcessingId(friendshipId);
    try {
      await declineRequest({ friendshipId });
    } catch (error) {
      console.error('Failed to decline friend request:', error);
      alert('Failed to decline friend request');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Friend Requests</h2>

      {received.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Incoming Requests ({received.length})
          </h3>
          <div className="space-y-3">
            {received.map((request) => (
              <div
                key={request.friendshipId}
                className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"
              >
                <div>
                  <p className="font-medium">{request.requester?.displayName || 'Unknown'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {request.requester?.email}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(request.friendshipId)}
                    disabled={processingId === request.friendshipId}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingId === request.friendshipId ? 'Processing...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleDecline(request.friendshipId)}
                    disabled={processingId === request.friendshipId}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sent.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Sent Requests ({sent.length})
          </h3>
          <div className="space-y-3">
            {sent.map((request) => (
              <div
                key={request.friendshipId}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <p className="font-medium">{request.addressee?.displayName || 'Unknown'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {request.addressee?.email}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ============ My Friends Section ============

function MyFriends() {
  const friends = useQuery(api.social.queries.listFriends);
  const sharedCalendars = useQuery(api.social.queries.getSharedCalendars);
  const removeFriend = useMutation(api.social.mutations.removeFriend);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [sharingFriend, setSharingFriend] = useState<{
    friendshipId: Id<"friendships">;
    friendId: Id<"families">;
    displayName: string;
  } | null>(null);

  if (friends === undefined) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">My Friends</h2>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const handleRemove = async (friendshipId: Id<"friendships">, displayName: string) => {
    if (!confirm(`Are you sure you want to remove ${displayName} as a friend? This will also revoke any calendar shares.`)) {
      return;
    }
    setRemovingId(friendshipId);
    try {
      await removeFriend({ friendshipId });
    } catch (error) {
      console.error('Failed to remove friend:', error);
      alert('Failed to remove friend');
    } finally {
      setRemovingId(null);
    }
  };

  // Build a map of friend family ID to whether they've shared their calendar with us
  const sharedCalendarsByOwner = new Map(
    (sharedCalendars || []).map((share) => [share.owner?._id, share])
  );

  return (
    <>
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">My Friends ({friends.length})</h2>

        {friends.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            You haven&apos;t added any friends yet. Use the form below to send a friend request.
          </p>
        ) : (
          <div className="space-y-4">
            {friends.map((friendship) => {
              const hasSharedWithUs = sharedCalendarsByOwner.has(friendship.friend?._id);
              return (
                <div
                  key={friendship.friendshipId}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {friendship.friend?.displayName?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{friendship.friend?.displayName || 'Unknown'}</p>
                      {friendship.acceptedAt && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Friends since {new Date(friendship.acceptedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasSharedWithUs && friendship.friend && (
                      <Link
                        href={`/friends/${friendship.friend._id}/calendar`}
                        className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800"
                      >
                        View Calendar
                      </Link>
                    )}
                    {friendship.friend && (
                      <button
                        onClick={() => setSharingFriend({
                          friendshipId: friendship.friendshipId,
                          friendId: friendship.friend!._id,
                          displayName: friendship.friend!.displayName,
                        })}
                        className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-800"
                      >
                        Share My Calendar
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(friendship.friendshipId, friendship.friend?.displayName || 'this friend')}
                      disabled={removingId === friendship.friendshipId}
                      className="px-3 py-1.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md text-sm font-medium hover:bg-red-200 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {removingId === friendship.friendshipId ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Share Calendar Modal */}
      {sharingFriend && (
        <ShareCalendarModal
          friendId={sharingFriend.friendId}
          friendDisplayName={sharingFriend.displayName}
          onClose={() => setSharingFriend(null)}
        />
      )}
    </>
  );
}

// ============ Share Calendar Modal ============

function ShareCalendarModal({
  friendId,
  friendDisplayName,
  onClose,
}: {
  friendId: Id<"families">;
  friendDisplayName: string;
  onClose: () => void;
}) {
  const children = useQuery(api.children.queries.listChildren);
  const myShares = useQuery(api.social.queries.getMyCalendarShares);
  const shareCalendar = useMutation(api.social.mutations.shareCalendar);
  const updateShare = useMutation(api.social.mutations.updateCalendarShare);
  const revokeShare = useMutation(api.social.mutations.revokeCalendarShare);

  const [selectedChildren, setSelectedChildren] = useState<Id<"children">[]>([]);
  const [permission, setPermission] = useState<"view_sessions" | "view_details">("view_sessions");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ESC key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onClose();
    }
  }, [onClose, isSubmitting]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Backdrop click to close modal
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  }, [onClose, isSubmitting]);

  // Find existing share with this friend
  const existingShare = myShares?.find((share) => share.sharedWith?._id === friendId);

  // Initialize form with existing share data
  useState(() => {
    if (existingShare) {
      setSelectedChildren(existingShare.children.map((c) => c._id));
      setPermission(existingShare.permission);
    }
  });

  const toggleChild = (childId: Id<"children">) => {
    setSelectedChildren((prev) =>
      prev.includes(childId)
        ? prev.filter((id) => id !== childId)
        : [...prev, childId]
    );
  };

  const handleSubmit = async () => {
    if (selectedChildren.length === 0) {
      alert('Please select at least one child to share');
      return;
    }

    setIsSubmitting(true);
    try {
      if (existingShare) {
        await updateShare({
          shareId: existingShare.shareId,
          childIds: selectedChildren,
          permission,
          isActive: true,
        });
      } else {
        await shareCalendar({
          friendFamilyId: friendId,
          childIds: selectedChildren,
          permission,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to share calendar:', error);
      alert('Failed to share calendar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!existingShare) return;
    if (!confirm(`Stop sharing your calendar with ${friendDisplayName}?`)) return;

    setIsSubmitting(true);
    try {
      await revokeShare({ shareId: existingShare.shareId });
      onClose();
    } catch (error) {
      console.error('Failed to revoke share:', error);
      alert('Failed to revoke calendar share');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-calendar-modal-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="share-calendar-modal-title" className="text-lg font-semibold">
            Share Calendar with {friendDisplayName}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            aria-label="Close"
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>

        {children === undefined ? (
          <p className="text-gray-500">Loading children...</p>
        ) : children.length === 0 ? (
          <p className="text-gray-500">
            You need to add children to your family before sharing calendars.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Children to Share
              </label>
              <div className="space-y-2">
                {children.map((child) => (
                  <label
                    key={child._id}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChildren.includes(child._id)}
                      onChange={() => toggleChild(child._id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="font-medium">{child.firstName}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Permission Level
              </label>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as "view_sessions" | "view_details")}
                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="view_sessions">View Sessions - Camp names and dates only</option>
                <option value="view_details">View Details - Includes prices and notes</option>
              </select>
            </div>

            <div className="flex gap-3">
              {existingShare && (
                <button
                  onClick={handleRevoke}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Stop Sharing
                </button>
              )}
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedChildren.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : existingShare ? 'Update Share' : 'Share Calendar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============ Add Friend Section ============

function AddFriend() {
  const sendRequest = useMutation(api.social.mutations.sendFriendRequest);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setMessage(null);
    try {
      await sendRequest({ addresseeEmail: email.trim() });
      setMessage({ type: 'success', text: 'Friend request sent!' });
      setEmail('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send friend request';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Add Friend</h2>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter friend's email address"
            autoComplete="email"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !email.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending...' : 'Send Request'}
        </button>
      </form>
      {message && (
        <p
          className={`mt-3 text-sm ${
            message.type === 'success'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}

// ============ Calendar Sharing Settings Section ============

function CalendarSharingSettings() {
  const myShares = useQuery(api.social.queries.getMyCalendarShares);
  const updateShare = useMutation(api.social.mutations.updateCalendarShare);
  const revokeShare = useMutation(api.social.mutations.revokeCalendarShare);
  const [editingShare, setEditingShare] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (myShares === undefined) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Calendar Sharing Settings</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </section>
    );
  }

  const handleRevoke = async (shareId: Id<"calendarShares">, displayName: string) => {
    if (!confirm(`Stop sharing your calendar with ${displayName}?`)) return;

    setProcessingId(shareId);
    try {
      await revokeShare({ shareId });
    } catch (error) {
      console.error('Failed to revoke share:', error);
      alert('Failed to revoke calendar share');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermissionChange = async (shareId: Id<"calendarShares">, newPermission: "view_sessions" | "view_details") => {
    setProcessingId(shareId);
    try {
      await updateShare({ shareId, permission: newPermission });
    } catch (error) {
      console.error('Failed to update share:', error);
      alert('Failed to update permission');
    } finally {
      setProcessingId(null);
      setEditingShare(null);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Calendar Sharing Settings</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Manage who can see your family&apos;s camp calendar.
      </p>

      {myShares.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>You haven&apos;t shared your calendar with anyone yet.</p>
          <p className="text-sm mt-1">
            Click &quot;Share My Calendar&quot; next to a friend&apos;s name above to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {myShares.map((share) => (
            <div
              key={share.shareId}
              className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium">{share.sharedWith?.displayName || 'Unknown'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Children: {share.children.map((c) => c.firstName).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {editingShare === share.shareId ? (
                    <select
                      value={share.permission}
                      onChange={(e) =>
                        handlePermissionChange(
                          share.shareId,
                          e.target.value as "view_sessions" | "view_details"
                        )
                      }
                      disabled={processingId === share.shareId}
                      aria-label="Change permission level"
                      className="text-sm border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="view_sessions">View Sessions</option>
                      <option value="view_details">View Details</option>
                    </select>
                  ) : (
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        share.permission === 'view_details'
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                          : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      }`}
                    >
                      {share.permission === 'view_details' ? 'View Details' : 'View Sessions'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingShare(editingShare === share.shareId ? null : share.shareId)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {editingShare === share.shareId ? 'Cancel' : 'Edit Permission'}
                </button>
                <button
                  onClick={() => handleRevoke(share.shareId, share.sharedWith?.displayName || 'this friend')}
                  disabled={processingId === share.shareId}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                >
                  {processingId === share.shareId ? 'Revoking...' : 'Revoke Access'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Icons
function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';

export default function AdminLocationsPage() {
  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const locationsData = useQuery(api.admin.queries.getLocationsNeedingFixes);
  const updateLocation = useMutation(api.admin.mutations.updateLocation);
  const geocodeLocation = useAction(api.admin.mutations.geocodeLocation);
  const bulkGeocode = useAction(api.admin.mutations.bulkGeocodeLocations);

  const [editingId, setEditingId] = useState<Id<'locations'> | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    latitude: '',
    longitude: '',
  });
  const [geocodingId, setGeocodingId] = useState<Id<'locations'> | null>(null);
  const [bulkGeocoding, setBulkGeocoding] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
  } | null>(null);

  if (isAdmin === undefined || locationsData === undefined) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!isAdmin || !locationsData) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Not Authorized</h1>
      </div>
    );
  }

  const { locations, summary } = locationsData;

  const startEdit = (location: typeof locations[0]) => {
    setEditingId(location._id);
    setEditForm({
      name: location.name,
      street: location.address.street,
      city: location.address.city,
      state: location.address.state,
      zip: location.address.zip,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: '',
      street: '',
      city: '',
      state: '',
      zip: '',
      latitude: '',
      longitude: '',
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    await updateLocation({
      locationId: editingId,
      name: editForm.name,
      street: editForm.street,
      city: editForm.city,
      state: editForm.state,
      zip: editForm.zip,
      latitude: parseFloat(editForm.latitude) || undefined,
      longitude: parseFloat(editForm.longitude) || undefined,
    });

    cancelEdit();
  };

  const handleGeocode = async (locationId: Id<'locations'>) => {
    setGeocodingId(locationId);
    try {
      const result = await geocodeLocation({ locationId });
      if (!result.success) {
        alert(`Geocoding failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeocodingId(null);
    }
  };

  const handleBulkGeocode = async () => {
    setBulkGeocoding(true);
    setBulkResult(null);
    try {
      const result = await bulkGeocode({ limit: 10 });
      setBulkResult(result);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBulkGeocoding(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
        >
          &larr; Back to Admin
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Location Management
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Fix locations with placeholder addresses or default coordinates
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.total}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Total Locations</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {summary.needingFixes}
          </div>
          <div className="text-sm text-red-600 dark:text-red-400">Needing Fixes</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {summary.withPlaceholderStreet}
          </div>
          <div className="text-sm text-yellow-600 dark:text-yellow-400">Missing Street</div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {summary.withDefaultCoords}
          </div>
          <div className="text-sm text-orange-600 dark:text-orange-400">Default Coords</div>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm mb-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Bulk Actions</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={handleBulkGeocode}
            disabled={bulkGeocoding || summary.needingFixes === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkGeocoding ? 'Geocoding...' : `Geocode Next 10 Locations`}
          </button>
          <span className="text-sm text-slate-500">
            Uses OpenCage API (2,500 free/day)
          </span>
        </div>
        {bulkResult && (
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <div className="text-sm">
              <span className="font-medium">Results:</span>{' '}
              {bulkResult.succeeded} succeeded, {bulkResult.failed} failed out of{' '}
              {bulkResult.processed} processed
            </div>
            {bulkResult.errors.length > 0 && (
              <div className="mt-2 text-sm text-red-600">
                <div className="font-medium">Errors:</div>
                <ul className="list-disc list-inside">
                  {bulkResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {bulkResult.errors.length > 5 && (
                    <li>...and {bulkResult.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Locations List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Locations Needing Fixes ({locations.length})
          </h2>
        </div>

        {locations.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            All locations have valid addresses and coordinates!
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {locations.map((location) => (
              <div key={location._id} className="p-4">
                {editingId === location._id ? (
                  // Edit Form
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Street
                        </label>
                        <input
                          type="text"
                          value={editForm.street}
                          onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                          placeholder="1234 Main St"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={editForm.city}
                          onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          value={editForm.state}
                          onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          ZIP
                        </label>
                        <input
                          type="text"
                          value={editForm.zip}
                          onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          onClick={() => handleGeocode(location._id)}
                          disabled={geocodingId === location._id}
                          className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          {geocodingId === location._id ? '...' : 'Geocode'}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Latitude
                        </label>
                        <input
                          type="text"
                          value={editForm.latitude}
                          onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Longitude
                        </label>
                        <input
                          type="text"
                          value={editForm.longitude}
                          onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-white text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display View
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          {location.name}
                        </h3>
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          {location.sessionCount} sessions
                        </span>
                      </div>
                      {location.organizationName && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {location.organizationName}
                        </div>
                      )}
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {location.address.street === 'TBD' ? (
                          <span className="text-red-500">No street address</span>
                        ) : (
                          location.address.street
                        )}
                        {', '}
                        {location.address.city}, {location.address.state} {location.address.zip}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Coords: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        {location.issues.hasDefaultCoords && (
                          <span className="ml-2 text-orange-500">(default - needs update)</span>
                        )}
                      </div>
                      {/* Issues Badges */}
                      <div className="mt-2 flex gap-2">
                        {location.issues.hasPlaceholderStreet && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                            Missing Street
                          </span>
                        )}
                        {location.issues.hasDefaultCoords && (
                          <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
                            Default Coords
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGeocode(location._id)}
                        disabled={geocodingId === location._id}
                        className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50"
                      >
                        {geocodingId === location._id ? 'Geocoding...' : 'Geocode'}
                      </button>
                      <button
                        onClick={() => startEdit(location)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

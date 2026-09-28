'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { getLocationService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Location,
  LocationStatus,
  can,
  Permissions,
  UserRole,
  LocationId,
} from '@fieldops/types';
import { createLocationSchema } from '@fieldops/validation';

export default function LocationsPage() {
  const { activeRole } = useAuth();
  const { activeOrganization } = useOrganization();
  const locationService = getLocationService();

  const [locations, setLocations] = useState<readonly Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState('100');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const role = activeRole || UserRole.FIELD_WORKER;
  const canManageLocations = can(role, Permissions.LOCATION_MANAGE);

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const filters: { status?: LocationStatus; search?: string } = {};
      if (statusFilter !== 'ALL') {
        filters.status = statusFilter as LocationStatus;
      }
      if (searchQuery.trim().length > 0) {
        filters.search = searchQuery.trim();
      }
      const data = await locationService.listLocations(filters);
      setLocations(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load locations.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    if (activeOrganization) {
      fetchLocations();
    }
  }, [activeOrganization, fetchLocations]);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        address: address.trim() || undefined,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        allowedRadiusMeters: parseInt(allowedRadiusMeters, 10),
      };

      const parsed = createLocationSchema.parse(payload);
      await locationService.createLocation(parsed);

      setName('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setAllowedRadiusMeters('100');
      setIsCreateModalOpen(false);
      fetchLocations();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const zodErr = err as { errors: Array<{ message: string }> };
        setCreateError(zodErr.errors.map((e) => e.message).join('. '));
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to create location.';
        setCreateError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveLocation = async (id: LocationId) => {
    if (!confirm('Are you sure you want to archive this location?')) return;
    try {
      await locationService.archiveLocation(id);
      fetchLocations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive location.';
      alert(msg);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Locations & Geofences</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage reusable customer sites, substations, and authorized check-in geofences.
          </p>
        </div>
        {canManageLocations && (
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <span>+ Add Location</span>
          </Button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex-1 min-w-[220px]">
          <input
            type="text"
            placeholder="Search by location name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Locations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading locations...</div>
        ) : locations.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900">No locations found</p>
            <p className="text-xs text-slate-500 mt-1">
              Add your first operational site to start dispatching and tracking visits.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Coordinates (Lat, Lon)</th>
                  <th className="py-3 px-4">Geofence Radius</th>
                  <th className="py-3 px-4">Status</th>
                  {canManageLocations && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{loc.name}</td>
                    <td className="py-3.5 px-4 text-slate-500">{loc.address || '—'}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {loc.allowedRadiusMeters} meters
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          loc.status === LocationStatus.ACTIVE
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {loc.status}
                      </span>
                    </td>
                    {canManageLocations && (
                      <td className="py-3.5 px-4 text-right">
                        {loc.status === LocationStatus.ACTIVE && (
                          <button
                            onClick={() => handleArchiveLocation(loc.id)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                          >
                            Archive
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Location Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Add New Operational Location</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="p-6 flex flex-col gap-4">
              {createError && (
                <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs text-red-700">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SF Substation Alpha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physical Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500 Howard Street, San Francisco, CA"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Latitude (-90 to 90) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="37.7749"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Longitude (-180 to 180) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="-122.4194"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Allowed Geofence Radius (meters) *
                </label>
                <input
                  type="number"
                  required
                  min="10"
                  max="50000"
                  value={allowedRadiusMeters}
                  onChange={(e) => setAllowedRadiusMeters(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Standard recommended radius is 100m–150m for industrial and commercial facilities.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Create Location'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

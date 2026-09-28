'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { getLocationService, getVisitService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Location,
  Visit,
  VisitStatus,
  LocationStatus,
  LocationVerificationResult,
  can,
  Permissions,
  UserRole,
} from '@fieldops/types';

interface MapPin {
  id: string;
  type: 'LOCATION_GEOFENCE' | 'VISIT_CHECKIN';
  title: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  accuracyMeters?: number;
  isWithinGeofence?: boolean;
  isException?: boolean;
  exceptionReason?: string;
  timestamp?: string;
  status?: string;
  linkHref?: string;
}

export default function OperationalMapPage() {
  const { activeRole } = useAuth();
  const { activeOrganization } = useOrganization();

  const role = activeRole || UserRole.FIELD_WORKER;
  const canViewMap = can(role, Permissions.LOCATION_VIEW_ALL) || can(role, Permissions.LOCATION_VIEW_TEAM);

  const [locations, setLocations] = useState<readonly Location[]>([]);
  const [visits, setVisits] = useState<readonly Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Display Modes
  const [viewMode, setViewMode] = useState<'MAP' | 'TABLE'>('MAP');
  const [showGeofences, setShowGeofences] = useState(true);
  const [showCheckins, setShowCheckins] = useState(true);
  const [onlyExceptions, setOnlyExceptions] = useState(false);

  // Map Navigation & Selected Marker
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  const loadOperationalData = useCallback(async () => {
    if (!activeOrganization) return;
    setIsLoading(true);
    setErrorMessage(null);

    const locationService = getLocationService();
    const visitService = getVisitService();

    try {
      const [locsRes, visitsRes] = await Promise.all([
        locationService.listLocations({ status: LocationStatus.ACTIVE }),
        visitService.listVisits(undefined, { page: 1, pageSize: 100 }),
      ]);

      setLocations(locsRes || []);
      setVisits(visitsRes.items || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load map data.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    loadOperationalData();
  }, [loadOperationalData]);

  // Transform into map pins
  const pins: MapPin[] = useMemo(() => {
    const list: MapPin[] = [];

    // 1. Locations
    if (showGeofences) {
      locations.forEach((loc) => {
        list.push({
          id: `loc-${loc.id}`,
          type: 'LOCATION_GEOFENCE',
          title: loc.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          radiusMeters: loc.allowedRadiusMeters,
          status: loc.status,
          linkHref: `/locations`,
        });
      });
    }

    // 2. Visits with point-in-time check-in coordinates
    if (showCheckins) {
      visits.forEach((v) => {
        // Look for check-in data or check-in location if recorded
        if (v.checkin) {
          const isWithin = v.checkin.verificationResult === LocationVerificationResult.VALID;
          const lowAccuracy = (v.checkin.accuracyMeters ?? 0) > 50;
          const isExc = v.checkin.isException || !isWithin || lowAccuracy;

          list.push({
            id: `visit-checkin-${v.id}`,
            type: 'VISIT_CHECKIN',
            title: `Check-in: Visit #${v.id.slice(0, 8)}`,
            latitude: v.checkin.latitude,
            longitude: v.checkin.longitude,
            accuracyMeters: v.checkin.accuracyMeters,
            isWithinGeofence: isWithin,
            isException: isExc,
            exceptionReason: v.checkin.exceptionReason,
            timestamp: v.checkin.clientCapturedAt,
            status: v.status,
            linkHref: `/visits/${v.id}`,
          });
        }
      });
    }

    if (onlyExceptions) {
      return list.filter((p) => p.isException);
    }

    return list;
  }, [locations, visits, showGeofences, showCheckins, onlyExceptions]);

  // Compute map bounding box
  const bounds = useMemo(() => {
    if (pins.length === 0) {
      return { minLat: 37.7, maxLat: 37.8, minLng: -122.5, maxLng: -122.4 };
    }
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;

    pins.forEach((p) => {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    });

    // Add padding margin
    const latSpan = Math.max(maxLat - minLat, 0.02);
    const lngSpan = Math.max(maxLng - minLng, 0.02);

    return {
      minLat: minLat - latSpan * 0.15,
      maxLat: maxLat + latSpan * 0.15,
      minLng: minLng - lngSpan * 0.15,
      maxLng: maxLng + lngSpan * 0.15,
    };
  }, [pins]);

  // Map lat/lng to normalized SVG percentage coordinates (0 - 100)
  const getCoordinates = (lat: number, lng: number) => {
    const latRange = bounds.maxLat - bounds.minLat || 1;
    const lngRange = bounds.maxLng - bounds.minLng || 1;

    // SVG: Y=0 at top, so higher latitude (north) corresponds to smaller Y
    const x = ((lng - bounds.minLng) / lngRange) * 100;
    const y = ((bounds.maxLat - lat) / latRange) * 100;

    return { x, y };
  };

  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Geospatial Operations
            </span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              POINT-IN-TIME PRIVACY ENFORCED
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
            Operational Live Map
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Inspect geofenced customer locations, discrete visit check-in events, and geofence exceptions.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-slate-100 p-0.5 text-xs">
            <button
              onClick={() => setViewMode('MAP')}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                viewMode === 'MAP'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-text-muted hover:text-primary'
              }`}
            >
              🗺️ Map View
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                viewMode === 'TABLE'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-text-muted hover:text-primary'
              }`}
            >
              📋 Accessible Table View
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showGeofences}
              onChange={(e) => setShowGeofences(e.target.checked)}
              className="rounded border-input text-brand-primary focus:ring-brand-primary"
            />
            <span>Geofenced Locations ({locations.length})</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showCheckins}
              onChange={(e) => setShowCheckins(e.target.checked)}
              className="rounded border-input text-brand-primary focus:ring-brand-primary"
            />
            <span>Visit Check-ins ({visits.filter((v) => v.checkin).length})</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-medium text-rose-700">
            <input
              type="checkbox"
              checked={onlyExceptions}
              onChange={(e) => setOnlyExceptions(e.target.checked)}
              className="rounded border-input text-rose-600 focus:ring-rose-500"
            />
            <span className="font-bold">Exceptions Only</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.5))}
            className="h-7 w-7 p-0 text-xs font-bold"
            title="Zoom In"
          >
            +
          </Button>
          <Button
            variant="secondary"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))}
            className="h-7 w-7 p-0 text-xs font-bold"
            title="Zoom Out"
          >
            -
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setZoomLevel(1);
              setSelectedPin(null);
            }}
            className="h-7 px-2 text-xs"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* Content View */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-xs text-text-muted">
          Loading geospatial telemetry...
        </div>
      ) : viewMode === 'MAP' ? (
        /* Visual Map Canvas / SVG Viewport */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="relative rounded-xl border border-border bg-slate-900 p-4 shadow-sm lg:col-span-3 overflow-hidden min-h-[500px]">
            {/* Map Canvas Background Grid */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #ffffff 1px, transparent 1px), radial-gradient(circle, #ffffff 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0, 12px 12px',
              }}
            />

            {/* Privacy Compliance Banner */}
            <div className="absolute top-4 left-4 z-10 rounded-md bg-slate-800/80 backdrop-blur border border-slate-700 px-2.5 py-1 text-[10px] text-slate-300">
              🔒 Event-Based Minimization (ADR-0020) • No Continuous Fleet Surveillance
            </div>

            {/* Interactive Pins Container */}
            <div
              className="relative w-full h-[460px] transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
            >
              {pins.map((pin) => {
                const { x, y } = getCoordinates(pin.latitude, pin.longitude);
                const isSelected = selectedPin?.id === pin.id;

                if (pin.type === 'LOCATION_GEOFENCE') {
                  return (
                    <div
                      key={pin.id}
                      onClick={() => setSelectedPin(pin)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      {/* Geofence circular radius */}
                      <div className="h-14 w-14 rounded-full border-2 border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center animate-pulse" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-md group-hover:scale-125 transition-transform" />
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap rounded bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        📍 {pin.title}
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={pin.id}
                      onClick={() => setSelectedPin(pin)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <div
                        className={`h-4 w-4 rounded-full border-2 border-white shadow-lg flex items-center justify-center group-hover:scale-150 transition-transform ${
                          pin.isException ? 'bg-rose-500' : 'bg-blue-500'
                        } ${isSelected ? 'ring-4 ring-brand-primary' : ''}`}
                      >
                        {pin.isException && <span className="text-[7px] text-white font-black">!</span>}
                      </div>
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap rounded bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        {pin.title}
                      </span>
                    </div>
                  );
                }
              })}
            </div>
          </div>

          {/* Selected Pin Details Inspector Card */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider pb-3 border-b border-border">
              Marker Inspector
            </h2>

            {selectedPin ? (
              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <span className="text-text-muted text-[10px] uppercase font-bold">Type</span>
                  <div className="mt-0.5 font-bold text-slate-800">
                    {selectedPin.type === 'LOCATION_GEOFENCE'
                      ? 'Geofenced Site'
                      : 'Field Visit Check-in'}
                  </div>
                </div>

                <div>
                  <span className="text-text-muted text-[10px] uppercase font-bold">Identifier</span>
                  <div className="mt-0.5 font-semibold text-primary">{selectedPin.title}</div>
                </div>

                <div>
                  <span className="text-text-muted text-[10px] uppercase font-bold">Point Coordinates</span>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                    Lat: {selectedPin.latitude.toFixed(6)} <br />
                    Lng: {selectedPin.longitude.toFixed(6)}
                  </div>
                </div>

                {selectedPin.radiusMeters && (
                  <div>
                    <span className="text-text-muted text-[10px] uppercase font-bold">
                      Allowed Geofence Radius
                    </span>
                    <div className="mt-0.5 font-semibold text-primary">
                      {selectedPin.radiusMeters} meters
                    </div>
                  </div>
                )}

                {selectedPin.accuracyMeters !== undefined && (
                  <div>
                    <span className="text-text-muted text-[10px] uppercase font-bold">
                      GPS Point Accuracy
                    </span>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-semibold text-primary">{selectedPin.accuracyMeters}m</span>
                      {selectedPin.accuracyMeters > 50 && (
                        <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800">
                          Low Precision
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {selectedPin.isException && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-900">
                    <strong className="block text-[11px] font-bold text-rose-800">
                      Geofence Exception Detected
                    </strong>
                    <p className="mt-1 text-[11px]">
                      {selectedPin.exceptionReason || 'Worker recorded check-in outside site geofence perimeter.'}
                    </p>
                  </div>
                )}

                {selectedPin.linkHref && (
                  <div className="pt-2">
                    <Link href={selectedPin.linkHref}>
                      <Button variant="primary" className="w-full text-xs">
                        Open Full Details →
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-text-muted">
                <p>Click on any marker on the map to inspect its geospatial verification data.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Accessible Table / List View */
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-slate-50 text-text-muted">
              <tr>
                <th className="px-6 py-3 font-semibold">Entity Type</th>
                <th className="px-4 py-3 font-semibold">Name / ID</th>
                <th className="px-4 py-3 font-semibold">Coordinates</th>
                <th className="px-4 py-3 font-semibold">Geofence / Accuracy</th>
                <th className="px-4 py-3 font-semibold">Status / Verification</th>
                <th className="px-6 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pins.map((pin) => (
                <tr key={pin.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        pin.type === 'LOCATION_GEOFENCE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {pin.type === 'LOCATION_GEOFENCE' ? 'Location' : 'Visit Check-in'}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-primary">{pin.title}</td>
                  <td className="px-4 py-4 font-mono text-[11px] text-slate-600">
                    {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {pin.radiusMeters ? `Radius: ${pin.radiusMeters}m` : `Accuracy: ±${pin.accuracyMeters}m`}
                  </td>
                  <td className="px-4 py-4">
                    {pin.isException ? (
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                        EXCEPTION OVERRIDE
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        VERIFIED
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {pin.linkHref && (
                      <Link href={pin.linkHref}>
                        <Button variant="secondary" className="h-7 px-2.5 text-xs">
                          View
                        </Button>
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

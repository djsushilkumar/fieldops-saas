'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { getVisitService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Visit,
  VisitStatus,
  VisitCheckin,
  VisitCheckout,
  VisitProof,
  VisitActivity,
  ProofType,
  LocationVerificationResult,
  can,
  Permissions,
  UserRole,
  VisitId,
} from '@fieldops/types';

export default function VisitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const visitId = (params?.id as string) as VisitId;

  const { user, activeRole } = useAuth();
  const { activeOrganization } = useOrganization();
  const visitService = getVisitService();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [proofs, setProofs] = useState<readonly VisitProof[]>([]);
  const [activities, setActivities] = useState<readonly VisitActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status Transition / Cancellation Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const role = activeRole || UserRole.FIELD_WORKER;
  const canCancelVisit = can(role, Permissions.VISIT_CANCEL);
  const canUpdateVisit = can(role, Permissions.VISIT_UPDATE);

  const fetchVisitDetails = useCallback(async () => {
    if (!visitId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [visitData, proofsData, activitiesData] = await Promise.all([
        visitService.getVisit(visitId),
        visitService.listProofs(visitId).catch(() => []),
        visitService.listActivities(visitId).catch(() => []),
      ]);
      setVisit(visitData);
      setProofs(proofsData);
      setActivities(activitiesData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load visit details.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    if (activeOrganization && visitId) {
      fetchVisitDetails();
    }
  }, [activeOrganization, visitId, fetchVisitDetails]);

  const handleCancelVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;
    setIsTransitioning(true);
    try {
      await visitService.transitionStatus(visitId, {
        status: VisitStatus.CANCELED,
        cancelReason: cancelReason.trim(),
        expectedVersion: visit?.version,
      });
      setIsCancelModalOpen(false);
      setCancelReason('');
      fetchVisitDetails();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel visit.';
      alert(msg);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleCompleteVisit = async () => {
    if (!confirm('Confirm operational completion of this field visit?')) return;
    setIsTransitioning(true);
    try {
      await visitService.transitionStatus(visitId, {
        status: VisitStatus.COMPLETED,
        expectedVersion: visit?.version,
      });
      fetchVisitDetails();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete visit.';
      alert(msg);
    } finally {
      setIsTransitioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center text-sm text-slate-500">
        Loading field visit details...
      </div>
    );
  }

  if (errorMessage || !visit) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col gap-4">
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700">
          {errorMessage || 'Visit not found.'}
        </div>
        <Link href="/visits" className="text-xs text-blue-600 font-semibold hover:underline">
          ← Back to Visits
        </Link>
      </div>
    );
  }

  const checkin = visit.checkin;
  const checkout = visit.checkout;

  return (
    <div className="flex flex-col gap-6 p-8 max-w-7xl mx-auto">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/visits"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          ← Back to Visits
        </Link>
        <div className="flex items-center gap-3">
          {canUpdateVisit && visit.status === VisitStatus.CHECKED_OUT && (
            <Button onClick={handleCompleteVisit} disabled={isTransitioning} className="bg-emerald-600 hover:bg-emerald-700">
              Complete Visit
            </Button>
          )}
          {canCancelVisit &&
            visit.status !== VisitStatus.COMPLETED &&
            visit.status !== VisitStatus.CANCELED && (
              <Button
                variant="secondary"
                onClick={() => setIsCancelModalOpen(true)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                Cancel Visit
              </Button>
            )}
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-slate-500">
              Visit #{visit.id.slice(0, 8)}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                visit.status === VisitStatus.COMPLETED
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : visit.status === VisitStatus.CHECKED_IN || visit.status === VisitStatus.IN_PROGRESS
                  ? 'bg-teal-50 text-teal-700 border-teal-200'
                  : visit.status === VisitStatus.CANCELED
                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {visit.status}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-2">
            {visit.location ? visit.location.name : 'Authorized Operational Site'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {visit.location?.address || 'No physical address provided'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 text-xs text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <div>
            <span className="block text-[11px] text-slate-400 font-medium">Scheduled Window</span>
            <span className="font-semibold text-slate-800">
              {new Date(visit.scheduledStart).toLocaleDateString()} {new Date(visit.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {visit.scheduledEnd && (
              <span className="block text-slate-500 text-[10px]">
                until {new Date(visit.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-6">
            <span className="block text-[11px] text-slate-400 font-medium">Assigned Worker</span>
            <span className="font-semibold text-slate-800">
              {visit.assignee ? visit.assignee.fullName : visit.assignedTo ? 'Field Worker' : 'Unassigned'}
            </span>
          </div>
          {visit.taskId && (
            <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-6">
              <span className="block text-[11px] text-slate-400 font-medium">Linked Task</span>
              <Link href={`/tasks/${visit.taskId}`} className="font-semibold text-blue-600 hover:underline">
                View Task #{visit.taskId.slice(0, 8)} →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Grid: GPS Verification & Proof of Work */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GPS Check-In & Departure Panel */}
        <div className="flex flex-col gap-6">
          {/* Check-In Card */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>📍 Check-In Verification</span>
              </h2>
              {checkin && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    checkin.verificationResult === LocationVerificationResult.VALID
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {checkin.verificationResult}
                </span>
              )}
            </div>

            {checkin ? (
              <div className="flex flex-col gap-4 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-[11px]">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-sans">Coordinates</span>
                    <span>{checkin.latitude.toFixed(6)}, {checkin.longitude.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-sans">Accuracy</span>
                    <span>±{Math.round(checkin.accuracyMeters)}m</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-sans">Target Distance</span>
                    <span className={checkin.distanceMeters > (visit.location?.allowedRadiusMeters || 100) ? 'text-amber-600 font-bold' : 'text-emerald-700 font-bold'}>
                      {Math.round(checkin.distanceMeters)}m away (allowed: {visit.location?.allowedRadiusMeters || 100}m)
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-sans">Time Recorded</span>
                    <span>{new Date(checkin.clientCapturedAt).toLocaleTimeString()}</span>
                  </div>
                </div>

                {checkin.isException && (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-amber-800">
                    <span className="font-bold text-[11px] block mb-0.5">⚠️ Geofence Exception Override</span>
                    <p className="text-xs">{checkin.exceptionReason || 'No reason provided.'}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                Check-in has not been performed yet.
              </div>
            )}
          </div>

          {/* Check-Out Card */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>🚪 Check-Out Departure Stamp</span>
              </h2>
              {checkout && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  RECORDED
                </span>
              )}
            </div>

            {checkout ? (
              <div className="flex flex-col gap-3 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-[11px]">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-sans">Departure Time</span>
                    <span>{new Date(checkout.clientCapturedAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-sans">Accuracy</span>
                    <span>±{Math.round(checkout.accuracyMeters)}m</span>
                  </div>
                </div>
                {checkout.notes && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="block text-[10px] text-slate-400 font-semibold mb-1">Departure Notes</span>
                    <p className="text-xs text-slate-800">{checkout.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                Check-out has not been performed yet.
              </div>
            )}
          </div>
        </div>

        {/* Proof of Work & Activities Panel */}
        <div className="flex flex-col gap-6">
          {/* Proof of Work Card */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900">Proof of Work Evidence ({proofs.length})</h2>
            </div>

            {proofs.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No proof items submitted yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {proofs.map((proof) => (
                  <div
                    key={proof.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex flex-col gap-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{proof.proofType}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(proof.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {proof.proofType === ProofType.PHOTO && proof.storagePath && (
                      <div className="bg-slate-200 rounded h-28 flex items-center justify-center text-slate-500 font-mono text-[10px] p-2 text-center overflow-hidden">
                        📷 [Photo: {proof.fileName || proof.storagePath.split('/').pop()}]
                      </div>
                    )}

                    {proof.proofType === ProofType.SIGNATURE && (
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-[10px] text-slate-400 block font-semibold">Signer:</span>
                        <span className="font-bold text-slate-900">{proof.signerName || 'Customer'}</span>
                      </div>
                    )}

                    {proof.notes && (
                      <p className="text-slate-600 bg-white p-2 rounded border border-slate-100 text-[11px]">
                        {proof.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Append-Only Activity Timeline */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900">Audit & Activity Timeline</h2>
              <span className="text-[11px] text-slate-400">Append-only operational event ledger</span>
            </div>

            {activities.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No activity recorded yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{act.action}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(act.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      {Object.keys(act.details || {}).length > 0 && (
                        <pre className="text-[10px] bg-slate-50 text-slate-600 p-2 rounded mt-1 font-mono overflow-x-auto">
                          {JSON.stringify(act.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Visit Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Cancel Field Visit</h2>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCancelVisit} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specify reason for visit cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCancelModalOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  disabled={isTransitioning || !cancelReason.trim()}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  {isTransitioning ? 'Canceling...' : 'Confirm Cancellation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

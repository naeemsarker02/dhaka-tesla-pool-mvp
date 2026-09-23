"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "../../../components/RequireAuth";
import { NavBar } from "../../../components/NavBar";
import { StatusStepper } from "../../../components/StatusStepper";
import { FareDisplay } from "../../../components/FareDisplay";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { CardSkeleton } from "../../../components/Skeleton";
import { useAuth } from "../../../lib/AuthContext";
import { apiFetch, ApiError } from "../../../lib/api";
import { formatPaisa } from "../../../lib/format";

const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED"];
const CANCELLABLE_STATUSES = ["REQUESTED", "MATCHED"];
const POLL_INTERVAL_MS = 5000;
// Mirrors the backend's default GRACE_WINDOW_SECONDS (MASTER_PLAN.md Section 6.2) — display-only
// heads-up, not authoritative. The server computes the real late_cancellation/fee at cancel time;
// if a deployment overrides GRACE_WINDOW_SECONDS via env, this warning's timing won't match
// exactly. Not worth a new endpoint just to mirror one constant (see docs/decisions.md).
const GRACE_WINDOW_SECONDS = 60;

export default function RideDetailPage() {
  return (
    <RequireAuth role="PASSENGER">
      <NavBar />
      <RideDetail />
    </RequireAuth>
  );
}

function RideDetail() {
  const { id } = useParams();
  const { token } = useAuth();

  const [ride, setRide] = useState(null);
  const [error, setError] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const load = useCallback(() => {
    apiFetch(`/api/rides/${id}`, { token })
      .then((data) => {
        setRide(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this ride."));
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the ride is still moving through the lifecycle — stop once it's terminal.
  useEffect(() => {
    if (!ride || TERMINAL_STATUSES.includes(ride.status)) return undefined;
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ride, load]);

  async function handleCancel() {
    setCancelError(null);
    setIsCancelling(true);
    try {
      const updated = await apiFetch(`/api/rides/${id}/cancel`, { method: "POST", token });
      setRide((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : "Could not cancel this ride.");
    } finally {
      setIsCancelling(false);
    }
  }

  const isPastGraceWindow =
    ride?.status === "MATCHED" &&
    ride?.matchedAt &&
    (Date.now() - new Date(ride.matchedAt).getTime()) / 1000 > GRACE_WINDOW_SECONDS;

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Ride status</h1>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!ride && !error && <CardSkeleton lines={4} />}

      {ride && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-lg font-medium text-slate-900">
              {ride.pickupZone.name} → {ride.destinationZone.name}
            </p>
            <p className="text-sm text-slate-500">{ride.seatsRequested} seat(s)</p>
          </div>

          <StatusStepper status={ride.status} />

          <div className="border-t border-slate-100 pt-4">
            <FareDisplay estimatedFarePaisa={ride.estimatedFarePaisa} farePaisa={ride.farePaisa} />
          </div>

          {ride.status === "CANCELLED" && ride.lateCancellation && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-700/10">
              <p className="font-medium">Cancelled after the free-cancellation window</p>
              <p className="mt-0.5">
                A late-cancellation fee of {formatPaisa(ride.cancellationFeePaisa)} was recorded
                (not charged — no payment gateway in this MVP).
              </p>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Requested {new Date(ride.requestedAt).toLocaleString()}
          </p>

          {cancelError && <ErrorBanner>{cancelError}</ErrorBanner>}

          {CANCELLABLE_STATUSES.includes(ride.status) && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              {isPastGraceWindow && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-700/10">
                  It's been over a minute since you were matched — cancelling now may be flagged as
                  a late cancellation with a recorded (not charged) fee.
                </p>
              )}
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCancelling ? "Cancelling…" : "Cancel this ride"}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

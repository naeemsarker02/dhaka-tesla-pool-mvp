"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "../../../components/RequireAuth";
import { NavBar } from "../../../components/NavBar";
import { StatusBadge } from "../../../components/StatusBadge";
import { useAuth } from "../../../lib/AuthContext";
import { apiFetch, ApiError } from "../../../lib/api";
import { formatPaisa } from "../../../lib/format";

const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED"];
const CANCELLABLE_STATUSES = ["REQUESTED", "MATCHED"];
const POLL_INTERVAL_MS = 5000;

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

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Ride status</h1>

      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!ride && !error && <p className="text-slate-500">Loading…</p>}

      {ride && (
        <div className="space-y-4 rounded border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-medium">
              {ride.pickupZone.name} → {ride.destinationZone.name}
            </p>
            <StatusBadge status={ride.status} />
          </div>

          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Seats</dt>
            <dd>{ride.seatsRequested}</dd>

            <dt className="text-slate-500">Estimated fare</dt>
            <dd>{formatPaisa(ride.estimatedFarePaisa)}</dd>

            <dt className="text-slate-500">Final fare</dt>
            <dd>
              {ride.farePaisa === null
                ? "Not finalized yet — set when a driver accepts your pool"
                : formatPaisa(ride.farePaisa)}
            </dd>

            <dt className="text-slate-500">Requested</dt>
            <dd>{new Date(ride.requestedAt).toLocaleString()}</dd>
          </dl>

          {cancelError && (
            <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {cancelError}
            </p>
          )}

          {CANCELLABLE_STATUSES.includes(ride.status) && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="w-full rounded border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {isCancelling ? "Cancelling…" : "Cancel this ride"}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

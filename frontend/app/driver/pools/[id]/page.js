"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "../../../../components/RequireAuth";
import { NavBar } from "../../../../components/NavBar";
import { StatusBadge } from "../../../../components/StatusBadge";
import { StatusStepper } from "../../../../components/StatusStepper";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import { CardSkeleton } from "../../../../components/Skeleton";
import { useAuth } from "../../../../lib/AuthContext";
import { apiFetch, ApiError } from "../../../../lib/api";
import { formatPaisa } from "../../../../lib/format";

// The single next valid step for each pool status — MATCHED->DRIVER_ARRIVED->STARTED->COMPLETED
// (backend/src/lib/stateMachine.js POOL_TRANSITIONS). No skipping allowed, so the UI only ever
// offers the one legal next action.
const NEXT_STATUS = {
  MATCHED: "DRIVER_ARRIVED",
  DRIVER_ARRIVED: "STARTED",
  STARTED: "COMPLETED",
};

const NEXT_ACTION_LABEL = {
  DRIVER_ARRIVED: "I've arrived",
  STARTED: "Start trip",
  COMPLETED: "Complete trip",
};

export default function PoolDetailPage() {
  return (
    <RequireAuth role="DRIVER">
      <NavBar />
      <PoolDetail />
    </RequireAuth>
  );
}

function PoolDetail() {
  const { id } = useParams();
  const { token } = useAuth();

  const [pool, setPool] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const load = useCallback(() => {
    apiFetch(`/api/driver/pools/${id}`, { token })
      .then((data) => {
        setPool(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this pool."));
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdvance() {
    const nextStatus = NEXT_STATUS[pool.status];
    if (!nextStatus) return;

    setIsAdvancing(true);
    setActionError(null);
    try {
      const updated = await apiFetch(`/api/driver/pools/${id}/status`, {
        method: "PATCH",
        token,
        body: { status: nextStatus },
      });
      setPool((prev) => ({ ...prev, ...updated }));
      load(); // refetch for the updated per-member statuses/fares
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update pool status.");
    } finally {
      setIsAdvancing(false);
    }
  }

  const nextStatus = pool && NEXT_STATUS[pool.status];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Pool details</h1>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!pool && !error && <CardSkeleton lines={4} />}

      {pool && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{pool.seatsOccupied} seat(s) occupied</p>
                <p className="text-xs text-slate-400">Created {new Date(pool.createdAt).toLocaleString()}</p>
              </div>
              <StatusBadge status={pool.status} />
            </div>
            <StatusStepper status={pool.status} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Passengers
            </h2>
            <ul className="divide-y divide-slate-100">
              {pool.memberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {m.rideRequest.pickupZone.name} → {m.rideRequest.destinationZone.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {m.seats} seat{m.seats === 1 ? "" : "s"} ·{" "}
                      {m.rideRequest.farePaisa === null
                        ? `Est. ${formatPaisa(m.rideRequest.estimatedFarePaisa)}`
                        : formatPaisa(m.rideRequest.farePaisa)}
                    </p>
                  </div>
                  <StatusBadge status={m.rideRequest.status} />
                </li>
              ))}
            </ul>
          </div>

          {actionError && <ErrorBanner>{actionError}</ErrorBanner>}

          {nextStatus && (
            <button
              type="button"
              onClick={handleAdvance}
              disabled={isAdvancing}
              className="sticky bottom-4 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdvancing ? "Updating…" : NEXT_ACTION_LABEL[nextStatus]}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

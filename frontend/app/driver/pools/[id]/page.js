"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "../../../../components/RequireAuth";
import { NavBar } from "../../../../components/NavBar";
import { StatusBadge } from "../../../../components/StatusBadge";
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Pool details</h1>

      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!pool && !error && <p className="text-slate-500">Loading…</p>}

      {pool && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded border border-slate-200 bg-white p-4">
            <div>
              <p className="font-medium">{pool.seatsOccupied} seat(s) occupied</p>
              <p className="text-sm text-slate-500">
                Created {new Date(pool.createdAt).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={pool.status} />
          </div>

          <div className="rounded border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-semibold">Passengers</h2>
            <ul className="space-y-2 text-sm">
              {pool.memberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
                  <div>
                    <p>
                      {m.rideRequest.pickupZone.name} → {m.rideRequest.destinationZone.name} ·{" "}
                      {m.seats} seat{m.seats === 1 ? "" : "s"}
                    </p>
                    <p className="text-slate-500">
                      {m.rideRequest.farePaisa === null
                        ? `Estimated ${formatPaisa(m.rideRequest.estimatedFarePaisa)}`
                        : `Fare ${formatPaisa(m.rideRequest.farePaisa)}`}
                    </p>
                  </div>
                  <StatusBadge status={m.rideRequest.status} />
                </li>
              ))}
            </ul>
          </div>

          {actionError && (
            <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}

          {NEXT_STATUS[pool.status] && (
            <button
              type="button"
              onClick={handleAdvance}
              disabled={isAdvancing}
              className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {isAdvancing ? "Updating…" : `Mark as ${NEXT_STATUS[pool.status]}`}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

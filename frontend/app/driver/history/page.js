"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "../../../components/RequireAuth";
import { NavBar } from "../../../components/NavBar";
import { StatusBadge } from "../../../components/StatusBadge";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { EmptyState } from "../../../components/EmptyState";
import { ListSkeleton } from "../../../components/Skeleton";
import { useAuth } from "../../../lib/AuthContext";
import { apiFetch, ApiError } from "../../../lib/api";

export default function DriverHistoryPage() {
  return (
    <RequireAuth role="DRIVER">
      <NavBar />
      <DriverHistory />
    </RequireAuth>
  );
}

function DriverHistory() {
  const { token } = useAuth();
  const [pools, setPools] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/driver/history", { token })
      .then(setPools)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load history."));
  }, [token]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Trip history</h1>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!pools && !error && <ListSkeleton />}

      {pools && pools.length === 0 && (
        <EmptyState
          title="No trips yet"
          description="Accepted pools will show up here once you've driven them."
        />
      )}

      {pools && pools.length > 0 && (
        <ul className="space-y-2.5">
          {pools.map((pool) => (
            <li key={pool.id}>
              <Link
                href={`/driver/pools/${pool.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {pool.memberships
                      .map((m) => `${m.rideRequest.pickupZone.name} → ${m.rideRequest.destinationZone.name}`)
                      .join(", ")}
                  </p>
                  <p className="text-sm text-slate-500">
                    {new Date(pool.createdAt).toLocaleString()} · {pool.memberships.length} passenger
                    {pool.memberships.length === 1 ? "" : "s"}
                  </p>
                </div>
                <StatusBadge status={pool.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

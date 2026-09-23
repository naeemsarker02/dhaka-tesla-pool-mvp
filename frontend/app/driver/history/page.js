"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "../../../components/RequireAuth";
import { NavBar } from "../../../components/NavBar";
import { StatusBadge } from "../../../components/StatusBadge";
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
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Trip history</h1>

      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!pools && !error && <p className="text-slate-500">Loading…</p>}

      {pools && pools.length === 0 && <p className="text-slate-500">No trips yet.</p>}

      {pools && pools.length > 0 && (
        <ul className="space-y-3">
          {pools.map((pool) => (
            <li key={pool.id}>
              <Link
                href={`/driver/pools/${pool.id}`}
                className="flex items-center justify-between rounded border border-slate-200 bg-white px-4 py-3 hover:border-slate-400"
              >
                <div>
                  <p className="font-medium">
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

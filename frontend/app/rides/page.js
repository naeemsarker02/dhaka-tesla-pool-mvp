"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "../../components/RequireAuth";
import { NavBar } from "../../components/NavBar";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../lib/AuthContext";
import { apiFetch, ApiError } from "../../lib/api";
import { formatPaisa } from "../../lib/format";

export default function RideHistoryPage() {
  return (
    <RequireAuth role="PASSENGER">
      <NavBar />
      <RideHistory />
    </RequireAuth>
  );
}

function RideHistory() {
  const { token } = useAuth();
  const [rides, setRides] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/rides", { token })
      .then(setRides)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your rides."));
  }, [token]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My rides</h1>
        <Link href="/rides/new" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          Request a ride
        </Link>
      </div>

      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!rides && !error && <p className="text-slate-500">Loading your rides…</p>}

      {rides && rides.length === 0 && (
        <p className="text-slate-500">
          You haven&apos;t requested any rides yet.{" "}
          <Link href="/rides/new" className="underline">
            Request one now
          </Link>
          .
        </p>
      )}

      {rides && rides.length > 0 && (
        <ul className="space-y-3">
          {rides.map((ride) => (
            <li key={ride.id}>
              <Link
                href={`/rides/${ride.id}`}
                className="flex items-center justify-between rounded border border-slate-200 bg-white px-4 py-3 hover:border-slate-400"
              >
                <div>
                  <p className="font-medium">
                    {ride.pickupZone.name} → {ride.destinationZone.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {new Date(ride.requestedAt).toLocaleString()} ·{" "}
                    {formatPaisa(ride.farePaisa ?? ride.estimatedFarePaisa)}
                    {ride.farePaisa === null && " (estimated)"}
                  </p>
                </div>
                <StatusBadge status={ride.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "../../components/RequireAuth";
import { NavBar } from "../../components/NavBar";
import { StatusBadge } from "../../components/StatusBadge";
import { ErrorBanner } from "../../components/ErrorBanner";
import { EmptyState } from "../../components/EmptyState";
import { ListSkeleton } from "../../components/Skeleton";
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
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">My rides</h1>
        <Link
          href="/rides/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          Request a ride
        </Link>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!rides && !error && <ListSkeleton />}

      {rides && rides.length === 0 && (
        <EmptyState
          title="No rides yet"
          description="Once you request a ride, it'll show up here with its live status and fare."
          action={
            <Link
              href="/rides/new"
              className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Request your first ride
            </Link>
          }
        />
      )}

      {rides && rides.length > 0 && (
        <ul className="space-y-2.5">
          {rides.map((ride) => (
            <li key={ride.id}>
              <Link
                href={`/rides/${ride.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
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

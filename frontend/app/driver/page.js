"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "../../components/RequireAuth";
import { NavBar } from "../../components/NavBar";
import { StatusBadge } from "../../components/StatusBadge";
import { SeatOccupancy } from "../../components/SeatOccupancy";
import { ErrorBanner } from "../../components/ErrorBanner";
import { EmptyState } from "../../components/EmptyState";
import { CardSkeleton, ListSkeleton } from "../../components/Skeleton";
import { useAuth } from "../../lib/AuthContext";
import { apiFetch, ApiError } from "../../lib/api";
import { formatPaisa } from "../../lib/format";

export default function DriverDashboardPage() {
  return (
    <RequireAuth role="DRIVER">
      <NavBar />
      <DriverDashboard />
    </RequireAuth>
  );
}

function DriverDashboard() {
  const { token } = useAuth();

  const [tesla, setTesla] = useState(undefined); // undefined = loading, null = none registered
  const [teslaError, setTeslaError] = useState(null);
  const [pools, setPools] = useState(null);
  const [poolsError, setPoolsError] = useState(null);
  const [isToggling, setIsToggling] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  function loadTesla() {
    apiFetch("/api/teslas/me", { token })
      .then(setTesla)
      .catch((err) => setTeslaError(err instanceof ApiError ? err.message : "Could not load your Tesla."));
  }

  function loadPools() {
    apiFetch("/api/driver/requests", { token })
      .then(setPools)
      .catch((err) => setPoolsError(err instanceof ApiError ? err.message : "Could not load pending requests."));
  }

  useEffect(() => {
    loadTesla();
    loadPools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleToggle() {
    setIsToggling(true);
    setActionError(null);
    try {
      const nextStatus = tesla.status === "ONLINE" ? "OFFLINE" : "ONLINE";
      const updated = await apiFetch(`/api/teslas/${tesla.id}/status`, {
        method: "PATCH",
        token,
        body: { status: nextStatus },
      });
      setTesla(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update Tesla status.");
    } finally {
      setIsToggling(false);
    }
  }

  async function handleAccept(poolId) {
    setAcceptingId(poolId);
    setActionError(null);
    try {
      await apiFetch(`/api/driver/pools/${poolId}/accept`, { method: "POST", token });
      loadPools();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not accept this pool.");
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Driver console</h1>

      {teslaError && <div className="mb-6"><ErrorBanner>{teslaError}</ErrorBanner></div>}

      {tesla === undefined && !teslaError && <div className="mb-8"><CardSkeleton lines={1} /></div>}

      {tesla === null && <RegisterTeslaForm token={token} onRegistered={setTesla} />}

      {tesla && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="font-medium text-slate-900">{tesla.name}</p>
            <p className="text-sm text-slate-500">Capacity {tesla.capacity}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={tesla.status} />
            <button
              type="button"
              onClick={handleToggle}
              disabled={isToggling}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isToggling ? "Updating…" : tesla.status === "ONLINE" ? "Go offline" : "Go online"}
            </button>
          </div>
        </div>
      )}

      {actionError && <div className="mb-4"><ErrorBanner>{actionError}</ErrorBanner></div>}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Pending pools
      </h2>

      {poolsError && <ErrorBanner>{poolsError}</ErrorBanner>}

      {!pools && !poolsError && <ListSkeleton count={2} />}

      {pools && pools.length === 0 && (
        <EmptyState
          title="No pending requests"
          description="New ride requests that match your route will show up here for you to accept."
        />
      )}

      {pools && pools.length > 0 && (
        <ul className="space-y-3">
          {pools.map((pool) => {
            const estimatedTotal = pool.memberships.reduce(
              (sum, m) => sum + m.rideRequest.estimatedFarePaisa,
              0
            );
            return (
              <li key={pool.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={pool.status} />
                  <SeatOccupancy occupied={pool.seatsOccupied} capacity={tesla?.capacity ?? pool.seatsOccupied} />
                </div>
                <ul className="mb-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {pool.memberships.map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-slate-700">
                        {m.rideRequest.pickupZone.name} → {m.rideRequest.destinationZone.name}
                      </span>
                      <span className="text-slate-500">{formatPaisa(m.rideRequest.estimatedFarePaisa)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Estimated total</span>
                  <span className="font-medium text-slate-900">{formatPaisa(estimatedTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAccept(pool.id)}
                    disabled={acceptingId === pool.id}
                    className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {acceptingId === pool.id ? "Accepting…" : "Accept pool"}
                  </button>
                  <Link
                    href={`/driver/pools/${pool.id}`}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    View details
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function RegisterTeslaForm({ token, onRegistered }) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const tesla = await apiFetch("/api/teslas", {
        method: "POST",
        token,
        body: { name, capacity: Number(capacity) },
      });
      onRegistered(tesla);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register your Tesla.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <p className="text-sm text-slate-600">You haven&apos;t registered a Tesla yet.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Name (e.g. Bullet)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-24"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Registering…" : "Register"}
        </button>
      </div>
      {error && <ErrorBanner>{error}</ErrorBanner>}
    </form>
  );
}

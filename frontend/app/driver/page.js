"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "../../components/RequireAuth";
import { NavBar } from "../../components/NavBar";
import { StatusBadge } from "../../components/StatusBadge";
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
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Driver console</h1>

      {teslaError && (
        <p role="alert" className="mb-6 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {teslaError}
        </p>
      )}

      {tesla === undefined && !teslaError && <p className="text-slate-500">Loading your Tesla…</p>}

      {tesla === null && <RegisterTeslaForm token={token} onRegistered={setTesla} />}

      {tesla && (
        <div className="mb-8 flex items-center justify-between rounded border border-slate-200 bg-white p-4">
          <div>
            <p className="font-medium">{tesla.name}</p>
            <p className="text-sm text-slate-500">Capacity {tesla.capacity}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={tesla.status} />
            <button
              type="button"
              onClick={handleToggle}
              disabled={isToggling}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              {isToggling ? "Updating…" : tesla.status === "ONLINE" ? "Go offline" : "Go online"}
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <p role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      <h2 className="mb-3 text-lg font-semibold">Pending pools</h2>

      {poolsError && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {poolsError}
        </p>
      )}

      {!pools && !poolsError && <p className="text-slate-500">Loading…</p>}

      {pools && pools.length === 0 && (
        <p className="text-slate-500">No pending requests right now.</p>
      )}

      {pools && pools.length > 0 && (
        <ul className="space-y-3">
          {pools.map((pool) => (
            <li key={pool.id} className="rounded border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <StatusBadge status={pool.status} />
                <span className="text-sm text-slate-500">
                  {pool.seatsOccupied} seat{pool.seatsOccupied === 1 ? "" : "s"} occupied
                </span>
              </div>
              <ul className="mb-3 space-y-1 text-sm">
                {pool.memberships.map((m) => (
                  <li key={m.id}>
                    {m.rideRequest.pickupZone.name} → {m.rideRequest.destinationZone.name} ·{" "}
                    {formatPaisa(m.rideRequest.estimatedFarePaisa)} (est.)
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleAccept(pool.id)}
                  disabled={acceptingId === pool.id}
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {acceptingId === pool.id ? "Accepting…" : "Accept pool"}
                </button>
                <Link
                  href={`/driver/pools/${pool.id}`}
                  className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
                >
                  View details
                </Link>
              </div>
            </li>
          ))}
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
    <form onSubmit={handleSubmit} className="mb-8 space-y-3 rounded border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">You haven&apos;t registered a Tesla yet.</p>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Name (e.g. Bullet)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="flex-1 rounded border border-slate-300 px-3 py-2"
        />
        <input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
          className="w-24 rounded border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Registering…" : "Register"}
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

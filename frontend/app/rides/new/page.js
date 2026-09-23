"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../../components/RequireAuth";
import { NavBar } from "../../../components/NavBar";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { EmptyState } from "../../../components/EmptyState";
import { useAuth } from "../../../lib/AuthContext";
import { apiFetch, ApiError } from "../../../lib/api";

export default function NewRidePage() {
  return (
    <RequireAuth role="PASSENGER">
      <NavBar />
      <NewRideForm />
    </RequireAuth>
  );
}

const selectClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function NewRideForm() {
  const { token } = useAuth();
  const router = useRouter();

  const [zones, setZones] = useState(null);
  const [zonesError, setZonesError] = useState(null);
  const [pickupZoneId, setPickupZoneId] = useState("");
  const [destinationZoneId, setDestinationZoneId] = useState("");
  const [seatsRequested, setSeatsRequested] = useState(1);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiFetch("/api/zones")
      .then((data) => {
        setZones(data);
        if (data.length >= 2) {
          setPickupZoneId(data[0].id);
          setDestinationZoneId(data[1].id);
        }
      })
      .catch((err) => setZonesError(err instanceof ApiError ? err.message : "Could not load zones."));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const rideRequest = await apiFetch("/api/rides", {
        method: "POST",
        token,
        body: { pickupZoneId, destinationZoneId, seatsRequested: Number(seatsRequested) },
      });
      router.push(`/rides/${rideRequest.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Request a ride</h1>
      <p className="mb-6 text-sm text-slate-500">Pick your route — we'll show the estimated fare instantly.</p>

      {zonesError && <ErrorBanner>{zonesError}</ErrorBanner>}

      {!zones && !zonesError && (
        <div className="animate-pulse space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-9 rounded-lg bg-slate-100" />
          <div className="h-9 rounded-lg bg-slate-100" />
          <div className="h-9 rounded-lg bg-slate-100" />
        </div>
      )}

      {zones && zones.length === 0 && (
        <EmptyState title="No zones available" description="Please check back later." />
      )}

      {zones && zones.length > 0 && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Pickup zone</label>
            <select
              value={pickupZoneId}
              onChange={(e) => setPickupZoneId(e.target.value)}
              className={selectClass}
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Destination zone</label>
            <select
              value={destinationZoneId}
              onChange={(e) => setDestinationZoneId(e.target.value)}
              className={selectClass}
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Seats</label>
            <input
              type="number"
              min={1}
              max={3}
              value={seatsRequested}
              onChange={(e) => setSeatsRequested(e.target.value)}
              className={selectClass}
            />
          </div>

          {submitError && <ErrorBanner>{submitError}</ErrorBanner>}

          {pickupZoneId === destinationZoneId && (
            <p className="text-xs font-medium text-red-600">Pickup and destination must be different zones.</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || pickupZoneId === destinationZoneId}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Requesting…" : "Request ride"}
          </button>
        </form>
      )}
    </main>
  );
}

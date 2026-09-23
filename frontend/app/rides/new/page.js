"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../../components/RequireAuth";
import { NavBar } from "../../../components/NavBar";
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
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Request a ride</h1>

      {zonesError && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {zonesError}
        </p>
      )}

      {!zones && !zonesError && <p className="text-slate-500">Loading zones…</p>}

      {zones && zones.length === 0 && (
        <p className="text-slate-500">No zones are available yet. Please check back later.</p>
      )}

      {zones && zones.length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Pickup zone</label>
            <select
              value={pickupZoneId}
              onChange={(e) => setPickupZoneId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
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
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
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
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>

          {submitError && (
            <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || pickupZoneId === destinationZoneId}
            className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {isSubmitting ? "Requesting…" : "Request ride"}
          </button>
          {pickupZoneId === destinationZoneId && (
            <p className="text-xs text-red-600">Pickup and destination must be different zones.</p>
          )}
        </form>
      )}
    </main>
  );
}

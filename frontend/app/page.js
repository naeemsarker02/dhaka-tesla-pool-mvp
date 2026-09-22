"use client";

import Link from "next/link";
import { NavBar } from "../components/NavBar";
import { useAuth } from "../lib/AuthContext";

export default function HomePage() {
  const { user, isLoading } = useAuth();

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-3xl font-bold">Dhaka Tesla Pool</h1>
        <p className="mt-3 text-slate-600">
          Ride-pooling MVP — passengers share a Tesla trip, drivers see one clear manifest.
        </p>

        {isLoading ? null : user ? (
          <Link
            href={user.role === "DRIVER" ? "/driver" : "/rides"}
            className="mt-8 inline-block rounded bg-slate-900 px-6 py-3 text-white"
          >
            Go to {user.role === "DRIVER" ? "Driver Console" : "My Rides"}
          </Link>
        ) : (
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/login" className="rounded border border-slate-300 px-6 py-3">
              Log in
            </Link>
            <Link href="/signup" className="rounded bg-slate-900 px-6 py-3 text-white">
              Sign up
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

"use client";

import Link from "next/link";
import { NavBar } from "../components/NavBar";
import { useAuth } from "../lib/AuthContext";

export default function HomePage() {
  const { user, isLoading } = useAuth();

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Dhaka Tesla Pool
        </h1>
        <p className="mx-auto mt-3 max-w-md text-slate-600">
          Share a seat. Split the fare. Survive Dhaka traffic — passengers share a Tesla trip,
          drivers see one clear manifest.
        </p>

        {isLoading ? (
          <div className="mx-auto mt-8 h-11 w-40 animate-pulse rounded-lg bg-slate-200" />
        ) : user ? (
          <Link
            href={user.role === "DRIVER" ? "/driver" : "/rides"}
            className="mt-8 inline-block rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            Go to {user.role === "DRIVER" ? "Driver Console" : "My Rides"}
          </Link>
        ) : (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              Sign up
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";

export function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight text-slate-900">
          Dhaka Tesla Pool
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {user?.role === "PASSENGER" && (
            <>
              <Link href="/rides" className="text-slate-600 hover:text-slate-900">
                My Rides
              </Link>
              <Link href="/rides/new" className="text-slate-600 hover:text-slate-900">
                Request a Ride
              </Link>
            </>
          )}
          {user?.role === "DRIVER" && (
            <>
              <Link href="/driver" className="text-slate-600 hover:text-slate-900">
                Driver Console
              </Link>
              <Link href="/driver/history" className="text-slate-600 hover:text-slate-900">
                History
              </Link>
            </>
          )}
          {user ? (
            <>
              <span className="hidden text-slate-400 sm:inline">{user.name}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-600 hover:text-slate-900">
                Log in
              </Link>
              <Link href="/signup" className="text-slate-600 hover:text-slate-900">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

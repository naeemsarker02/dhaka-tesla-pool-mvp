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
    <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <Link href="/" className="font-semibold text-slate-900">
        Dhaka Tesla Pool
      </Link>
      <div className="flex items-center gap-4 text-sm">
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
            <span className="text-slate-400">{user.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-100"
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
    </nav>
  );
}

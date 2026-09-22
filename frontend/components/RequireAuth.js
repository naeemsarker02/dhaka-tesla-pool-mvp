"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";

// Auth-aware pages are client components fetching after mount — never SSR-authenticated
// (docs/decisions.md item 4). Waits for AuthContext to finish reading localStorage before
// deciding to redirect, so a logged-in user isn't bounced on every page refresh.
export function RequireAuth({ role, children }) {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (role && user?.role !== role) {
      router.replace("/");
    }
  }, [isLoading, token, user, role, router]);

  if (isLoading) {
    return <p className="p-6 text-slate-500">Loading…</p>;
  }

  if (!token || (role && user?.role !== role)) {
    return null;
  }

  return children;
}

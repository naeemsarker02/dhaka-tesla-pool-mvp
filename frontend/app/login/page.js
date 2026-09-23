"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/AuthContext";
import { ApiError } from "../../lib/api";
import { ErrorBanner } from "../../components/ErrorBanner";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await login({ email, password });
      router.push(user.role === "DRIVER" ? "/driver" : "/rides");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-sm flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mb-6 text-sm text-slate-500">Log in to Dhaka Tesla Pool.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          No account yet?{" "}
          <Link href="/signup" className="font-medium text-slate-900 underline underline-offset-2">
            Sign up
          </Link>
        </p>
      </div>

      <div className="mt-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
          <span aria-hidden="true">🔑</span> Demo accounts — for evaluators
        </p>
        <p className="mb-2 text-xs text-amber-900">
          Password for every account: <code className="rounded bg-white px-1.5 py-0.5 font-semibold">password123</code>
        </p>
        <ul className="space-y-1 text-xs text-amber-900">
          <li>
            <code className="rounded bg-white px-1.5 py-0.5">jashim@dhakateslapool.test</code> — driver
          </li>
          <li>
            <code className="rounded bg-white px-1.5 py-0.5">nusrat@dhakateslapool.test</code> — passenger
          </li>
          <li>
            <code className="rounded bg-white px-1.5 py-0.5">rafiq@dhakateslapool.test</code> — passenger
          </li>
          <li>
            <code className="rounded bg-white px-1.5 py-0.5">shirin@dhakateslapool.test</code> — passenger
          </li>
        </ul>
      </div>
    </main>
  );
}

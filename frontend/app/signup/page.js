"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/AuthContext";
import { ApiError } from "../../lib/api";
import { ErrorBanner } from "../../components/ErrorBanner";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "PASSENGER",
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await signup(form);
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
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Create your account</h1>
        <p className="mb-6 text-sm text-slate-500">Join Dhaka Tesla Pool as a passenger or driver.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">I am a</label>
            <select
              value={form.role}
              onChange={update("role")}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="PASSENGER">Passenger</option>
              <option value="DRIVER">Driver</option>
            </select>
          </div>

          <Field label="Name" value={form.name} onChange={update("name")} required />
          <Field label="Email" type="email" value={form.email} onChange={update("email")} required />
          <Field label="Phone" value={form.phone} onChange={update("phone")} required />
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={update("password")}
            required
            minLength={8}
          />

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline underline-offset-2">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({ label, ...inputProps }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        {...inputProps}
        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

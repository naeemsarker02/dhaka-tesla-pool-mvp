"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch } from "./api";

const STORAGE_KEY = "dhaka-tesla-pool.auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  // Starts true — until localStorage has been read, we don't yet know if the visitor is
  // logged in. Auth-aware pages should wait for this before redirecting to /login, or they'll
  // bounce a logged-in user on every refresh.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setToken(parsed.token);
        setUser(parsed.user);
      }
    } catch (err) {
      // Corrupt/blocked storage — treat as logged out rather than crash the app.
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persist = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
    } catch (err) {
      // localStorage unavailable (private mode etc.) — session just won't survive a refresh.
    }
  }, []);

  const signup = useCallback(
    async (payload) => {
      const result = await apiFetch("/api/auth/signup", { method: "POST", body: payload });
      persist(result.token, result.user);
      return result.user;
    },
    [persist]
  );

  const login = useCallback(
    async (payload) => {
      const result = await apiFetch("/api/auth/login", { method: "POST", body: payload });
      persist(result.token, result.user);
      return result.user;
    },
    [persist]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // Ignore — worst case the stale value is overwritten on next login.
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

#!/bin/sh
# Runs automatically on `docker compose up` before the server starts — MASTER_PLAN.md Section 8
# Phase 9 requirement ("migrations run automatically... seed data loads automatically in dev
# mode"). Both steps are idempotent (prisma migrate deploy only applies pending migrations; the
# seed script upserts by unique key), so this is safe to run on every container start/restart.
set -e

# mysql:8's official image runs a *temporary* server to execute init scripts (create the
# database, etc.), shuts it down, then starts the real one — and Docker's healthcheck
# (`mysqladmin ping`) can report "healthy" during that brief temporary-server window. Compose's
# `depends_on: condition: service_healthy` only guarantees the *first* healthy signal, so the
# backend can still start in the gap while mysql is mid-restart into its final server, hitting
# `Error: P1001: Can't reach database server` (caught live via CI, docs/decisions.md item 24).
# Retrying here is the standard fix — self-healing beats trying to make the healthcheck itself
# perfectly distinguish "temporary" from "final" mysqld.
echo "Applying database migrations..."
attempt=1
until npx prisma migrate deploy; do
  if [ "$attempt" -ge 10 ]; then
    echo "prisma migrate deploy failed after $attempt attempts, giving up."
    exit 1
  fi
  echo "Migration attempt $attempt failed (database likely mid-restart) — retrying in 3s..."
  attempt=$((attempt + 1))
  sleep 3
done

echo "Seeding database (idempotent)..."
npx prisma db seed

echo "Starting server..."
exec "$@"

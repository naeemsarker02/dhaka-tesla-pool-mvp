#!/bin/sh
# Runs automatically on `docker compose up` before the server starts — MASTER_PLAN.md Section 8
# Phase 9 requirement ("migrations run automatically... seed data loads automatically in dev
# mode"). Both steps are idempotent (prisma migrate deploy only applies pending migrations; the
# seed script upserts by unique key), so this is safe to run on every container start/restart.
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Seeding database (idempotent)..."
npx prisma db seed

echo "Starting server..."
exec "$@"

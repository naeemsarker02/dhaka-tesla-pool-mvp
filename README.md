# Dhaka Tesla Pool

## Summary

A ride-pooling MVP built for the RoBenDevs Software Engineer assessment. Passengers request rides
between predefined Dhaka zones; compatible requests are pooled into a single Tesla trip so riders
share a car (and split part of the cost) while still tracking their own fare and status
individually. **Current state: backend feature-complete (Phases 1–6, plus a Section 13/6.2
backfill — idempotency, one-active-ride, seat bounds, grace-window cancellation), both passenger
and driver frontends (Phases 7–8) implemented and verified live in a real browser, and a full
`docker-compose.yml` (backend + frontend + real MySQL 8, automatic migrations/seed) is in place and
verified end-to-end via CI (Phase 9 — no Docker installation is available in the local development
environment, so GitHub Actions substitutes; see `.github/workflows/docker-verify.yml` and
`docs/decisions.md` item 22, which also covers two real bugs that first CI run caught).**

## Problem Statement

Nusrat needs a ride from Banani to Mohakhali. Around the same time, Rafiq needs a ride from Banani
to Gulshan 1 — a nearby destination in the same corridor. Jashim drives Bullet, a Tesla with 3
seats, and could easily take them both on one trip instead of two separate ones. The product
problem isn't just "match nearby requests" — it's making sure each passenger still gets an
individual, fair fare (with a pooling discount when they actually share), a status they can
track through the whole trip, and a driver who sees one clear manifest for the car, not two
disconnected jobs. Getting the pooling *discount* right without letting two passengers' fares or
statuses bleed into each other is the actual engineering problem this MVP solves.

## Features Implemented

> Filled in phase by phase per `MASTER_PLAN.md` Section 8; kept accurate in `docs/PROGRESS.md`.
> Both passenger and driver flows now have real UIs, verified live in a browser. Items below have
> been verified end-to-end against a real MySQL/MariaDB instance (see `docs/PROGRESS.md`), not
> just mocked tests.

**Passenger**
- [x] Signup / login (`POST /api/auth/signup`, `POST /api/auth/login`)
- [x] Request a ride (`POST /api/rides`) — pickup/destination/seats, immediate
  `estimated_fare_paisa`, automatically attempts pool matching
- [x] Track ride status (`GET /api/rides/:id`) — reflects `MATCHED` + finalized `farePaisa` once a
  driver accepts the pool
- [x] Ride history (`GET /api/rides`)
- [x] Cancel a ride (`POST /api/rides/:id/cancel`, from `REQUESTED`/`MATCHED` only) — releases the
  pool seat and cancels an emptied pool, verified live
- [x] Idempotent ride creation (`Idempotency-Key` header) — a repeat request with the same key
  returns the original ride, never a duplicate
- [x] One active ride request per passenger — a second `POST /api/rides` while one is already
  `REQUESTED`/`MATCHED`/`DRIVER_ARRIVED`/`STARTED` is rejected with 409
- [x] Grace-window cancellation — cancelling more than 60s after a pool is `MATCHED` flags
  `late_cancellation` and computes (not charges) a `cancellation_fee_paisa`

**Driver**
- [x] Signup / login, register Tesla (`POST /api/teslas`, driver-only, rejects a second Tesla)
- [x] Online / offline toggle (`PATCH /api/teslas/:id/status`)
- [x] View pending pools/requests (`GET /api/driver/requests`)
- [x] Accept a pool (`POST /api/driver/pools/:poolId/accept`)
- [x] Advance pool through `DRIVER_ARRIVED` / `STARTED` / `COMPLETED`
  (`PATCH /api/driver/pools/:poolId/status`) — full lifecycle verified live for a pooled pair
- [x] Trip history (`GET /api/driver/history`), single-pool detail (`GET /api/driver/pools/:id`)

**Pooling**
- [x] Deterministic zone-cluster matching (no map API) — verified live with the exact Nusrat/Rafiq
  scenario
- [x] Capacity-safe concurrent seat claiming (`SELECT ... FOR UPDATE`) — proven with a real-database
  concurrency test (`npm run test:integration`), not just mocks
- [x] Fare finalization on pool `MATCHED` — exact integer match to the Section 5.2 worked example
  (৳70.50 / ৳85.50), verified live

## Screenshots / GIFs

Captured live against the real running app (real backend, real MariaDB, not mocked) during the
Phase 10 documentation pass — the exact Nusrat+Rafiq+Jashim scenario from `MASTER_PLAN.md` §5.2.

| | |
|---|---|
| **Login** — demo credentials shown for all four cast members | **Request a ride** — Nusrat, Banani → Mohakhali |
| ![Login](./docs/screenshots/01-login.jpg) | ![Request a ride](./docs/screenshots/02-request-ride.jpg) |
| **Ride status** — `REQUESTED`, estimated fare ৳75.00 (matches §5.2 exactly) | **Driver console** — Jashim sees the pending pool, both passengers' est. fares |
| ![Ride status](./docs/screenshots/03-ride-status-requested.jpg) | ![Driver pending pool](./docs/screenshots/04-driver-pending-pool.jpg) |
| **Pool accepted** — `MATCHED`, finalized fares ৳70.50 / ৳85.50, exact digit-for-digit match to §5.2 | **Ride history** — Nusrat's ride `COMPLETED` at the same ৳70.50 |
| ![Pool matched, fares finalized](./docs/screenshots/05-pool-matched-fares.jpg) | ![Ride history completed](./docs/screenshots/06-ride-history-completed.jpg) |

## Architecture

See [`docs/architecture.md`](./docs/architecture.md) for the full write-up.

```mermaid
flowchart LR
    A[Browser] --> B[Next.js App Router]
    B -->|REST JSON, Bearer JWT| C[Express API]
    C --> D[(MySQL)]
    C -->|Prisma Client| D
```

Three layers: Next.js (presentation) → Express (routes/controllers/**services**, business logic
lives only in the service layer) → MySQL via Prisma (persistence).

## Database Design (ERD)

See [`docs/erd.md`](./docs/erd.md) for the full diagram and domain-model notes (matching vs.
driver acceptance, pool vs. ride-request state, the `seats_occupied` aggregate-counter rule, and
the one-active-pool-per-Tesla invariant).

`RideRequest.status` and `Pool.status` are two separate state machines and are never conflated —
grouping a request into a pool (`pool_membership` created) is not the same event as a driver
accepting that pool. `pool_memberships` is the sole relationship between `pools` and
`ride_requests`; `ride_requests` intentionally has no `pool_id` column.

## Tech Stack & Justification

| Layer | Choice | Why | Alternative considered | Would switch if... |
|---|---|---|---|---|
| Backend | Express | Minimal boilerplate, fast to reason about for a small MVP, team already fluent in it | NestJS (more structure but steeper setup cost for this scope) | Team/codebase grows past ~15 endpoints and needs enforced module boundaries |
| DB | MySQL (InnoDB) | Relational integrity + real FK constraints; InnoDB gives transactions and row-level locking (`SELECT ... FOR UPDATE`) needed for seat-capacity concurrency; widest free-tier hosting availability (PlanetScale, Railway, Aiven) | PostgreSQL (slightly stronger isolation defaults, native JSON/array types), SQLite (no real concurrency story) | Need heavy geospatial queries at scale, or stricter isolation guarantees → PostgreSQL + PostGIS |
| ORM | Prisma | Schema-first, migrations built-in, type-safe queries, works identically across MySQL/Postgres, fast to demo/explain | Knex (more manual), TypeORM (heavier) | N/A for this scope |
| Auth | JWT + bcrypt | Stateless, simple to reason about for an MVP with two roles | Session-based auth (needs sticky store) | Multi-device session revocation becomes a real requirement |
| Validation | Zod | Type inference + runtime validation in one place | Joi | N/A |
| Frontend | Next.js App Router | File-based routing, recommended by brief | Plain React + React Router | N/A |
| Styling | Tailwind CSS | Fast, matches existing experience | CSS Modules | N/A |
| Tests | Jest + Supertest (backend), Vitest/RTL (frontend, optional) | Standard, fast to set up | Mocha/Chai | N/A |
| Hosting | Frontend: Vercel. Backend + DB: whichever free-tier MySQL-compatible host is actually available at deploy time | Free, supports Docker + MySQL | Render (backend only; its free managed DB is Postgres-only) | Availability re-verified immediately before deployment, never assumed — see `docs/decisions.md` item 6 |

**Auth details:** JWT payload is minimal — `{ sub, role }`, no PII. Token is carried as
`Authorization: Bearer <token>`, held in a React context and persisted to `localStorage`
(trade-off: readable by any script on the page — accepted for this MVP, see
[`docs/decisions.md`](./docs/decisions.md) item 4). Auth-aware Next.js pages are client
components; SSR-authenticated pages are not implemented or claimed.

## Project Structure

```
backend/
  prisma/          schema, migrations, seed
  src/
    routes/        thin Express routers
    controllers/    req/res only, no business logic
    services/       business logic (matching, fare, lifecycle, cancellation)
    lib/            prisma client, jwt, fare math, state machine, errors
    validators/      Zod schemas
    data/           zones + distance table
  tests/           unit (mocked Prisma) + tests/integration (real DB)
frontend/
  app/              Next.js App Router pages (signup, login, rides/*)
  components/       NavBar, RequireAuth, StatusBadge
  lib/              api client, AuthContext, format helpers
```

## Prerequisites

**Docker path (recommended — brings up everything with one command):**
- Docker + Docker Compose

**Manual path (without Docker):**
- Node.js (tested with v24; anything reasonably current LTS should work — no Node-version-specific
  features used beyond standard ES2020+)
- npm
- A MySQL-compatible database (MySQL 8 or MariaDB — this repo has been verified end-to-end against
  MariaDB 10.4 via XAMPP, see `docs/decisions.md` item 13; the Docker Compose path uses real
  `mysql:8`, per Phase 2's carry-forward item, but has not been run against a live Docker Engine in
  this environment — see Known Limitations)

## Environment Variables

**Backend** (`backend/.env`, copy from `backend/.env.example`):

| Variable | Purpose | Docker Compose default |
|---|---|---|
| `DATABASE_URL` | MySQL connection string consumed by Prisma | `mysql://root:password@mysql:3306/dhaka_tesla_pool` |
| `PORT` | Port the Express API listens on | `4000` |
| `JWT_SECRET` | Secret used to sign/verify JWTs | dev-only placeholder, override for any real deployment |
| `GRACE_WINDOW_SECONDS` | Free-cancellation window (seconds) after a pool is `MATCHED` — Section 6.2 | `60` |

**Frontend** (`frontend/.env.local`, copy from `frontend/.env.example`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the Express API this frontend talks to. Baked into the client bundle at **build time** (Next.js `NEXT_PUBLIC_*` convention), so it's passed as a Docker build arg, not a runtime env var — see `docker-compose.yml` |

No real secrets are committed anywhere in this repo — only `.env.example` files, `.env`/`.env.local`
are gitignored.

## Local Setup (without Docker)

**Backend:**

```bash
cd backend
npm install
cp .env.example .env   # then point DATABASE_URL at a reachable MySQL 8 (or MariaDB) instance
npx prisma migrate deploy
npx prisma db seed
npm run dev             # http://localhost:4000
```

**Frontend** (both passenger and driver flows):

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, defaults to http://localhost:4000
npm run dev              # http://localhost:3000 (or the next free port)
```

**Verified end-to-end** against a real local MySQL/MariaDB (XAMPP) instance — migration applied,
seed data confirmed, auth/Tesla/ride-request/pooling/lifecycle endpoints exercised live, and the
passenger frontend exercised in a real browser against the real running backend. See
`docs/PROGRESS.md` for the full verification log per phase, and `docs/decisions.md` item 13 for a
note that the verified local instance is MariaDB, not MySQL proper.

## Docker Setup

One command brings up the full stack — MySQL 8, backend, frontend:

```bash
docker compose up --build
```

- `mysql`: real `mysql:8` (not MariaDB — MariaDB was only the local dev DB, see
  `docs/decisions.md` item 13), healthchecked via `mysqladmin ping`.
- `backend`: waits for MySQL to be healthy, then `docker-entrypoint.sh` runs
  `prisma migrate deploy` and `prisma db seed` automatically (both idempotent — safe on every
  restart) before starting the server. Healthchecked via `GET /health`.
- `frontend`: waits for the backend to be healthy, then serves the Next.js production build on
  `:3000`. `NEXT_PUBLIC_API_URL` is baked in at build time as `http://localhost:4000` (the
  browser talks to the host-published port, not the internal Docker network — see the comment in
  `docker-compose.yml`).

Once up: frontend at `http://localhost:3000`, backend at `http://localhost:4000`, MySQL at
`localhost:3306`. Demo credentials are the same as the Local Setup section below (seeded
automatically).

All environment values in `docker-compose.yml` are MVP dev-only defaults, documented inline, never
real secrets — override them (e.g. via `docker compose --env-file`) for any real deployment.

**Verification status:** verified end-to-end via CI — `.github/workflows/docker-verify.yml` runs
`docker compose up -d --build` on every push (no Docker Engine is available in the local
development environment, so GitHub Actions substitutes), polls `GET /health` until the backend
reports healthy, and spot-checks that seed data actually loaded via `GET /api/zones`. The first
real run caught two genuine bugs invisible to static review — a port-3306 conflict with the
runner's preinstalled MySQL, and a missing-OpenSSL issue that broke Prisma's engine binaries inside
`node:20-alpine` — both fixed; see `docs/decisions.md` item 22 for the full account.

## Running Tests

```bash
cd backend
npm test                  # unit tests — mocked Prisma, no DB required
npm run test:integration  # real-database concurrency test — requires DATABASE_URL
```

68 unit tests currently pass (`health`, `auth`, `tesla`, `fare`, `ride`, `pool`, `poolAccept`,
`poolStatus`, `cancel` suites) — `fare`/`poolAccept` assert exact integer-paisa values against the
master plan's worked example (no floating-point comparisons, including the Nusrat/Rafiq
৳70.50/৳85.50 pooled fares); `ride`/`cancel` additionally assert the Section 13/6.2 backfill —
idempotency replay, one-active-ride 409, seat bounds, and grace-window free-vs-late cancellation
with exact fee arithmetic (৳85.50 fare → ৳17.10 fee). The rest use a **mocked** Prisma client (no
live DB required) covering validation, hashing, JWT issuance, role/ownership guards, matching
logic, state-machine transition guards, and HTTP status mapping.

`npm run test:integration` runs a separate, real-database concurrency test
(`tests/integration/concurrency.test.js`) that races two concurrent seat claims for the last seat
on a Tesla and asserts exactly one wins and `seats_occupied` never exceeds capacity — proving the
`SELECT ... FOR UPDATE` row lock actually works, which a mocked client can't simulate. Confirmed
deterministic across 5 consecutive runs against a live MySQL/MariaDB instance.

Endpoint behavior has separately been verified live against a real database, including the full
Nusrat+Rafiq pooling scenario (see `docs/PROGRESS.md` Phase 4). Required coverage overall is
tracked in `MASTER_PLAN.md` Section 9.

## Demo Credentials

Seeded by `backend/prisma/seed.js`, confirmed against a real database (see Local Setup above). All
accounts use the password `password123`.

| Role | Name | Email |
|---|---|---|
| Driver (owns Bullet, capacity 3) | Jashim | `jashim@dhakateslapool.test` |
| Passenger | Nusrat | `nusrat@dhakateslapool.test` |
| Passenger | Rafiq | `rafiq@dhakateslapool.test` |
| Passenger | Shirin | `shirin@dhakateslapool.test` |

## Fare Model

See [`docs/fare-model.md`](./docs/fare-model.md) for the full formula and worked example
(Nusrat/Rafiq pooled fares of ৳70.50 and ৳85.50, integer-paisa arithmetic only).

## Matching Rule

Deterministic, no map API. Two ride requests are pool-compatible if all of the following hold:

1. `pickup_zone.cluster` is identical for both requests
2. `destination_zone.cluster` is identical for both requests
3. `existing_pool.seats_occupied + new_request.seats_requested <= tesla.capacity`

Full rule and the Nusrat/Rafiq worked example: `MASTER_PLAN.md` Section 4.

## Concurrency Handling

MySQL (InnoDB) row lock inside a Prisma interactive transaction (`tx.$queryRaw` for
`SELECT ... FOR UPDATE`, since Prisma's query builder doesn't expose `FOR UPDATE` directly) is
sufficient and simple to reason about at MVP scale — InnoDB's default `REPEATABLE READ` isolation
combined with `FOR UPDATE` prevents a double seat-claim. At larger scale this would move to a
Redis-backed distributed lock or a single-writer queue per Tesla to avoid DB contention under high
concurrency (see [`docs/scaling.md`](./docs/scaling.md), bonus). Full pattern: `MASTER_PLAN.md`
Section 6; cancellation/seat-release flow: Section 6.1.

## Deployment

**Live.** Backend on [Render](https://render.com) (Free tier), MySQL on [Aiven](https://aiven.io)
(Free tier), frontend on [Vercel](https://vercel.com) (Hobby/free tier) — the free-tier host
named in `docs/decisions.md` item 6.

- **Frontend:** https://dhaka-tesla-pool-mvp.vercel.app
- **Backend:** https://dhaka-tesla-pool-mvp-1.onrender.com (`/health` → `{"status":"ok"}`)

Deployed from the `pre-release` branch on both sides. The Render free instance spins down after
inactivity, so the first request after a quiet period can take up to ~50s to wake it.

Full end-to-end smoke test passed against these live URLs (not localhost): signup/login for a
passenger and a driver, the Nusrat+Rafiq pooling flow through to fare finalization, and
cancellation — see `docs/decisions.md` item 28 for the one deployment issue found and fixed along
the way (Vercel's first build silently shipped from `master`, missing the dashboard-polish PR).

| | |
|---|---|
| **Live login page** | **Live ride status — pooled fare finalized to ৳70.50** |
| ![Live login](./docs/screenshots/live-deploy/login-live.jpg) | ![Live pool matched](./docs/screenshots/live-deploy/pool-matched-fare-live.jpg) |

The Docker Compose setup remains the CI-verified (`.github/workflows/docker-verify.yml`)
reproducible fallback for running the stack locally.

## API Overview

Full contract in `MASTER_PLAN.md` Section 7. Implemented so far:

| Method | Path | Role | Status |
|---|---|---|---|
| POST | `/api/auth/signup` | public | ✅ implemented |
| POST | `/api/auth/login` | public | ✅ implemented |
| POST | `/api/teslas` | driver | ✅ implemented (rejects a 2nd Tesla per driver) |
| GET | `/api/teslas/me` | driver | ✅ implemented (not in master plan's table — added so the frontend can discover its own Tesla, `docs/decisions.md` item 19) |
| PATCH | `/api/teslas/:id/status` | driver (own) | ✅ implemented |
| POST | `/api/rides` | passenger | ✅ implemented |
| GET | `/api/rides/:id` | passenger (own) | ✅ implemented |
| GET | `/api/rides` | passenger | ✅ implemented |
| GET | `/api/zones` | public | ✅ implemented (not in master plan's table — added for pickup/destination dropdowns, `docs/decisions.md` item 14) |
| POST | `/api/rides/:id/cancel` | passenger (own) | ✅ implemented, incl. grace-window `late_cancellation`/`cancellation_fee_paisa` (Section 6.2) |
| GET | `/api/driver/requests` | driver | ✅ implemented |
| POST | `/api/driver/pools/:poolId/accept` | driver (own) | ✅ implemented |
| PATCH | `/api/driver/pools/:poolId/status` | driver (own) | ✅ implemented |
| GET | `/api/driver/pools/:id` | driver (own) | ✅ implemented |
| GET | `/api/driver/history` | driver | ✅ implemented |

## Key Decisions & Trade-offs

See [`docs/decisions.md`](./docs/decisions.md) for the running, dated log. Highlights so far:

- Row-lock (`SELECT ... FOR UPDATE`) chosen over a distributed lock for MVP simplicity — see
  Concurrency Handling above.
- Zone clusters are a flat, hardcoded grouping instead of real geo/distance — accuracy vs. build
  time trade-off, explicit and testable.
- Fare is finalized once, at pool `MATCHED`, not recalculated on later membership changes or
  cancellations — a deliberate simplification, documented as a known limitation below.
- One-active-pool-per-Tesla invariant and new-pool Tesla-selection policy — a gap in the original
  plan, resolved and logged with rationale in `docs/decisions.md` item 7.
- **Isolation-level bug** (`docs/decisions.md` item 26): under InnoDB's default `REPEATABLE READ`,
  `matchRideRequest`'s very first read inside the transaction pinned a stale snapshot for the rest
  of it — a later `SELECT ... FOR UPDATE` row-lock alone didn't fix it, since the lock doesn't
  refresh a snapshot already taken. Two pools could form on the same Tesla under real concurrency.
  Fixed by running `matchRideRequest` and `cancelRideRequest` under explicit `READ COMMITTED`
  (`prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })`),
  caught by a new CI concurrency test, not manual testing.
- **Tailwind purge bug** (commit `a0dab8d`): `tailwind.config.js`'s `content` glob only scanned
  `app/**`, never `components/` or `lib/` — component-only utility classes (`StatusBadge`'s status
  colors, `NavBar`'s layout) were at risk of being silently purged from the production build.
  Fixed by extending the glob to `components/**` and `lib/**` too.

## Known Limitations

- No real payment gateway — `cancellation_fee_paisa` is computed and recorded for demonstration
  only, nothing is ever deducted.
- No real geo/routing — zone-to-zone distance is a hardcoded lookup table.
- `fare_paisa` is not retroactively recalculated for remaining pool members if another member
  cancels after `MATCHED`.
- JWT in `localStorage` (XSS-readable) instead of an `httpOnly` cookie — accepted MVP trade-off.
- No automatic stale-`OPEN`-pool expiry — a pool no driver ever accepts stays `OPEN` until the
  passenger cancels it themselves (documented MVP decision, `MASTER_PLAN.md` Section 13.3).
- No driver-initiated cancellation (no-show, emergency) — out of scope for this MVP.
- No Docker Engine is available in the local development environment used to build this MVP —
  `docker compose up` is verified via GitHub Actions CI instead
  (`.github/workflows/docker-verify.yml`, `docs/decisions.md` item 22), not on a developer machine.
  This has been sufficient to catch real bugs (a CI-runner port conflict, a missing-OpenSSL issue
  in the Alpine base image) and to confirm the full stack — including real `mysql:8`, not just the
  MariaDB 10.4 used for local development — comes up healthy with migrations and seed data applied
  automatically. A `docker compose up` run on an actual developer machine has still not happened.
- Single-region deploy, no read replicas, no distributed lock — see
  [`docs/scaling.md`](./docs/scaling.md) (bonus) for the reasoning-only scale-out path.

## Next Improvements

- Move seat-capacity locking to a Redis-backed distributed lock or per-Tesla queue at higher
  concurrency.
- Replace zone-cluster matching with real geospatial distance (MySQL spatial types or
  PostgreSQL + PostGIS).
- `httpOnly` cookie-based auth with a same-site proxy for true SSR-authenticated pages.
- Recalculate remaining members' fares on mid-trip cancellation (currently a documented known
  limitation, not implemented).

## AI Usage

**Tools used:** Claude Code

**What for:** Phase 0 project analysis (cross-checking `MASTER_PLAN.md` for internal
contradictions before any code was written) and drafting `docs/architecture.md`, `docs/erd.md`,
`docs/fare-model.md`, `docs/decisions.md`, and this README's Phase-0-relevant sections.

**One accepted suggestion:** Flagging that `MASTER_PLAN.md` never specified how a new `OPEN` pool
picks its Tesla, or whether a Tesla can run more than one active pool at once — a real gap since a
driver can only physically run one trip at a time. Confirmed and adopted the "one active pool per
Tesla" invariant with an online-Tesla selection policy, logged in `docs/decisions.md` item 7.

**One rejected/changed suggestion:** when adding the Section 6.2 grace-window cancellation, the
first draft computed `late_cancellation` against `pool.matchedAt` (a second query on the `Pool`
model). Changed to use `ride_request.matchedAt` instead — it's written to the exact same instant
by `poolService.acceptPool` (Section 3.1), so reading it off the row already in hand avoids an
extra query inside the cancellation transaction, with no behavior difference.

**Later session — repo audit and backfill (2026-09-23):** re-read `MASTER_PLAN.md` in full against
the actual code (schema + services), rather than trusting `docs/PROGRESS.md`'s phase statuses.
Found that Section 13.1 (idempotency), 13.2 (one active ride per passenger), 13.6 (seat bounds),
and Section 6.2 (grace-window cancellation) were all marked "part of the plan, not optional" but
had never actually been implemented, despite Phases 3 and 6 being marked complete. **Accepted and
implemented all four** exactly per their master-plan spec (see `docs/decisions.md` item 20) rather
than re-designing them — this was a documentation/code gap, not an ambiguous requirement needing a
new decision. Also completed Phase 9 (Docker Compose finalization: healthchecks, automatic
migration/seed entrypoint, `GRACE_WINDOW_SECONDS` wired through) and this README pass.

**Same day — CI-driven Docker verification:** with no Docker Engine available locally, added
`.github/workflows/docker-verify.yml` to use GitHub Actions' preinstalled Docker as the
verification method instead of claiming the Dockerized stack worked from static review alone. This
immediately surfaced two real bugs neither static review nor any local test had caught: a port
3306 conflict with the CI runner's preinstalled MySQL service, and `node:20-alpine` missing
OpenSSL, which broke Prisma's schema-engine binary inside the `backend` container
(`Could not parse schema engine response... is not valid JSON` — Prisma's own error text said
exactly what to install). Both fixed and confirmed by a fully green CI run, including a real
`GET /api/zones` response with all 8 seeded zones. See `docs/decisions.md` item 22.

**Same day — Phase 10 security review:** the mandated "security review" pass wasn't treated as a
formality — re-read `src/app.js` against `MASTER_PLAN.md` Section 13.4/13.5 line by line instead of
trusting Phase 1's `[x]` marks. Found neither was real: `cors()` had no options (allows every
origin), `helmet`/`express-rate-limit` weren't installed, and there was no request-correlation
(`requestId`) anywhere — no `X-Request-Id` header, no request logging at all, despite the plan's
explicit "this is what 'logging' actually wants demonstrated." Backfilled all of it and verified
live rather than just by reading the diff: curled `/health` for security headers, sent a
disallowed-origin request and confirmed CORS silently omitted `Access-Control-Allow-Origin`, sent
21 rapid login attempts and confirmed the 21st got `429`, and confirmed the same `requestId`
appears in the response header, the error JSON body, and the server's own log line. See
`docs/decisions.md` item 23.

**Same day — live deployment (2026-09-23):** deployed the backend to Render, MySQL to Aiven, and
the frontend to Vercel, with browser automation driving all three consoles end-to-end. Caught a
real deployment bug along the way, not just a code bug: Vercel's first import auto-selected
`master` as the production branch before the setting was changed to `pre-release`, and a first
look comparing only the two branches' tip commits wrongly concluded the live build was equivalent
either way. Re-checked with the full branch diff instead of just the tip commits
(`git diff --stat master pre-release`) and found `master` was missing PR #5's entire
dashboard-polish rebuild (50 files, `StatusStepper`/`SeatOccupancy`/`FareDisplay`/design-system
components) — a branch-divergence gap from `docs/decisions.md` item 27's direct-push-to-master
incident, not a new mistake. Fixed by pushing a trigger commit to `pre-release` and re-verifying
the live smoke test against the corrected deployment before taking this section's screenshots. See
`docs/decisions.md` item 28.

## Demo Video

Not yet recorded — Phase 11.

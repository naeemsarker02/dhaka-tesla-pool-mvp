# Progress Log

> Maintained per `CLAUDE.md` "Work Tracking". One entry per phase/task. A task is not marked
> complete unless it is actually implemented and verified (tests run, migrations applied, etc.) —
> documentation-only phases are the exception, verified by review instead.

---

## Phase 0 — Project Analysis & Documentation

**Status:** Complete — committed to `master` (`3e6e530`..`0c9ce1b`) and pushed to `origin/master`.

**What was implemented:**
- Read `MASTER_PLAN.md`, `CLAUDE.md`, `docs/DOCUMENTATION_PLAN.md` in full; inspected repo
  structure (root contained only `CLAUDE.md`, `MASTER_PLAN.md`, `docs/DOCUMENTATION_PLAN.md` — no
  code, no git repo initialized yet).
- Verified consistency between `MASTER_PLAN.md` and `CLAUDE.md` — no contradictions found between
  the two; `CLAUDE.md` is a faithful operational summary of the master plan.
- Analyzed the plan for contradictions/risks across: MySQL/InnoDB concurrency, Prisma transactions
  + `SELECT ... FOR UPDATE`, one-active-pool-per-Tesla invariant, pool vs ride lifecycle, fare
  calculation, cancellation/seat release, authorization/ownership, Docker/migration/seed strategy,
  Git workflow. One real gap found and resolved with the project owner (see below); everything
  else checked out internally consistent.
- Created `docs/architecture.md`, `docs/erd.md`, `docs/fare-model.md`, `docs/decisions.md`.
- Created root `README.md` (Phase-0-relevant sections filled: Summary, Problem Statement, Tech
  Stack, Architecture, ERD, Fare Model, Matching Rule, Concurrency Handling, Key Decisions so far;
  remaining sections stubbed as "Not yet implemented" placeholders to be filled phase by phase).

**Files changed:**
- `docs/architecture.md` (new)
- `docs/erd.md` (new)
- `docs/fare-model.md` (new)
- `docs/decisions.md` (new)
- `docs/PROGRESS.md` (new, this file)
- `README.md` (new)

**Tests added:** N/A (documentation phase)

**Tests passed/failed:** N/A

**Documentation updated:** Yes — this phase *is* the documentation deliverable (Phase 0 of
`MASTER_PLAN.md` Section 8).

**Known issues / unresolved:**
- `docs/scaling.md` (bonus, Section 10 of the master plan) not created yet — out of Phase 0 scope,
  deferred to its own pass since it's explicitly "reasoning only, don't build."
- One architectural gap found and resolved during this phase: the master plan didn't specify a
  one-active-pool-per-Tesla invariant or a Tesla-selection policy for newly created `OPEN` pools.
  Resolved and logged as `docs/decisions.md` item 7 (confirmed with project owner). This is an
  *addition* to the master plan's unspecified areas, not a change to anything the plan explicitly
  stated — `MASTER_PLAN.md` itself was not modified.

**Next task:** Phase 1 — see below.

---

## Git Alignment

**Status:** Complete.

- Repo already existed (git-initialized externally, remote `origin` →
  `github.com/naeemsarker02/dhaka-tesla-pool-mvp.git`, default branch `main`) with two prior
  commits (`04d9b27` "first commit", `5dd1f92` "setup" adding `CLAUDE.md`/`MASTER_PLAN.md`/
  `docs/DOCUMENTATION_PLAN.md`).
- Created local `master` from `main`'s HEAD (`git branch master main`), pushed to
  `origin/master` and set to track it. History preserved exactly — no rebase, no force-push,
  `main` untouched and still GitHub's default branch (left alone per instruction).
- Phase 0 docs (`docs/architecture.md`, `docs/erd.md`, `docs/fare-model.md`, `docs/decisions.md`,
  `README.md`, `docs/PROGRESS.md`) committed onto `master` as six small `docs(...)` commits and
  pushed.
- Going forward, `master` is the long-lived integration branch; work happens on `feature/*`
  branches merged into `master` with `--no-ff`, per `MASTER_PLAN.md` Section 0 / `CLAUDE.md` Git
  Workflow. `pre-release` and `release/v1.0.0` are cut later (Phases 10–11), not created as empty
  placeholders now.

---

## Phase 1 — `feature/project-scaffold`

**Status:** Complete (branch not yet merged to `master` — pending review/confirmation).

**What was implemented:**
- Two-folder monorepo structure: `/backend`, `/frontend`.
- **Backend:** Express skeleton (`backend/src/app.js`, `backend/src/server.js`) with `GET /health`
  returning `{ status: "ok" }`. `src/routes`, `src/controllers`, `src/services` created empty
  (placeholders, `.gitkeep`) per the layering rule in `docs/architecture.md`/`CLAUDE.md` — no
  business logic exists yet, intentionally.
- **Prisma:** initialized at `backend/prisma/schema.prisma`, MySQL provider, datasource +
  generator only — no models yet (those start Phase 2). Schema validated successfully against the
  installed Prisma CLI (5.22.0) once `DATABASE_URL` is set.
- `backend/.env.example` (`DATABASE_URL`, `PORT`, `JWT_SECRET`) and `frontend/.env.example`
  (`NEXT_PUBLIC_API_URL`). No real secrets committed; both `.env`/`.env.local` gitignored.
- **Frontend:** minimal Next.js 14 App Router skeleton (`frontend/app/layout.js`,
  `frontend/app/page.js`, `frontend/app/globals.css`), Tailwind configured
  (`tailwind.config.js`, `postcss.config.js`), no pages beyond a placeholder home page yet
  (Phases 7–8 build the real passenger/driver flows).
- Root `docker-compose.yml` skeleton: `mysql:8` (with healthcheck) + `backend` (built from
  `backend/Dockerfile`) only, per Phase 1 scope — no automatic migrations/seed yet (Phase 9 adds
  that, plus the frontend container).
- `backend/Dockerfile` (node:20-alpine, `npm install --omit=dev`, `prisma generate`, `npm start`).
- Root `.gitignore` plus per-package `.gitignore` (`node_modules/`, `.env`, `.next/`, etc.).

**Files changed:** see branch diff — `backend/` and `frontend/` created in full, plus root
`docker-compose.yml` and `.gitignore`.

**Tests added:** `backend/tests/health.test.js` (Supertest against `GET /health`).

**Tests passed/failed:** `npx jest --runInBand` → 1 passed, 1 total. Backend `npm install`
succeeded (422 packages). Frontend `npm install` succeeded (98 packages). Prisma schema validated
successfully with `DATABASE_URL` set.

**Documentation updated:** This file. `docs/architecture.md`/`docs/erd.md` unchanged — no
architectural decisions changed in this phase, only scaffolding.

**Known issues / unresolved:**
- `npm audit` on `backend` reports 2 vulnerabilities (1 high, 1 critical) in `tar` /
  `@mapbox/node-pre-gyp`, a transitive **build-time-only** dependency of `bcrypt`'s native
  bindings (not used at runtime). `npm audit fix` does not resolve it without a breaking change to
  `bcrypt` itself. Left as-is rather than swapping to `bcryptjs` without approval, since
  `MASTER_PLAN.md` §1 names `bcrypt` specifically — flagging here as a known issue to revisit if
  it matters for submission, not silently changed.
- `npm audit` on `frontend`: bumped `next` from the originally-planned `^14.2.5` to `^14.2.35`
  (latest 14.x patch) to pick up fixes for several Next.js CVEs (cache poisoning, SSRF, RCE
  advisories) without jumping to the breaking Next 16 major version. One remaining
  high-severity `postcss` advisory is bundled *inside* `next`'s own `node_modules` (not our
  top-level `postcss` devDependency) and has no fix short of the Next 16 major bump — documented
  here as an accepted MVP risk, build-tool-only exposure.
- `npx prisma generate` currently errors ("no models defined") since `schema.prisma` intentionally
  has no models yet — expected at this phase, not a bug; resolves once Phase 2 adds `User`/`Tesla`
  models.
- ~~Branch `feature/project-scaffold` created but not yet merged into `master`~~ — merged
  `--no-ff` (`e7258dc`) and pushed after user confirmation.

**Next task:** Phase 2 — see below.

---

## Phase 2 — `feature/passenger-auth` + `feature/driver-tesla-setup`

**Status:** Complete on branch `feature/passenger-auth` (not yet merged — pending review).
Combined both master-plan branch names into one feature branch since they're one phase's worth of
tightly related schema/auth work; split into two merges was not warranted for this scope.

**What was implemented:**
- **Prisma models:** `User` (`users` table — id, name, email UK, password_hash, role enum,
  phone, created_at) and `Tesla` (`teslas` table — id, driver_id UK+FK, name, capacity, status
  enum, created_at), per `docs/erd.md`. `RideRequest`/`Pool`/`PoolMembership`/etc. intentionally
  not added yet (Phases 3–4).
- **Migration:** `backend/prisma/migrations/20260922000000_init/migration.sql`, generated via
  `prisma migrate diff --from-empty --to-schema-datamodel` (schema-to-schema SQL diff, which works
  without a live DB connection) plus a hand-added `CHECK (capacity > 0)` constraint (Prisma's
  schema language has no native `@check` attribute — `docs/decisions.md` item 10). **Not yet
  applied to a real database** — see Known issues below.
- **Auth:** `POST /api/auth/signup`, `POST /api/auth/login` (`src/routes/auth.js` →
  `src/controllers/authController.js` → `src/services/authService.js`). Passwords hashed with
  `bcrypt`; JWT payload is `{ sub, role }` only, signed via `src/lib/jwt.js`.
- **JWT middleware:** `src/middleware/auth.js` — `requireAuth` (401 on missing/invalid token),
  `requireRole(role)` (403 on wrong role). Ownership checks (driver owns *this* Tesla) done in the
  service layer, not the middleware, per `MASTER_PLAN.md` §7.1.
- **Tesla endpoints:** `POST /api/teslas` (driver-only, rejects a second Tesla for a driver who
  already owns one — checked at both app level and DB `UNIQUE` constraint, via
  `src/services/teslaService.js`), `PATCH /api/teslas/:id/status` (driver-owns-Tesla check, online/
  offline toggle).
- **Validation:** Zod schemas for both auth endpoints and both Tesla endpoints
  (`src/validators/`), applied via a reusable `validateBody` middleware.
- **Error handling:** `src/lib/errors.js` (typed `AppError` subclasses) + a centralized
  `src/middleware/errorHandler.js`, so services throw typed errors instead of building HTTP
  responses inline.
- **Seed script:** `backend/prisma/seed.js` — Jashim (driver) + Bullet (Tesla, capacity 3,
  `ONLINE`) + Nusrat/Rafiq/Shirin (passengers), all with password `password123`, upsert-based (safe
  to re-run). Wired into `package.json`'s `prisma.seed` config.

**Files changed:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/**`,
`backend/prisma/seed.js`, `backend/src/lib/{prisma,jwt,errors}.js`,
`backend/src/middleware/{auth,validate,errorHandler}.js`, `backend/src/validators/{auth,tesla}.js`,
`backend/src/services/{authService,teslaService}.js`,
`backend/src/controllers/{authController,teslaController}.js`,
`backend/src/routes/{auth,teslas}.js`, `backend/src/app.js` (routes + error handler wired in),
`backend/package.json` (added `prisma.seed` config).

**Tests added:** `backend/tests/auth.test.js` (9 cases: signup validation, invalid role, signup
success incl. email normalization + password_hash never returned, duplicate-email 409, login
success, wrong password 401, nonexistent user 401) and `backend/tests/tesla.test.js` (7 cases: no
token 401, invalid token 401, wrong-role 403, Tesla registration success, second-Tesla-for-same-
driver 409, invalid capacity 400, cross-driver status-toggle 403, owning-driver toggle success).

**Tests passed/failed:** `npx jest --runInBand` → **16/16 passed** (health + auth + tesla suites).
All backend source files pass `node --check` syntax validation. `prisma validate`/`prisma generate`
succeed against the installed CLI (5.22.0) with `DATABASE_URL` set.

**Documentation updated:** This file; `docs/decisions.md` items 10–11 (below).

**Known issues / unresolved (at time of writing — see DB verification update below):**
- At the time this phase was built, no MySQL/Docker was available in-session, so the migration was
  generated statically and only mocked-Prisma tests had been run.
- `bcrypt`/`next` dependency advisories from Phase 1 (`docs/decisions.md` items 8–9) still stand,
  unchanged.

**~~Merged into `master`~~** — merged `--no-ff` (`c864d99`) and pushed, after the DB verification
below.

---

## Phase 2 — Real-database verification (2026-09-22, project owner's local XAMPP MySQL/MariaDB)

**Status:** Complete. All of Phase 2's "known issues" above are now resolved/confirmed.

- Created `backend/.env` (gitignored, confirmed via `git check-ignore`) pointing at
  `mysql://root:@localhost:3306/dhaka_tesla_pool` (XAMPP default: root, empty password,
  `localhost:3306`).
- `npx prisma migrate deploy` — applied cleanly. Verified via `information_schema` that
  `teslas.driver_id` is `UNIQUE` and the hand-added `CHECK (capacity > 0)` constraint is present.
- `npx prisma db seed` — succeeded. Verified directly against the DB: Jashim (DRIVER), Nusrat/
  Rafiq/Shirin (PASSENGER) all present with correct emails/roles/phones; Bullet (capacity 3,
  `ONLINE`) correctly tied to Jashim via `driverId`.
- `npm test` — 16/16 passed (unchanged; these are mocked-Prisma unit tests, unaffected by DB
  availability, run again here for completeness).
- No lint/typecheck configured (no ESLint config, no TypeScript) — confirmed, nothing to run.
- **Live functional verification** (real server process, real DB, not mocked): login success/
  wrong-password/duplicate-signup, Tesla registration + duplicate-Tesla 409, wrong-role 403,
  no-token 401, cross-driver ownership 403, owning-driver status toggle 200 — all exercised via
  real HTTP requests against `node src/server.js`, all behaved correctly. Server process cleanly
  stopped afterward (port 4000 confirmed free); Bullet's status was toggled and restored to
  `ONLINE` to leave seed data as expected.
- **One discovery, not a problem:** the local dev DB is **MariaDB 10.4.32**, not MySQL —
  `docs/decisions.md` item 13. Everything tested is compatible; noted so it isn't silently assumed
  equivalent to "verified on MySQL 8" for later hosting decisions.

**Next task:** Phase 3 — see below.

---

## Phase 3 — `feature/ride-request`

**Status:** Complete on branch `feature/ride-request` (not yet merged — pending review). Verified
against the same live MariaDB instance (migration applied with `prisma migrate dev` this time,
since a live DB was available — no more static-diff workaround).

**What was implemented:**
- **Prisma models:** `Zone` (`zones` table — id, name UK, cluster) and `RideRequest`
  (`ride_requests` table — passenger_id/pickup_zone_id/destination_zone_id FKs, seats_requested,
  status enum, estimated_fare_paisa, fare_paisa nullable, full lifecycle timestamp columns). No
  `pool_id` column, per `docs/erd.md`. `Pool`/`PoolMembership` intentionally not added yet
  (Phase 4).
- **Migration:** `backend/prisma/migrations/20260922174914_add_zones_and_ride_requests/` —
  generated with a real `prisma migrate dev --create-only` against the live DB this time (Phase 2
  had to use the static-diff workaround; not needed once DB access existed). Applied via
  `prisma migrate dev`. Verified `SHOW INDEX` confirms FK indexes exist on all three FK columns
  (`passenger_id`, `pickup_zone_id`, `destination_zone_id`) — InnoDB auto-creates these with the
  FK constraint.
- **Zone/distance data:** `backend/src/data/zones.js` — single source of truth (seed script +
  services both import it) for the 8 zones, their clusters, and all 28 pairwise distances. Only 1
  cluster and 2 distances were specified in the master plan; the rest is a documented MVP
  assumption (`docs/decisions.md` item 12).
- **Fare calculation:** `backend/src/lib/fare.js` — integer-paisa-only arithmetic
  (`calculateEstimatedFarePaisa`, `calculatePooledFarePaisa`, `calculatePoolDiscountPaisa`),
  matching `docs/fare-model.md` exactly.
- **`POST /api/rides`** (passenger-only): validates both zone ids exist and differ, computes
  `estimated_fare_paisa` (no discount), creates the ride request with `status = REQUESTED`,
  `fare_paisa = null`. Also added `GET /api/rides` (own history) and `GET /api/rides/:id`
  (ownership-checked) — companion reads for the same resource, not a later-phase feature.
- **`GET /api/zones`** (public): added beyond the master plan's endpoint table, since the frontend
  needs it for pickup/destination dropdowns (Phase 7) and it's a zero-logic reference-data read —
  flagged and justified in `docs/decisions.md` item 14 rather than silently added.
- **Seed script:** updated to seed all 8 zones from `src/data/zones.js` (upsert-based).

**Files changed:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/**`,
`backend/prisma/seed.js`, `backend/src/data/zones.js`, `backend/src/lib/fare.js`,
`backend/src/validators/ride.js`, `backend/src/services/rideService.js`,
`backend/src/controllers/{rideController,zoneController}.js`,
`backend/src/routes/{rides,zones}.js`, `backend/src/app.js` (routes wired in).

**Tests added:** `backend/tests/fare.test.js` (7 cases — exact-integer assertions against the
Section 5.2 worked example: pool discount = 450 paisa exactly, Nusrat's pooled fare = 7050 paisa
exactly, Rafiq's = 8550 paisa exactly, no floating-point comparisons anywhere) and
`backend/tests/ride.test.js` (9 cases: auth/role guards, missing-field validation, identical-zone
rejection, unknown-zone rejection, successful creation with correct `estimated_fare_paisa` and
`status`, cross-passenger `GET /api/rides/:id` ownership).

**Tests passed/failed:** `npx jest --runInBand` → **31/31 passed** (health + auth + tesla + fare +
ride suites). All new source files pass `node --check`.

**Real-database verification (same live MariaDB instance as Phase 2):**
- `prisma migrate dev` applied the new tables/FKs/indexes cleanly.
- `prisma db seed` populated all 8 zones with correct clusters — verified via `GET /api/zones`
  against a running server.
- Created a real ride request via `POST /api/rides` (Nusrat, Banani → Mohakhali) against the live
  DB: response showed `estimatedFarePaisa: 7500` (= `3000 + 3*1500`, exactly matching the 3km
  distance from the master plan's own worked example), `status: "REQUESTED"`, `farePaisa: null`.
- Verified live: identical pickup/destination → 400; unknown zone id → 400; driver-role token →
  403; `GET /api/rides` returns the passenger's own history; `GET /api/rides/:id` for another
  passenger's ride → 403.
- Cleaned up the test ride request afterward (`rideRequest.deleteMany({})`) so seed data stays
  exactly as documented; server process stopped cleanly (port 4000 confirmed free).

**Documentation updated:** This file; `docs/decisions.md` items 12–14.

**Known issues / unresolved:** none blocking. Branch not yet merged into `master`, per the
review-before-merge pattern used throughout this session.

**Next task:** Phase 4 — `feature/tesla-pooling` (`pools`/`pool_memberships` tables, matching
service, `GET /api/driver/requests`, `POST /api/driver/pools/:poolId/accept`).

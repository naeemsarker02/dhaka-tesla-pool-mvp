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

**Known issues / unresolved:** none blocking.

**~~Merged into `master`~~** — merged `--no-ff` (`fa5e6be`) and pushed, after the pre-merge check
in the same conversation.

**Next task:** Phase 4 — see below.

---

## Phase 4 — `feature/tesla-pooling`

**Status:** Complete on branch `feature/tesla-pooling`, verified live against the same MariaDB
instance with the exact Nusrat/Rafiq scenario from `MASTER_PLAN.md` §5.2. Per the user's
instruction to proceed continuously through the plan, this phase (and those after it) merge into
`master` without a separate per-phase confirmation pause, unlike Phases 1–3.

**What was implemented:**
- **Prisma models:** `Pool` (`pools` — tesla_id FK, status enum, seats_occupied aggregate counter)
  and `PoolMembership` (`pool_memberships` — pool_id FK, ride_request_id **UNIQUE** FK, seats). No
  `FULL` status (computed, per `docs/erd.md`). Also added `RideStatusHistory` now rather than
  deferring to Phase 6 — `docs/decisions.md` item 15.
- **Matching service** (`src/services/matchingService.js`): given a new ride request, searches
  `OPEN` pools for one whose first member shares both pickup and destination cluster and has
  capacity, joins it if found; otherwise opens a new pool **only on an online Tesla with zero
  non-terminal pools** (the one-active-pool-per-Tesla invariant, `docs/decisions.md` item 7) or
  leaves the request unpooled if none qualify. Never touches `ride_request.status` — stays
  `REQUESTED` either way (Section 3.1). Wired into `rideService.createRideRequest` right after the
  ride request is created.
- **`GET /api/driver/requests`** (driver-only): `OPEN` pools belonging to the driver's own Tesla,
  with full membership detail (passenger's ride request + zones).
- **`POST /api/driver/pools/:poolId/accept`** (driver-own-Tesla only): ownership check, rejects
  non-`OPEN` pools (409), then in one transaction: pool `OPEN -> MATCHED`, every member's
  `ride_request` `REQUESTED -> MATCHED` with `fare_paisa` finalized (Section 5.1 — pooled discount
  fare for 2+ members, `estimated_fare_paisa` as-is for a solo pool) and one `ride_status_history`
  row per member.

**Files changed:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/**`,
`backend/src/services/{matchingService,poolService,rideService}.js`,
`backend/src/controllers/driverController.js`, `backend/src/routes/driver.js`,
`backend/src/app.js` (driver routes wired in).

**Tests added:** `backend/tests/pool.test.js` (5 cases — Nusrat+Rafiq join the same pool via two
sequential `matchRideRequest` calls and neither touches ride-request status; a Mirpur-bound request
doesn't join an incompatible pool; unpooled when nothing is eligible; capacity-exceeding pool
rejected) and `backend/tests/poolAccept.test.js` (5 cases — role/ownership/status guards, and the
exact Section 5.2 fare assertions: Nusrat's pooled fare = 7050 paisa, Rafiq's = 8550 paisa, and a
solo-pool member keeps `estimated_fare_paisa` unchanged = 12000 paisa). `tests/ride.test.js`'s
existing Prisma mock was extended with a `$transaction`/`pool`/`tesla` stub so ride-request
creation tests keep passing now that creation always triggers a matching attempt.

**Tests passed/failed:** `npx jest --runInBand` → **41/41 passed**. All new/changed source files
pass `node --check`.

**Real-database verification (same live MariaDB instance):** ran the exact worked example live —
Nusrat requests Banani→Mohakhali, Rafiq requests Banani→Gulshan; both landed in the same `OPEN`
pool (`seatsOccupied: 2`) while both stayed `REQUESTED`; Jashim's `GET /api/driver/requests` showed
the pool with both members; `POST /api/driver/pools/:poolId/accept` flipped the pool to `MATCHED`
and both ride requests to `MATCHED` with **`farePaisa: 7050`** (Nusrat) and **`farePaisa: 8550`**
(Rafiq) — exact match to §5.2. Separately verified: Shirin's unrelated Dhanmondi→Mirpur request,
made *after* Bullet's pool was already `MATCHED`, stayed unpooled (no eligible online Tesla with
zero non-terminal pools) — live confirmation of the one-active-pool-per-Tesla invariant.
`ride_status_history` confirmed to contain 2 rows (`REQUESTED -> MATCHED`, `changedBy` = Jashim's
user id). All test data cleared afterward to restore the clean seed state; server process stopped
cleanly.

**Documentation updated:** This file; `docs/decisions.md` items 15–16.

**Known issues / unresolved:** none blocking. `GET /api/driver/pools/:id` intentionally deferred to
Phase 6 (`docs/decisions.md` item 16).

**~~Merged into `master`~~** — merged `--no-ff` (`8fcefce`) and pushed.

**Next task:** Phase 5 — see below.

---

## Phase 5 — `feature/capacity-enforcement`

**Status:** Complete on branch `feature/capacity-enforcement`. Per the user's instruction to
proceed continuously, merges straight into `master` without a per-phase confirmation pause.

**What was implemented:**
- **Row-locked seat claim** (`matchingService.tryClaimSeatInPool`): rewrote the Phase 4 pool-join
  path to use the exact `MASTER_PLAN.md` §6 pattern — `tx.$queryRaw` `SELECT seats_occupied FROM
  pools WHERE id = ? FOR UPDATE` inside the transaction, re-checking capacity against the freshly
  locked value (not the earlier unlocked search result), then `tx.$executeRaw` to increment. A
  lost race returns `false` internally rather than throwing — the caller falls through to try a
  new pool instead of failing ride-request creation (`docs/decisions.md` item 17).
- **Row-locked Tesla selection** (`matchingService.findEligibleOnlineTesla`): also switched to
  `SELECT ... FOR UPDATE` on candidate online `teslas` rows, closing the matching race on the
  one-active-pool-per-Tesla invariant (item 7) that locking only `pools` would have left open.
- **Integration test track:** `backend/tests/integration/concurrency.test.js`, run via
  `npm run test:integration` against the real Prisma client and a live database — never mocked,
  never part of default `npm test` (`jest.config.js` now ignores `tests/integration/`;
  `jest.integration.config.js` is the dedicated config). `tests/setupEnv.js` now loads `.env` first
  so this suite gets the real `DATABASE_URL`.
- Updated the Phase 4 mocked unit tests (`ride.test.js`, `pool.test.js`) for the new
  `$queryRaw`/`$executeRaw`-based transaction internals, and added a new `pool.test.js` case for
  the "lost the race, falls through to unpooled" path.

**Files changed:** `backend/src/services/matchingService.js` (rewritten locking logic),
`backend/tests/{ride,pool}.test.js` (mock updates), `backend/tests/integration/concurrency.test.js`
(new), `backend/jest.config.js`, `backend/jest.integration.config.js` (new),
`backend/tests/setupEnv.js`, `backend/package.json` (`test:integration` script).

**Tests added:** `pool.test.js` +1 case (lost-race fallback). New
`tests/integration/concurrency.test.js` — real-DB race: seeds a pool to 1-seat-from-capacity, races
two concurrent `matchRideRequest` calls for the last seat via `Promise.all`, asserts exactly one
wins and `seats_occupied` never exceeds capacity.

**Tests passed/failed:** `npm test` → **42/42 passed** (unit, mocked). `npm run test:integration`
→ **1/1 passed**, confirmed deterministic across **5 consecutive runs** after a test-isolation fix
(see below). All changed/new files pass `node --check`.

**Real-database verification:**
- Raw locking behavior confirmed directly, outside the app: two manual `$transaction` calls, one
  sleeping mid-transaction while holding `FOR UPDATE`; the second's locking read correctly blocked
  until the first committed, then saw the incremented value — proves MariaDB/InnoDB `FOR UPDATE`
  is actually serializing these transactions, not just syntactically present.
- **A real bug the integration test caught (not a locking bug):** the first integration-test run
  failed — investigation showed the losing race participant correctly fell back to opening a new
  pool on the seeded `Bullet` (which was legitimately online with no active pool at that moment) —
  correct production behavior, but it broke the test's implicit assumption that no other eligible
  Tesla existed. Fixed by having the test temporarily take other online Teslas offline for its
  duration, restored afterward — 5/5 deterministic passes since. Full account: `docs/decisions.md`
  item 18.
- Verified Bullet's status was correctly restored to `ONLINE` and no stray pools remained after
  the test-fixing process (one orphaned pool from the initial failed run was manually cleared).

**Documentation updated:** This file; `docs/decisions.md` items 17–18.

**Known issues / unresolved:** none blocking. `MASTER_PLAN.md` §6/§8's "return 409 on overbooking"
framing doesn't map 1:1 onto this codebase's automatic-matching design (no dedicated claim-seat
endpoint exists) — resolved as a graceful internal fallback instead, reasoned through in
`docs/decisions.md` item 17.

**~~Merged into `master`~~** — merged `--no-ff` (`830f7b0`) and pushed.

**Next task:** Phase 6 — see below.

---

## Phase 6 — `feature/ride-lifecycle`

**Status:** Complete on branch `feature/ride-lifecycle`, verified live end-to-end against the same
MariaDB instance. No new unspecified-requirement calls this phase — implementation follows
`MASTER_PLAN.md` §6.1/§7 precisely, no new `docs/decisions.md` entries needed.

**What was implemented:**
- **Shared state-machine helper** (`src/lib/stateMachine.js`): `POOL_TRANSITIONS` and
  `RIDE_REQUEST_TRANSITIONS` tables (kept separate per entity even though their shapes match,
  since `RideRequest.status` and `Pool.status` are never conflated — `CLAUDE.md`), plus a
  `canTransition` helper. `poolService.acceptPool` (Phase 4) now uses this table too, instead of
  its own inline `OPEN`-only check.
- **`PATCH /api/driver/pools/:poolId/status`** (`poolService.advancePoolStatus`): validates the
  pool transition (`MATCHED->DRIVER_ARRIVED->STARTED->COMPLETED`, no skipping), ownership, then in
  one transaction cascades every member's `ride_request` to the same target status with the
  matching timestamp column (`arrivedAt`/`startedAt`/`completedAt`) and writes one
  `ride_status_history` row per member. Sets `pool.completedAt` on the `COMPLETED` transition.
- **`POST /api/rides/:id/cancel`** (`rideService.cancelRideRequest`): full Section 6.1 flow in one
  transaction — re-checks status (avoiding a stale-read race with a driver simultaneously
  advancing the pool), only valid from `REQUESTED`/`MATCHED`, sets `CANCELLED` + `cancelledAt`,
  writes history, and if a `pool_membership` exists: row-locks the pool (`SELECT ... FOR UPDATE`,
  same Section 6 pattern as the seat claim) before deleting the membership and decrementing
  `seats_occupied`; cancels the pool too if that was its last member (whether the pool was `OPEN`
  or already `MATCHED`).
- **`GET /api/driver/pools/:id`** and **`GET /api/driver/history`**: the two endpoints deferred
  from Phase 4 (`docs/decisions.md` item 16) — full single-pool detail (any status, not just
  `OPEN`) and all-pools-for-this-Tesla history respectively.

**Files changed:** `backend/src/lib/stateMachine.js` (new),
`backend/src/services/{poolService,rideService}.js`,
`backend/src/controllers/{driverController,rideController}.js`,
`backend/src/routes/{driver,rides}.js`, `backend/src/validators/pool.js` (new).

**Tests added:** `backend/tests/poolStatus.test.js` (7 cases: role guard, invalid status value,
cross-driver ownership, stage-skip rejection, already-terminal rejection, a full
`MATCHED->DRIVER_ARRIVED` cascade with history-row assertions, and `STARTED->COMPLETED` setting
`pool.completedAt`) and `backend/tests/cancel.test.js` (7 cases: cross-passenger ownership,
rejection from each of `DRIVER_ARRIVED`/`STARTED`/`COMPLETED`, cancel-from-`REQUESTED` with no
membership to release, cancel-from-`MATCHED` releasing membership + decrementing seats while
another member remains, and cancelling the last member cancelling an `OPEN` pool and separately a
`MATCHED` pool).

**Tests passed/failed:** `npx jest --runInBand` → **57/57 passed**. All source files pass
`node --check`.

**Real-database verification (same live MariaDB instance) — the master plan's explicit "full
valid lifecycle passes for a pooled pair" requirement:**
- Ran the complete lifecycle live for a real Nusrat+Rafiq pool: `POST /api/rides` (x2) →
  auto-matched into one pool → `accept` (`MATCHED`) → `DRIVER_ARRIVED` → attempted skip straight to
  `COMPLETED` (correctly **409**) → `STARTED` → `COMPLETED`. Confirmed Nusrat's ride request ended
  with `status: COMPLETED` and all four timestamps (`matchedAt`/`arrivedAt`/`startedAt`/
  `completedAt`) set, `farePaisa` still `7050` from Phase 4. Confirmed 8 `ride_status_history` rows
  (2 members × 4 transitions).
- Cancel-already-`COMPLETED` → correctly **409**.
- A fresh Shirin request auto-pooled onto Bullet (its other pool was terminal/`COMPLETED`, so
  Bullet was legitimately eligible again) — cancelling it from `REQUESTED` correctly released the
  membership, decremented `seats_occupied` to 0, and **cancelled the now-empty pool** — a live,
  unscripted confirmation of the "cancelling the last member cancels the pool" rule, not just the
  scenario I'd planned to test.
- A separate Nusrat+Rafiq pool: accepted, Nusrat cancelled from `MATCHED` — pool correctly stayed
  `MATCHED` with `seatsOccupied` decremented to 1, Rafiq's membership and `farePaisa` (8550)
  untouched (confirms the documented no-retroactive-recalculation limitation, §6.1 step 6).
  Advanced that pool to `DRIVER_ARRIVED`, then Rafiq's cancel attempt correctly **409**'d.
- `GET /api/driver/pools/:id` and `GET /api/driver/history` both verified returning correct data
  live (history showed all 3 pools created during this verification pass, correct statuses).
- All test data cleared afterward; server process stopped cleanly (port 4000 confirmed free).

**Documentation updated:** This file.

**Known issues / unresolved:** none blocking.

**~~Merged into `master`~~** — merged `--no-ff` (`cf06864`) and pushed.

**Next task:** Phase 7 — see below.

---

## Phase 7 — `feature/frontend-passenger-flow`

**Status:** Complete on branch `feature/frontend-passenger-flow`, verified live in a real browser
against the real running backend (not just a production build check).

**What was implemented:**
- **`lib/api.js`:** thin `fetch` wrapper (`apiFetch`), `ApiError` class carrying HTTP status +
  Zod `details`.
- **`lib/AuthContext.js`:** React context holding `{ token, user }`, persisted to `localStorage`
  (`docs/decisions.md` item 4), restored on mount behind an `isLoading` flag so a page refresh
  doesn't bounce a logged-in user before the restore finishes. Exposes `signup`/`login`/`logout`.
  Wired into the app via `app/providers.js` (client component) imported from the (server) root
  `app/layout.js`.
- **`components/RequireAuth.js`:** auth/role guard — waits for `isLoading`, redirects to `/login`
  if no token, redirects to `/` if the role doesn't match. Every auth-aware page is a client
  component (`"use client"`) fetching after mount, per the no-SSR-auth rule.
- **`components/NavBar.js`, `components/StatusBadge.js`, `lib/format.js`** (paisa → ৳X.XX,
  integer-only, no float math in the display layer either).
- **Pages:** `/signup`, `/login` (role selector, demo-credentials hint), `/rides/new`
  (pickup/destination dropdowns from live `GET /api/zones`, seats input, same-zone client guard),
  `/rides` (history list, empty/loading/error states), `/rides/[id]` (status detail, estimated vs.
  finalized fare, cancel button shown only when `REQUESTED`/`MATCHED`, polls every 5s while
  non-terminal and stops once `COMPLETED`/`CANCELLED`). `/` shows role-appropriate links.
- **Backend tweak:** `rideService.getRideRequestById`/`listRideRequestsForPassenger` now
  `include: { pickupZone, destinationZone }` so the frontend can show zone names instead of raw
  UUIDs — verified no existing test asserted exact response shape (`node --check` + `npm test`
  re-run confirmed no regression, still 57/57).

**Files changed:** `frontend/lib/{api,AuthContext,format}.js` (new),
`frontend/components/{RequireAuth,NavBar,StatusBadge}.js` (new), `frontend/app/providers.js`
(new), `frontend/app/layout.js`, `frontend/app/page.js`, `frontend/app/{signup,login}/page.js`
(new), `frontend/app/rides/page.js` (new), `frontend/app/rides/new/page.js` (new),
`frontend/app/rides/[id]/page.js` (new), `backend/src/services/rideService.js`.

**Tests passed/failed:** Backend regression: `npm test` → **57/57 passed** (unchanged, confirms
the zone-include tweak didn't break anything). Frontend: `npx next build` → clean production build,
all 7 routes compiled (no TypeScript in this repo, so this build is the closest thing to a
type/syntax check across the whole frontend).

**Real, in-browser verification (Chrome, real backend on :4000, frontend dev server on :3001 —
port 3000 was occupied) — this is UI verification, not just a build check:**
- Logged in as Nusrat (seed credentials) → correctly redirected to `/rides`, empty state shown
  correctly ("You haven't requested any rides yet").
- `/rides/new` loaded the real 8 zones from `GET /api/zones` live; requested Banani → Mohakhali,
  submitted → redirected to `/rides/[id]` showing **`REQUESTED`**, **estimated fare ৳75.00** — the
  exact paisa-to-taka conversion of the real `7500` paisa the backend computed (3km × ৳15/km + ৳30
  base), confirming the display-layer formatting is correct end-to-end, not just visually
  plausible.
- Clicked "Cancel this ride" → status updated to `CANCELLED` in place, cancel button correctly
  disappeared (state machine respected client-side too).
- `/rides` history list correctly showed the cancelled ride with its status badge and formatted
  fare.
- Logged out, then navigated directly to `/rides` while unauthenticated → `RequireAuth` correctly
  redirected to `/login` (confirms the guard works on direct navigation, not just via in-app
  links).
- No console errors observed during the flow (`read_console_messages`, `onlyErrors: true`).
- All test ride/pool/history data created during this verification pass was cleared from the
  database afterward; both dev servers stopped cleanly.

**Documentation updated:** This file.

**Known issues / unresolved:** none blocking. No loading-skeleton polish (plain "Loading…" text) —
functionally correct, acceptable for an MVP; could be revisited for visual polish later, not a
functional gap. Passenger flow only — driver UI is Phase 8.

**~~Merged into `master`~~** — merged `--no-ff` (`6ae8df9`) and pushed.

**Next task:** Phase 8 — see below.

---

## Phase 8 — `feature/frontend-driver-flow`

**Status:** Complete on branch `feature/frontend-driver-flow`, verified live in a real browser —
full accept → arrive → start → complete flow, with a real Nusrat+Rafiq pool.

**What was implemented:**
- **Backend addition:** `GET /api/teslas/me` (driver-only) — not in `MASTER_PLAN.md` §7's table;
  the driver frontend needs some way to discover its own Tesla (id + status) without a hardcoded
  id. Returns `null` (not 404) when the driver hasn't registered a Tesla yet, since that's a valid
  state. Flagged in `docs/decisions.md` item 19. Added 3 test cases (`tests/tesla.test.js`).
- **`/driver`:** dashboard — shows the driver's Tesla (or a register-Tesla form if none exists
  yet) with an online/offline toggle (`PATCH /api/teslas/:id/status`), and the list of pending
  `OPEN` pools (`GET /api/driver/requests`) each with an "Accept pool" button
  (`POST /api/driver/pools/:poolId/accept`) and a "View details" link.
- **`/driver/pools/[id]`:** full pool manifest (passenger zones, seats, per-member status/fare)
  plus a single "Mark as `<next status>`" button that only ever offers the one legal next
  transition (`MATCHED->DRIVER_ARRIVED->STARTED->COMPLETED`, mirroring
  `backend/src/lib/stateMachine.js`), disappearing once the pool is `COMPLETED`.
- **`/driver/history`:** all pools tied to the driver's Tesla, any status, via
  `GET /api/driver/history`.
- `components/NavBar.js` updated with a driver "History" link.

**Files changed:** `backend/src/services/teslaService.js`,
`backend/src/controllers/teslaController.js`, `backend/src/routes/teslas.js`,
`backend/tests/tesla.test.js`, `frontend/app/driver/page.js` (new),
`frontend/app/driver/pools/[id]/page.js` (new), `frontend/app/driver/history/page.js` (new),
`frontend/components/NavBar.js`.

**Tests passed/failed:** Backend: `npm test` → **60/60 passed** (57 + 3 new `GET /api/teslas/me`
cases). Frontend: `npx next build` → clean production build, all 10 routes compiled.

**Real, in-browser verification (Chrome, real backend + frontend dev server, same session as
Phase 7's browser check):**
- Seeded a real Nusrat+Rafiq pool via direct API calls, then logged in as Jashim through the UI.
- Dashboard correctly showed Bullet (`ONLINE`, capacity 3) and the pending pool with both
  passengers' routes and estimated fares (Banani→Gulshan ৳90.00, Banani→Mohakhali ৳75.00).
- Clicked "Accept pool" → pool correctly disappeared from "Pending pools" (now `MATCHED`, not
  `OPEN`).
- `/driver/history` correctly listed it; clicked through to `/driver/pools/[id]` — **exact fares
  ৳85.50 (Rafiq) and ৳70.50 (Nusrat) displayed**, matching the Section 5.2 worked example digit for
  digit.
- Clicked "Mark as DRIVER_ARRIVED" → both passengers' status badges updated to `DRIVER_ARRIVED` in
  place. Repeated for `STARTED` and `COMPLETED` — the advance button correctly disappeared once
  terminal.
- Checked console for errors: one hydration warning (`cz-shortcut-listen` attribute mismatch) —
  identified as coming from a browser extension (ColorZilla) injecting a DOM attribute, not an
  application bug.
- All test data cleared afterward; both dev server processes stopped cleanly.

**Documentation updated:** This file; `docs/decisions.md` item 19.

**Known issues / unresolved:** none blocking.

**Next task:** Phase 9 — `feature/docker-deploy` (full `docker-compose.yml` with automatic
migrations/seed, `.env.example` finalized).

---

## Backfill — Section 13.1/13.2/13.6 and Section 6.2 (2026-09-23)

**Status:** Complete, on `feature/docker-deploy` (found and fixed while re-reading
`MASTER_PLAN.md` in full against the code, at the user's request to "follow all the instructions").

**What was found:** four requirements marked "part of the plan, not optional extras"
(`MASTER_PLAN.md` Section 0) had never actually been implemented, despite Phases 3 and 6 above
being marked "Complete":
- Section 13.1 — `Idempotency-Key` support on `POST /api/rides`.
- Section 13.2 — one active ride request per passenger (409 on a second one).
- Section 13.6 — `seatsRequested` bounded to `1..3`.
- Section 6.2 — grace-window cancellation (`late_cancellation`, `cancellation_fee_paisa`).

**What was implemented:**
- **Schema:** `ride_requests` gained `idempotency_key` (nullable, unique), `late_cancellation`
  (boolean, default false), `cancellation_fee_paisa` (nullable int) — migration
  `20260923110514_add_idempotency_and_grace_window_cancellation`, applied to the same live MariaDB
  instance used throughout.
- **`rideService.createRideRequest`:** now takes an optional `idempotencyKey`; a repeat with the
  same `(passengerId, idempotencyKey)` returns the original row (checked up front and again on a
  `P2002` unique-constraint race) instead of duplicating or re-matching. One-active-ride check runs
  before zone validation (`ACTIVE_RIDE_STATUSES = [REQUESTED, MATCHED, DRIVER_ARRIVED, STARTED]`).
- **`rideController.create`:** reads the key from the `Idempotency-Key` request header.
- **`src/validators/ride.js`:** `seatsRequested` now `.min(1).max(3)`.
- **`rideService.cancelRideRequest`:** computes `lateCancellation`/`cancellationFeePaisa` from the
  ride request's own `matchedAt` against `GRACE_WINDOW_SECONDS` (env, default 60), using a new
  `calculateCancellationFeePaisa` in `src/lib/fare.js` (`floor(farePaisa * 20 / 100)`).
- `.env.example`/`.env` gained `GRACE_WINDOW_SECONDS=60`.
- `docs/erd.md` updated with the three new `ride_requests` columns; `docs/decisions.md` item 20
  logs the gap and the fix; `MASTER_PLAN.md` Section 8 phase-status tracker corrected (it still
  read "Phase 4 is NEXT" despite Phases 4–8 being long since merged — see `MASTER_PLAN.md` Rev 5
  note).

**Files changed:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/**`,
`backend/src/lib/fare.js`, `backend/src/validators/ride.js`, `backend/src/services/rideService.js`,
`backend/src/controllers/rideController.js`, `backend/.env.example`, `backend/.env`,
`docs/erd.md`, `docs/decisions.md`, `MASTER_PLAN.md`.

**Tests added:** `tests/ride.test.js` — seat-bounds rejection (over/under), one-active-ride 409,
idempotency replay (no duplicate `create` call), idempotency-miss creates and stores the key.
`tests/cancel.test.js` — grace-window free cancel (≤60s), late cancel with fee computed
(`floor(8550 * 20 / 100) = 1710`), cancel-from-`REQUESTED` always free; updated the existing exact
`rideRequest.update` assertion to include the two new fields.

**Tests passed/failed:** `npm test` → **68/68 passed** (60 existing + 8 new).
`npm run test:integration` → 1/1 passed (unaffected).

**Real-database verification (same live MariaDB instance):**
- `seatsRequested: 4` → 400 with a clear Zod message.
- Cancelling a real leftover `MATCHED` ride request from ~12 hours earlier correctly returned
  `lateCancellation: true`, `cancellationFeePaisa: 1500` (`floor(7500 * 20 / 100)`, matching the
  request's own `farePaisa`).
- `POST /api/rides` with `Idempotency-Key: test-key-1` twice returned the identical ride request id
  both times — confirmed only one row exists in the DB with that key.
- A second, distinct `POST /api/rides` while the first was still active correctly 409'd.
- Test data cleaned up (cancelled) afterward; leftover dev server process (holding the Prisma
  client DLL locked, blocking `prisma generate`) stopped and restarted cleanly during
  verification.

**Documentation updated:** This file; `docs/decisions.md` item 20; `docs/erd.md`; `MASTER_PLAN.md`
Rev 5 note and Section 8 phase statuses.

**Known issues / unresolved:** none blocking.

**Next task:** back to Phase 9 — `feature/docker-deploy`.

---

## Phase 9 — `feature/docker-deploy`

**Status:** Complete — genuinely verified end-to-end, via GitHub Actions CI (no Docker Engine is
available in the local development environment; CI substitutes for it, see the update below).

**What was implemented (Dockerfiles/compose already existed from earlier work on this branch;
this pass reviewed, fixed, and verified everything that could be verified):**
- `backend/Dockerfile` — `node:20-alpine`, installs deps (including `prisma` CLI as a regular
  dependency, needed at container runtime, not just build time), `prisma generate`, runs
  `docker-entrypoint.sh` as `ENTRYPOINT` with `node src/server.js` as `CMD`.
- `backend/docker-entrypoint.sh` — runs `prisma migrate deploy` then `prisma db seed`
  automatically on every container start before `exec`-ing the real command (both idempotent, safe
  to re-run). `.gitattributes` forces LF line endings on `*.sh` so this doesn't break inside the
  Linux container if checked out on Windows.
- `frontend/Dockerfile` — `node:20-alpine`, `NEXT_PUBLIC_API_URL` passed as a build `ARG` (Next.js
  bakes `NEXT_PUBLIC_*` vars into the client bundle at build time, not read at container runtime),
  `npm run build` then `npm start`.
- `docker-compose.yml` — `mysql:8` (real MySQL, not MariaDB, with an `mysqladmin ping`
  healthcheck), `backend` (waits for MySQL healthy, now also has its own `GET /health` healthcheck,
  `GRACE_WINDOW_SECONDS` added to its env block — was missing from an earlier compose revision),
  `frontend` (now waits for `backend: condition: service_healthy` instead of just "started").
  `backend`/`frontend` ports published to the host; `NEXT_PUBLIC_API_URL` correctly points at
  `localhost:4000` (host-reachable), not the internal `backend` service name, since it runs in the
  browser.
- `backend/.dockerignore`, `frontend/.dockerignore` — exclude `node_modules`, `.env`/`.env.local`,
  `tests`, `.next`.

**Files changed this pass:** `docker-compose.yml` (`GRACE_WINDOW_SECONDS`, backend healthcheck,
frontend `depends_on` condition), `docs/decisions.md` (item 21), `docs/scaling.md` (new — the
bonus Section 10 doc, referenced from the README since Phase 0 as "not yet written"), `README.md`
(Docker Setup, Prerequisites, Environment Variables, Known Limitations, AI Usage, Features
Implemented sections all updated to current reality).

**Tests passed/failed:** `npm test` → 68/68 (unchanged, re-run after `docker-compose.yml`/doc
edits to confirm no regression). `npm run test:integration` → 1/1.

**Verification performed (no Docker Engine available in this environment — confirmed via
`docker --version` failing in both the POSIX shell and PowerShell):**
- `docker-compose.yml` YAML syntax validated (`python -c "import yaml; yaml.safe_load(...)"`).
- Every Dockerfile and `docker-entrypoint.sh` reviewed line by line for correctness.
- Ran what the containers actually execute, directly on the host: `npx next build` (clean,
  10/10 routes) then `npm start` — confirmed `200` on `/` and `/login` in production mode (after
  clearing a stale `.next` build cache left over from an earlier interrupted build — a leftover
  artifact, not a code bug); `node src/server.js` (backend, already live-verified in the Section
  13/6.2 backfill pass immediately prior).

**Known issues / unresolved at the time this section was first written:**
- Not run end-to-end with a live Docker Engine — reasoned through by reading the configuration
  only. Flagged in README's Known Limitations rather than assumed to work.
- MySQL 8 specifically (vs. MariaDB 10.4, the local dev DB) had not been directly exercised —
  Phase 2's carry-forward item was still technically open.
- No public deployment yet.

**Resolved the same day, via GitHub Actions CI (2026-09-23):** added
`.github/workflows/docker-verify.yml` — builds the full stack, polls `GET /health` until 200,
spot-checks seed data via `GET /api/zones`, dumps logs, tears down. No Docker Engine is available
locally, but GitHub Actions' free tier ships one, and it's real `mysql:8`, closing the Phase 2
carry-forward item too.

**The first CI run immediately caught two real bugs** that static Dockerfile review had missed:
1. `ubuntu-latest` runners ship a system MySQL already bound to port 3306, colliding with the
   `mysql` service's port mapping — `docker compose up` failed outright. Fixed with a
   `systemctl stop mysql.service` step before compose starts.
2. With that fixed, `backend`'s `prisma migrate deploy` failed inside the container:
   `node:20-alpine` doesn't ship OpenSSL, so Prisma's schema-engine binary couldn't start and
   printed a non-JSON error the CLI choked on. Prisma's own log said exactly what to do — fixed
   with `apk add --no-cache openssl` in `backend/Dockerfile`. See `docs/decisions.md` item 22 for
   the full account, including why this is exactly the kind of bug that's invisible without
   actually running the stack.

**Third CI run succeeded end-to-end**, confirmed via the workflow's own log: MySQL healthy →
backend migrations applied + seeded + `GET /health` → 200 → `GET /api/zones` returned all 8 real
seeded zones with correct clusters. Phase 9's Docker requirement is now genuinely, not just
statically, verified.

**Status correction:** the "Not run end-to-end" limitation above is resolved. Updated
`README.md` Known Limitations, `MASTER_PLAN.md`'s Phase 9 checklist, and the top status line of
this section accordingly.

**Next task:** Phase 10 — pre-release stabilization (full test pass together, docs review,
screenshots, then cut `pre-release`). Phase 11 (6-minute video + `release/v1.0.0`) needs the
project owner's own recording — out of scope for an automated session.

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

**Known issues / unresolved — read before assuming this is DB-verified:**
- **No MySQL or Docker is available in this sandbox** (`docker`/`mysql` commands not found, no
  local MySQL service). This means:
  - The migration SQL was generated statically (`prisma migrate diff --from-empty`, which does not
    require a live connection) and has **never been applied** to a real MySQL instance in this
    session. It has not been run through `prisma migrate dev`/`migrate deploy` against a live DB.
  - All tests use a **mocked Prisma client** (`jest.mock("../src/lib/prisma")`) — they verify
    validation, auth/role middleware, hashing, JWT issuance, ownership logic, and HTTP status
    mapping, but **not** actual SQL execution, the `UNIQUE`/`CHECK` constraints, or FK behavior.
  - **Action needed from the project owner:** run `docker compose up -d mysql` (or point
    `DATABASE_URL` at any reachable MySQL 8), then `npx prisma migrate deploy && npx prisma db seed`
    inside `backend/`, and re-run `npm test` with a real DB to confirm the migration actually
    applies cleanly and the app talks to it correctly. This is flagged rather than silently
    claimed as verified.
- `bcrypt`/`next` dependency advisories from Phase 1 (`docs/decisions.md` items 8–9) still stand,
  unchanged.
- Branch `feature/passenger-auth` not yet merged into `master` — holding for review.

**Next task:** Phase 3 — `feature/ride-request` (zones table + seed, `ride_requests` table,
`POST /api/rides` with `estimated_fare_paisa`).

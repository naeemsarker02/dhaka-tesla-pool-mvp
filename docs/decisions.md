# Decisions & Assumptions Log

> Append one entry every time an unspecified-requirement call is made while building. Do not
> backfill after the fact — write the entry the same day the call is made. Seed entries below are
> copied verbatim from `MASTER_PLAN.md` Section 12, plus new entries discovered during Phase 0
> analysis.

### 1. Pool `FULL` is not a persisted status
It's computed from `seats_occupied >= capacity` at read time in the matching service. No extra
transition behavior needs it as its own state.

### 2. Final fare is computed once, at `MATCHED` (driver acceptance)
Not recalculated on every pool-membership join or after `MATCHED`. Cancellations after `MATCHED`
do not retroactively recalculate remaining passengers' fares in this MVP (Section 6.1 of the
master plan).

### 3. One Tesla per driver (`teslas.driver_id UNIQUE`)
Simplifies ownership checks; multi-Tesla fleets are out of scope.

### 4. JWT is stored client-side in `localStorage`, not an `httpOnly` cookie
Frontend and backend are separate services, and a cross-origin cookie setup adds complexity out of
proportion to this MVP. Protected pages are client-rendered, not SSR-authenticated.

### 5. Zone clusters are a flat, single-column grouping (`zones.cluster`)
Applied independently to pickup and destination legs, rather than real geo-distance or a
two-dimensional cluster scheme.

### 6. Free-tier hosting availability is verified immediately before deployment
Not assumed fixed at plan-writing time — whichever MySQL-compatible free host is actually up gets
used; the Docker Compose setup is the documented, reproducible fallback if none is available.

---

### 7. One-active-pool-per-Tesla invariant + new-pool Tesla selection (2026-09-22)

**Gap found:** `MASTER_PLAN.md` Section 3 specifies `pools.tesla_id` as a required (non-nullable)
FK, and Section 4's matching rule only checks pickup cluster / destination cluster / capacity —
it never says how a *new* `OPEN` pool picks which Tesla to attach to, and never states whether a
single Tesla can have more than one non-terminal pool open at once. Physically, a driver can only
run one trip at a time, so this was a real correctness gap, not a style question — surfaced before
writing it into `docs/erd.md`, per `CLAUDE.md`'s "stop before a risky architectural decision" rule.

**Decision (confirmed with project owner):**
- **Invariant:** a Tesla may have at most **one** non-terminal pool
  (`OPEN`/`MATCHED`/`DRIVER_ARRIVED`/`STARTED`) at a time.
- **New-pool Tesla selection:** when a ride request doesn't match any existing compatible `OPEN`
  pool, the matching service creates a new `OPEN` pool only on an **online** Tesla that currently
  has zero non-terminal pools. If no such Tesla exists, the ride request is created but stays
  unpooled (`status = REQUESTED`, no `pool_membership` row — already valid per the ERD's
  zero-or-one `RIDE_REQUESTS ||--o| POOL_MEMBERSHIPS` relationship). It becomes eligible for
  matching again on the next matching pass (e.g. the next `POST /api/rides` call, or when a Tesla
  comes back online).

**Enforcement, at MVP scope:** application/service-layer check inside the same transaction that
creates or accepts a pool — query for an existing non-terminal pool on the target Tesla before
creating a new one or accepting an `OPEN` one. Not yet a DB-level constraint (a partial/filtered
unique index on `pools (tesla_id)` scoped to non-terminal statuses isn't natively expressible in
MySQL the way it is in Postgres; a generated/stored boolean column + unique index is the fallback
if this needs to move to the DB layer later — documented here as a known trade-off, not built for
MVP since app-level enforcement inside a locked transaction is sufficient at this scale and is
what's actually graded per Section 3 of the master plan).

**Why not "allow multiple concurrent pools per Tesla":** would let a driver accept two pools that
are physically impossible to run simultaneously, and the brief's own lifecycle table implies one
trip per Tesla at a time (`DRIVER_ARRIVED`/`STARTED`/`COMPLETED` cascade to "every member" of *a*
pool, singular).

**Practical impact on this MVP:** with only one Tesla (Bullet) in the seed data, this invariant
rarely binds in the demo itself, but it's the technically correct rule and is very likely to come
up as an interview question ("what stops a driver double-booking?").

---

### 8. Next.js pinned to `^14.2.35`, not `^14.2.5` (2026-09-22)

**Context:** Phase 1 scaffold. `npm audit` on a fresh `frontend` install with `next@14.2.5` (the
version first scaffolded) reported a critical/high set of Next.js advisories (RSC cache poisoning,
SSRF in Server Actions/rewrites, an unauthenticated RCE on Windows-hosted servers, among others).
`npm audit fix --force` offered to resolve them only by jumping to `next@16`, a breaking major
version change not justified for an MVP scaffold.

**Decision:** bumped to `next@^14.2.35` (the latest 14.x patch release at the time), which
resolves the Next.js-authored advisories while staying on the same major version the master plan
specified (App Router). One remaining high-severity `postcss` advisory lives inside `next`'s own
bundled `node_modules/postcss` (not the project's top-level `postcss` devDependency) and has no
fix short of the Next 16 major bump — accepted as a build-tool-only, not runtime-exposed, MVP
risk. Revisit if a stricter security bar is required for submission.

### 9. `bcrypt` native build has an unresolved transitive `tar` advisory (2026-09-22)

**Context:** Phase 1 scaffold. `npm audit` on `backend` reports a critical/high advisory in `tar`,
pulled in transitively by `@mapbox/node-pre-gyp`, which `bcrypt` uses only to build/install its
native bindings (not a runtime dependency of the running server).

**Decision:** left `bcrypt` as specified in `MASTER_PLAN.md` §1 rather than substituting the
pure-JS `bcryptjs` to sidestep the advisory — that would be a library swap without approval for a
build-time-only exposure. Logged here as a known issue; revisit only if it becomes a real blocker
(e.g. a CI security gate) rather than silently changing the dependency.

### 10. `capacity > 0` CHECK constraint added by hand to the migration SQL (2026-09-22)

**Context:** Phase 2. `MASTER_PLAN.md` §3 requires `teslas.capacity` to have a `CHECK (capacity >
0)` constraint (MySQL 8.0.16+). Prisma's schema language (as of the installed 5.22.0) has no
native `@check`/`@@check` attribute, so it cannot be expressed in `schema.prisma` and generated
automatically.

**Decision:** generated the rest of the migration via `prisma migrate diff --from-empty
--to-schema-datamodel=prisma/schema.prisma --script`, then hand-appended the `ALTER TABLE teslas
ADD CONSTRAINT teslas_capacity_positive CHECK (capacity > 0);` statement to the resulting
`migration.sql`. This is a one-time addition to a generated file, not an ongoing manual process —
future schema changes still go through `prisma migrate dev`/`diff` normally; only this specific
constraint needs manual SQL since Prisma can't express it declaratively. Per `MASTER_PLAN.md` §3,
this is a second line of defense only — app-level capacity enforcement (the row-locked transaction
in §6) is what's actually relied on and graded.

### 11. Migration generated and validated without a live MySQL connection (2026-09-22)

**Context:** Phase 2. This sandbox has no `docker`/`mysql` available (checked and confirmed — see
`docs/PROGRESS.md` Phase 2 entry) and no other network-reachable MySQL instance was configured, so
`prisma migrate dev` (which requires a live connection + shadow database) could not be run.

**Decision:** used `prisma migrate diff --from-empty --to-schema-datamodel=<schema>` instead, which
computes the same CREATE TABLE/foreign-key SQL by diffing schema states rather than introspecting a
live database, and does not require connectivity. The resulting SQL was hand-verified against the
schema and is included as `backend/prisma/migrations/20260922000000_init/migration.sql` in
Prisma's standard migration-folder format, so `prisma migrate deploy` should apply it normally once
a real MySQL instance is available.

**Update (2026-09-22, same day):** confirmed. The project owner brought up a local XAMPP MySQL
instance; `prisma migrate deploy` applied this migration cleanly, `prisma db seed` populated it
correctly (verified: Jashim/Bullet/Nusrat/Rafiq/Shirin all present with correct roles/ownership),
and live HTTP requests against the running server (login, Tesla registration/ownership/uniqueness,
role/auth guards) all behaved as expected. See `docs/PROGRESS.md` Phase 2 for the full verification
log. From Phase 3 onward, migrations are generated with a live `prisma migrate dev` (this XAMPP
instance) rather than the static `migrate diff` workaround.

### 12. Zone clusters (beyond the one given example) and the full zone-distance table (2026-09-22)

**Context:** Phase 3. `MASTER_PLAN.md` §4 gives only one cluster explicitly
("Gulshan-Mohakhali corridor": Banani, Gulshan, Mohakhali) and only two distances (Banani-Mohakhali
= 3km, Banani-Gulshan = 4km, from the §5.2 worked example). The other 5 zones (Dhanmondi, Mirpur,
Uttara, Farmgate, Bashundhara) have no assigned cluster, and only 2 of the 28 possible zone-pair
distances are specified.

**Decision:** grouped the remaining zones into two more plausible clusters —
"Dhanmondi-Mirpur-Farmgate corridor" and "Uttara-Bashundhara corridor" — and filled in the
remaining 26 distances as flat, made-up (not real-geo) whole-km integers, all in
`backend/src/data/zones.js`, which is the single source of truth for both the seed script and the
fare/matching services (Phase 4) so the two can never drift apart. The two given values (3km,
4km) are preserved exactly. This is the same category of assumption as item 5 (flat cluster
grouping, no real geo) — just filling in the specific numbers item 5 left open.

### 13. Local dev database is MariaDB, not MySQL (2026-09-22)

**Context:** Phase 2/3 verification. The project owner's local XAMPP install runs **MariaDB
10.4.32**, not MySQL. `MASTER_PLAN.md` §1 specifies MySQL (InnoDB) specifically.

**Decision:** proceeded without substituting anything — MariaDB 10.4 supports everything used so
far (InnoDB, `CHECK` constraints confirmed present via `information_schema`, UUID-as-VARCHAR
primary keys, the exact Prisma queries used). Not treated as equivalent to "verified on MySQL 8"
though — noted here so it isn't silently assumed. If deploying to a real MySQL host later (per
§1's hosting row — PlanetScale/Railway/Aiven), a smoke test there is still worth doing rather than
assuming local MariaDB behavior generalizes perfectly.

### 14. Added `GET /api/zones` (public), not in the master plan's Section 7 table (2026-09-22)

**Context:** Phase 3. `MASTER_PLAN.md` §7's endpoint contract table has no zones-listing endpoint,
but the frontend (Phase 7, per the plan's own Phase 7 checklist: "pickup, destination dropdowns
from zones") needs some way to fetch the zone list, and tests/manual verification need it too.

**Decision:** added `GET /api/zones` (public, no auth — zones are non-sensitive reference data,
not a user-owned resource) directly in a thin controller with no service layer, since it's a
zero-logic passthrough read, unlike every other endpoint in this codebase. A small, clearly-scoped
addition rather than a scope change — flagged here per `CLAUDE.md`'s instruction not to silently
invent requirements, even minor ones.

### 15. `RideStatusHistory` model added in Phase 4, not deferred to Phase 6 (2026-09-22)

**Context:** `docs/erd.md` (Phase 0) already specifies a `RIDE_STATUS_HISTORY` table logging every
`ride_request` status transition. `MASTER_PLAN.md` §8's Phase 6 checklist is the first place that
explicitly calls out *writing* history rows ("writes one ride_status_history row per affected
passenger, same transaction" — for the `DRIVER_ARRIVED`/`STARTED`/`COMPLETED` cascade). But Phase 4
is where the *first* status transition (`REQUESTED -> MATCHED`, on pool accept) actually happens.

**Decision:** added the `RideStatusHistory` Prisma model now and started writing rows at the
`MATCHED` transition in `poolService.acceptPool`, rather than adding the model later and having to
backfill or skip logging the first transition. This isn't scope creep — the table was already
part of the Phase 0 ERD, and "log every status change, in the same transaction as the change" is
the ERD's own stated purpose for it, not a Phase-6-only rule. Verified live: two
`ride_status_history` rows (`REQUESTED -> MATCHED`, `changedBy` = the accepting driver) were
written for the Nusrat/Rafiq pool-accept flow.

### 16. `GET /api/driver/pools/:id` intentionally not built in Phase 4 (2026-09-22)

**Context:** `MASTER_PLAN.md` §7's table lists this endpoint, but neither Phase 4's nor Phase 6's
checklist in §8 explicitly calls it out — Phase 4 only lists `GET /api/driver/requests` and
`POST /api/driver/pools/:poolId/accept`; Phase 6 is about lifecycle-status cascades and
cancellation.

**Decision:** left it out of Phase 4, keeping the README's API table entry as `⬜ Phase 6` per the
earlier plan. `GET /api/driver/requests` already returns each `OPEN` pool's full membership detail
(passengers, seats, zones), so nothing driver-facing is currently missing — a single-pool detail
view is a natural companion to add alongside Phase 6's status-cascade endpoint instead of as a
standalone addition now.

---

### 17. Lost seat-claim race falls back gracefully, never a public 409 (2026-09-23)

**Context:** Phase 5. `MASTER_PLAN.md` §6's code sample frames the row-locked capacity check as a
dedicated "claim seat" operation that throws `SeatsUnavailableError` on overbooking, and §8's Phase
5 checklist says "Return 409 on overbooking attempt." But this codebase has no dedicated claim-seat
endpoint — per §7's own contract table, matching is fully automatic, run inside `POST /api/rides`
right after the ride request is created (Phase 3/4). Failing the whole ride-request creation with
409 just because a candidate pool happened to fill up in the same instant would be worse UX and
inconsistent with the already-established (Phase 4) rule that an unmatched request simply stays
`REQUESTED` with no `pool_membership`.

**Decision:** `matchingService.matchRideRequest` still uses the exact §6 `SELECT ... FOR UPDATE`
pattern for the actual seat-claim write, but a lost race is handled as an internal `false` return,
not a thrown/propagated error — the caller then falls through to try opening a new pool on another
eligible Tesla, or leaves the request unpooled if none exists. `POST /api/rides` always returns 201
for a valid request; whether it ended up pooled is a `pooled`/`poolId` implementation detail, not a
user-facing failure. The underlying correctness guarantee §6 actually cares about —
`seats_occupied` can never exceed `tesla.capacity` under concurrency — is what's tested (item 18
below), not the specific "409" transport detail from a code sample written for a different
endpoint shape.

**Also locked, for the same reason:** new-pool Tesla selection (`findEligibleOnlineTesla`) now uses
`SELECT ... FOR UPDATE` on candidate online `teslas` rows too, not just `pools` — closing the
matching race for the one-active-pool-per-Tesla invariant (item 7) that a pools-only lock would
have left open (two concurrent ride requests could otherwise both decide the same idle Tesla is
free and each create a competing pool for it).

### 18. Concurrency correctness proven with a real-database integration test, not mocks (2026-09-23)

**Context:** Phase 5's required test ("simulate Nusrat + Shirin racing for the last seat... assert
exactly one succeeds and seats_occupied never exceeds capacity") is fundamentally about MySQL/
InnoDB row-lock behavior, which a mocked Prisma client cannot simulate — a mock can't reproduce a
second transaction actually blocking on `FOR UPDATE` until the first commits.

**Decision:** added `backend/tests/integration/concurrency.test.js`, run via a separate
`npm run test:integration` (its own `jest.integration.config.js`), using the **real** Prisma
client against the developer's live MySQL/MariaDB instance — never mocked, and never part of the
default `npm test` run (so unit tests stay runnable with no DB available, consistent with
`docs/decisions.md` item 11). It creates its own isolated Tesla/users, seeds a pool to 1 seat away
from capacity, then races two concurrent `matchRideRequest` calls for that last seat via
`Promise.all` and asserts exactly one wins and `seats_occupied` never exceeds capacity.

**A real bug this caught, worth recording:** the first run failed — one race participant ended up
`pooled: true` with a *different* `poolId` than expected. Investigation showed this wasn't a
locking bug at all: `findEligibleOnlineTesla` correctly searches *all* online Teslas system-wide
(matching real intended behavior — a losing seat-claim should legitimately fall back to any other
eligible Tesla, not just the one in the test), and the seeded `Bullet` was online with no active
pool at that moment, so the losing participant correctly opened a new pool on it. The test's
isolation assumption was wrong, not the application logic. Fixed by having the test temporarily
set any *other* online Teslas offline for its duration (restored in `afterAll`) so its own fixture
Tesla is deterministically the only eligible fallback. Raw `SELECT ... FOR UPDATE` blocking
behavior was separately confirmed directly (two transactions, one sleeping mid-transaction, the
second's locking read correctly stalled until the first committed and then saw the updated value).

### 19. Added `GET /api/teslas/me`, not in the master plan's Section 7 table (2026-09-23)

**Context:** Phase 8. The driver frontend (`/driver`) needs to know whether the logged-in driver
has a Tesla, and if so its id (to call `PATCH /api/teslas/:id/status`) and current online/offline
status. `MASTER_PLAN.md` §7's table has no "get my own Tesla" endpoint — the closest existing
options were `POST /api/teslas` (creates, wrong for a read) and `PATCH /api/teslas/:id/status`
(needs the id as input, which is exactly what's missing).

**Decision:** added `GET /api/teslas/me` (driver-only, ownership implicit since it's scoped to
`req.user.id`), returning the driver's Tesla or `null` if none registered yet (a valid state, not
a 404 error — mirrors how the frontend already treats "no Tesla" as a normal case, showing a
registration form). Same category of small, justified addition as `GET /api/zones`
(`docs/decisions.md` item 14) — flagged rather than silently added.

### 20. Backfilled three Section 13/6.2 requirements that had been skipped (2026-09-23)

**Context:** re-reading `MASTER_PLAN.md` in full against the actual Phase 3/6 code (prompted by a
schema review) found that three items explicitly marked "part of the plan, not optional extras"
(`MASTER_PLAN.md` Section 0) were never implemented, despite `docs/PROGRESS.md` marking Phases 3
and 6 "Complete":

- **13.1 Idempotency on `POST /api/rides`** — no `idempotency_key` column, no header handling.
- **13.2 One active ride request per passenger** — `createRideRequest` never checked for an
  existing `REQUESTED`/`MATCHED`/`DRIVER_ARRIVED`/`STARTED` request before creating a new one.
- **13.6 `seatsRequested` bounded to `1..3`** — the Zod schema only enforced "positive integer",
  no upper bound.
- **6.2 Grace-window cancellation** — no `late_cancellation`/`cancellation_fee_paisa` columns, no
  `GRACE_WINDOW_SECONDS` env var, `cancelRideRequest` never computed either flag.

**Decision:** implemented all four exactly per their MASTER_PLAN.md spec, not redesigned:
- `ride_requests` gained `idempotency_key` (nullable, unique), `late_cancellation` (boolean,
  default false), `cancellation_fee_paisa` (nullable int) — migration
  `20260923110514_add_idempotency_and_grace_window_cancellation`.
- `rideService.createRideRequest` now takes an optional `idempotencyKey`: a repeat with the same
  `(passengerId, idempotencyKey)` returns the original row (checked up front, and again on a
  unique-constraint race via Prisma error code `P2002`) instead of creating a duplicate or
  re-running the matching service. The one-active-ride check runs before zone validation, keyed on
  `ACTIVE_RIDE_STATUSES = [REQUESTED, MATCHED, DRIVER_ARRIVED, STARTED]`.
- `rideController.create` reads the key from the `Idempotency-Key` request header (`req.get`, case
  -insensitive per HTTP semantics) rather than a body field — matches the header-based option in
  Section 13.1.
- `seatsRequested` validator now `.min(1).max(3)`.
- `rideService.cancelRideRequest` computes `lateCancellation`/`cancellationFeePaisa` from
  `rideRequest.matchedAt` (the ride request's own `matchedAt`, set at pool-accept time — same
  instant as `pool.matchedAt`, so using the per-row column avoids an extra query) against
  `GRACE_WINDOW_SECONDS` (env, default 60), using the new `calculateCancellationFeePaisa` in
  `src/lib/fare.js` (`floor(farePaisa * 20 / 100)`, integer-only per the money rule). Written on the
  same `rideRequest.update` call as the `CANCELLED` transition — no extra query, per spec.

**Why flagged as a backfill, not silently patched:** `docs/PROGRESS.md`'s existing Phase 3/6
entries describe these phases as fully complete and don't mention any of the four items being
deferred — this was a genuine gap between the plan and the shipped code, not a documented
trade-off, so it's logged here explicitly rather than quietly folded into the existing phase
write-ups. Migration applied and verified against the same live MariaDB instance as prior phases;
tests updated/added in `tests/ride.test.js` and `tests/cancel.test.js`.

### 21. Phase 9 (Docker) completed without a live Docker Engine available (2026-09-23)

**Context:** this development environment has no `docker`/`docker compose` CLI installed (checked:
`docker --version` fails in both the POSIX shell and PowerShell). Phase 9's Dockerfiles,
`docker-compose.yml`, `.dockerignore` files, and `backend/docker-entrypoint.sh` were already
present (built in an earlier session against this same constraint) when this pass started.

**Decision:** rather than claim the full containerized stack was verified when it wasn't, this
pass did everything verifiable *without* a Docker Engine and documented the gap explicitly:
- Validated `docker-compose.yml`'s YAML syntax (`python -c "yaml.safe_load(...)"`).
- Read every Dockerfile and `docker-entrypoint.sh` line by line for logical correctness (build
  order, `prisma generate` after `COPY`, `NEXT_PUBLIC_API_URL` passed as a build arg since Next.js
  bakes `NEXT_PUBLIC_*` vars in at build time not runtime, LF line endings on the shell script per
  `.gitattributes` — CRLF would break `#!/bin/sh` inside the Linux container).
- Added a `GRACE_WINDOW_SECONDS` env var to the `backend` service (was missing — the Section 6.2
  backfill added this env var after the compose file was first written) and a `healthcheck` on
  `backend` (`GET /health` via a `node -e` one-liner, no extra package install needed), with
  `frontend` now depending on `backend: condition: service_healthy` instead of just "started".
- Ran what the containers actually run, directly on the host: `npx next build` + `npm start`
  (production frontend, confirmed `200` on `/` and `/login` after clearing a stale `.next` cache
  left over from an interrupted earlier build — not a code bug) and `node src/server.js` (backend,
  already verified live in the prior backfill pass).

**What was still unverified at the time:** an actual `docker compose up --build` run — container
networking, the `mysql:8` healthcheck gating, the entrypoint's `prisma migrate deploy`/`db seed`
sequence executing inside the container, and MySQL 8 specifically (vs. the MariaDB 10.4 this repo
has been live-verified against throughout, per item 13). Documented as the top item in README's
Known Limitations rather than silently assumed to work — this is a repo audit's job (flag the gap),
not a job to fabricate a verification that didn't happen. **Resolved the same day — see item 22.**

**Also written this pass:** `docs/scaling.md` (Section 10 bonus doc, reasoning-only — was
referenced from the README's Concurrency Handling section as "not yet written" since Phase 0).

---

### 22. Docker Compose verified via GitHub Actions CI, and a real Prisma-on-Alpine bug it caught (2026-09-23)

**Context:** item 21 flagged that `docker compose up` had never actually been run — no Docker
Engine was available locally. GitHub Actions' free tier ships Docker preinstalled, so
`.github/workflows/docker-verify.yml` was added: build the full stack, poll `GET /health` until it
returns 200 (or fail after 30 attempts), spot-check seed data via `GET /api/zones`, dump container
logs/status for diagnosis, always tear down.

**First real run found two bugs immediately — exactly why this was worth doing, not a formality:**

1. **Port 3306 conflict.** `ubuntu-latest` GitHub Actions runners ship with a system MySQL service
   already listening on port 3306, colliding with the `mysql` service's `"3306:3306"` port mapping.
   `docker compose up -d --build` failed outright. Fixed with a
   `sudo systemctl stop mysql.service || true` step before compose starts.

2. **Prisma's engine binaries need OpenSSL, which `node:20-alpine` doesn't ship.** With the port
   conflict fixed, `mysql` came up healthy, but the `backend` container's
   `docker-entrypoint.sh` (`prisma migrate deploy`) failed with
   `Error: Could not parse schema engine response: SyntaxError: Unexpected token 'E', "Error
   load"... is not valid JSON` — Prisma's schema-engine binary couldn't start (missing `libssl`),
   printed a plain-text error instead of the JSON the CLI expected, and the CLI's JSON parser choked
   on it. Prisma's own warning in the same log said exactly what to do:
   `"Please manually install OpenSSL and try installing Prisma again."` Fixed by adding
   `RUN apk add --no-cache openssl` to `backend/Dockerfile`, before `npm install`/`prisma generate`.

**Third run succeeded end-to-end:** `mysql` (real `mysql:8`, healthy) → `backend` (migrations
applied, seed run, `GET /health` → 200) → confirmed via `GET /api/zones` returning all 8 real seeded
zones with correct clusters, not a stub/empty response. Phase 9's last open item — "Integration
verification: full stack exercised against the Dockerized stack" — is now genuinely satisfied, via
CI rather than a local Docker Engine.

**Why this matters beyond just "it works now":** this is a textbook demonstration of why
Section 13/Phase 9's Docker requirement can't be satisfied by reading Dockerfiles carefully, no
matter how thoroughly — both bugs were invisible from static review (item 21's approach) and only
surfaced by actually running the stack. Neither would have been caught by the unit tests, the
integration test, or the manual `next build`/`node src/server.js` checks done in item 21, since none
of those exercise the Alpine base image's OpenSSL availability or the container networking/port
allocation at all.

**How to read this going forward:** GitHub Actions CI is now the standing verification method for
the Dockerized stack in this environment (no Docker Engine locally, and MySQL 8 specifically — not
just MariaDB — is exercised this way too, closing the Phase 2 carry-forward item). Future changes
to `docker-compose.yml`, either Dockerfile, or `docker-entrypoint.sh` are verified by pushing and
checking `.github/workflows/docker-verify.yml`'s run, the same way `npm test` verifies backend
logic changes.

---

### 23. Phase 10 security review found Section 13.4/13.5 were never actually built (2026-09-23)

**Context:** during Phase 10's mandated "API review, security review, concurrency review", a
line-by-line read of `src/app.js` against `MASTER_PLAN.md` Section 13.4/13.5 — both explicitly
marked `[x]` complete in Phase 1's checklist — found neither was real:

- **Section 13.5 (security baseline):** `app.js` had a bare `cors()` (no options — allows every
  origin, `*`, the exact thing the plan says not to do), and `helmet`/`express-rate-limit` weren't
  even in `package.json`. No security headers, no rate limiting on `/api/auth/*` at all.
- **Section 13.4 (request correlation):** only the `AppError`/`errorHandler` envelope half existed.
  There was no `requestId` anywhere in the codebase — no per-request UUID, no `X-Request-Id`
  response header, and no request logging of any kind (not even a bare `console.log` per request),
  despite the plan's explicit point: *"this is what 'logging' in the brief actually wants
  demonstrated: that you can trace one request's story through the logs."*

This is the same failure mode as item 20 (Section 13.1/13.2/13.6/6.2) and item 21/22's Docker gap —
a plan checkbox marked done that the code never actually did. Logged the same way: fixed, not
silently patched.

**Decision — implemented exactly per Section 13.4/13.5's spec:**
- `npm install helmet express-rate-limit` (both regular dependencies).
- `src/middleware/authRateLimit.js` — `express-rate-limit`, 20 requests per 15-minute window,
  mounted only on `/api/auth` (`app.use("/api/auth", authRateLimiter, authRoutes)`), matching
  existing error-envelope shape (`{ error: "..." }`) rather than introducing Section 13.4's example
  `{ error: { code, message } }` shape — changing the whole app's error envelope shape is a much
  larger, unrelated refactor than a security-baseline fix warrants, and no test or client code
  anywhere in this repo expects the nested-object shape.
- `app.js`: `app.use(helmet())`, and `cors({ origin: corsOrigins })` where `corsOrigins` is parsed
  from a new `CORS_ORIGIN` env var (comma-separated, defaults to `http://localhost:3000`) — added
  to both `.env.example` and `docker-compose.yml`'s backend env block.
- `src/middleware/requestContext.js` — `requestContext` assigns `req.id = crypto.randomUUID()` and
  sets it as the `X-Request-Id` response header; `requestLogger` logs
  `[requestId] METHOD path -> status (Nms)` on `res.on("finish")`, silenced under `NODE_ENV=test`
  to keep Jest output clean (the header/body still carry the id either way, so nothing about
  traceability is lost by the test-only silence). `errorHandler` now includes `requestId` in every
  error JSON body and prefixes its `console.error` line with it.

**Verified live** (real server, not mocked): `helmet` headers present (`X-Content-Type-Options`,
`X-Frame-Options`, `Strict-Transport-Security`, etc.) on `GET /health`; CORS echoes
`Access-Control-Allow-Origin` for `http://localhost:3000` and omits it entirely for a disallowed
`http://evil.example.com` origin; 21 rapid `POST /api/auth/login` attempts return `401` for the
first 20 and `429` for the 21st; `X-Request-Id` present on every response and matches the id in
both the error JSON body and the server's own log line for that request. `npm test` — 68/68
unaffected (no test asserts an exact error-response shape besides `/health`, which this doesn't
touch).

---

### 24. CI caught a MySQL-container flake: `mysqladmin ping` can pass during the "temporary server" phase (2026-09-23)

**Context:** the project owner opened and merged a PR from `pre-release` into `master` outside this
session (via the GitHub web UI). That merge commit's own CI run (`docker-verify.yml`) failed — a
genuinely new failure mode, different from items 21/22's port-3306/OpenSSL bugs, both of which were
already fixed by that point.

**Root cause, found in the container logs:** `mysql:8`'s official image runs a *temporary* server
first (to execute init scripts — creating the `dhaka_tesla_pool` database), shuts it down, then
starts the real, final server. The temporary server does accept connections, so Docker's
healthcheck (`mysqladmin ping`) can report the container "healthy" during that brief window —
`docker-compose.yml`'s `depends_on: mysql: condition: service_healthy` only guarantees the *first*
healthy signal, not that mysql stays reachable afterward. The `backend` container started in that
gap and its `prisma migrate deploy` failed with `Error: P1001: Can't reach database server at
'mysql:3306'`, because mysql was mid-restart into its final server at that exact instant.

**Decision:** rather than try to make the healthcheck itself perfectly distinguish "temporary" from
"final" mysqld (fragile, and MySQL's own image doesn't expose that distinction cleanly),
`backend/docker-entrypoint.sh` now retries `prisma migrate deploy` in a loop — up to 10 attempts,
3s apart — before giving up. This is the standard, well-documented fix for this exact MySQL-image
quirk: self-healing at the application/entrypoint layer, since Compose's dependency-health gating
alone can't fully guarantee it for this particular image's startup behavior. `prisma db seed` is
unaffected (it only runs after a successful migration, by which point mysql's final server is
definitely up).

**Why this is worth recording, not just fixing quietly:** this is now the *third* distinct real bug
CI has caught that static review or local testing never would have (port 3306, missing OpenSSL,
and now this) — a repeated, concrete demonstration of why Section 0/Phase 9's Docker requirement
specifically calls for actually running the stack, not just reading the configuration carefully.

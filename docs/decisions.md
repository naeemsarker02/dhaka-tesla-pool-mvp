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
a real MySQL instance is available. **This has not been confirmed by actually running the
migration against a live database** — that verification is left for the project owner (or a later
session with DB access) before treating Phase 2 as fully done per `CLAUDE.md`'s "Code Quality"
checklist item 3 ("verify database migrations apply cleanly from scratch").

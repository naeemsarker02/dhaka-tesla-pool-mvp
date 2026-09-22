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

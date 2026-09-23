# Entity-Relationship Diagram

> Source of truth: `MASTER_PLAN.md` Section 3. This file exists so the diagram/notes render
> directly in tooling/README embeds. If this file and `MASTER_PLAN.md` ever disagree, that's a bug
> in this file — the master plan wins (see `CLAUDE.md`).

```mermaid
erDiagram
    USERS ||--o{ TESLAS : owns
    USERS ||--o{ RIDE_REQUESTS : requests
    TESLAS ||--o{ POOLS : serves
    POOLS ||--o{ POOL_MEMBERSHIPS : contains
    RIDE_REQUESTS ||--o| POOL_MEMBERSHIPS : "belongs to"
    RIDE_REQUESTS ||--o{ RIDE_STATUS_HISTORY : logs
    ZONES ||--o{ RIDE_REQUESTS : "pickup/destination"

    USERS {
        uuid id PK
        string name
        string email UK
        string password_hash
        enum role "passenger|driver"
        string phone
        datetime created_at
    }
    TESLAS {
        uuid id PK
        uuid driver_id FK, UK "one Tesla per driver — MVP assumption"
        string name
        int capacity
        enum status "online|offline"
        datetime created_at
    }
    ZONES {
        uuid id PK
        string name UK
        string cluster
    }
    RIDE_REQUESTS {
        uuid id PK
        uuid passenger_id FK
        uuid pickup_zone_id FK
        uuid destination_zone_id FK
        int seats_requested
        enum status "REQUESTED|MATCHED|DRIVER_ARRIVED|STARTED|COMPLETED|CANCELLED"
        int estimated_fare_paisa "set at creation, no pool discount"
        int fare_paisa "nullable; finalized when the pool is MATCHED"
        string idempotency_key "nullable, unique; POST /api/rides replay protection"
        boolean late_cancellation "default false; see fare-model/decisions grace-window notes"
        int cancellation_fee_paisa "nullable; computed not charged"
        datetime requested_at
        datetime matched_at
        datetime arrived_at
        datetime started_at
        datetime completed_at
        datetime cancelled_at
    }
    POOLS {
        uuid id PK
        uuid tesla_id FK
        enum status "OPEN|MATCHED|DRIVER_ARRIVED|STARTED|COMPLETED|CANCELLED"
        int seats_occupied "aggregate counter — see below"
        datetime created_at
        datetime matched_at
        datetime completed_at
    }
    POOL_MEMBERSHIPS {
        uuid id PK
        uuid pool_id FK
        uuid ride_request_id FK UK "one ride request cannot join two pools"
        int seats "per-passenger allocation — see below"
        datetime created_at
    }
    RIDE_STATUS_HISTORY {
        uuid id PK
        uuid ride_request_id FK
        string from_status
        string to_status
        datetime changed_at
        uuid changed_by FK
    }
```

## Key constraints (DB-level, not just app-level)

- `ride_requests` has **no `pool_id` column.** `pool_memberships` is the sole join table between
  `pools` and `ride_requests`. To find a ride request's pool: `pool_memberships.where(ride_request_id = ...)`.
- `pool_memberships.ride_request_id` is **UNIQUE** — a ride request can never belong to two pools
  at once. This is the *only* place that invariant is enforced.
- `teslas.driver_id` is **UNIQUE** — one Tesla per driver (documented MVP assumption, see
  [decisions.md](./decisions.md) item 3). Driver-facing endpoints must check both role AND
  ownership.
- `teslas.capacity` = fixed int (e.g. 3), `CHECK capacity > 0` (requires MySQL 8.0.16+; confirm the
  target version enforces `CHECK`, older versions silently ignore it).
- `pools.seats_occupied` must never exceed `teslas.capacity` — enforced primarily via transaction +
  row lock (see "Concurrency" below); a `CHECK` constraint is a second line of defense only.
- FK indexes on every FK column (`driver_id`, `pickup_zone_id`, `pool_id`, `ride_request_id`, etc.)
- `zones.cluster` — predefined grouping used by the matching rule (`docs/fare-model.md` covers fare;
  the matching rule itself is `MASTER_PLAN.md` Section 4).

## Domain Model: Matching vs. Driver Acceptance

These are **two distinct events** — never conflate them:

```
REQUESTED
   |
compatible OPEN pool found (or a new OPEN pool created)
   -> a pool_membership row is inserted; ride_request.status stays REQUESTED
   |
pool becomes visible to the owning driver (GET /api/driver/requests)
   |
driver explicitly accepts the pool  (POST /api/driver/pools/:poolId/accept)
   |
pool.status: OPEN -> MATCHED
   -> cascades: every current member's ride_request.status REQUESTED -> MATCHED
   -> cascades: fare_paisa finalized for every member
   -> no further ride_requests may join this pool after this point
```

Grouping requests into a pool is a system-side optimization step (finding who *could* share a
ride); acceptance is the driver's business decision to actually take that trip. Treating pool
assignment as "matched" would let a passenger see `MATCHED` before any driver has committed —
wrong per the brief's own lifecycle table.

## Domain Model: Pool State vs. Ride Request State

- **`RideRequest.status`** — one passenger's individual journey, what *they* see.
- **`Pool.status`** — the Tesla's shared trip container, what the *driver* sees and drives through.
- Pool lifecycle: `OPEN -> MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED` (+`CANCELLED` from
  `OPEN`/`MATCHED`).
  - `OPEN`: accepting compatible ride requests, not yet accepted by a driver.
  - `MATCHED`: a driver has accepted; membership is locked, no further joins.
  - `DRIVER_ARRIVED` / `STARTED` / `COMPLETED`: trip stages, driver-driven, cascade to all member
    ride_requests.
  - `CANCELLED`: pool cancelled (e.g. it becomes empty after the last member cancels).
- **Deliberately no separate `FULL` status.** "Full" is a *computed* condition
  (`pool.seats_occupied >= tesla.capacity`), checked by the matching service when deciding whether
  an `OPEN` pool can accept one more request. No additional transition behavior is attached to it,
  so persisting it as its own state would be duplicated state — flagged against in the brief.
- When a pool transitions `DRIVER_ARRIVED`/`STARTED`/`COMPLETED`, every member ride_request with an
  active (non-cancelled) status moves in lockstep, and one `ride_status_history` row is written per
  affected ride_request.

## `seats_occupied` vs. `pool_memberships.seats`

- `pool_memberships.seats` = seat count allocated to **one specific passenger's** membership row.
- `pools.seats_occupied` = a **maintained aggregate counter**, equal to the sum of all its active
  memberships' `seats`. It exists so a capacity check is a single indexed row read
  (`SELECT seats_occupied FROM pools WHERE id = ? FOR UPDATE`) instead of a `SUM()` aggregate query
  on every seat-claim attempt.
- This is intentional, acceptable duplication for the MVP — but it only stays correct if every
  write that touches membership seats also updates the counter **in the same database
  transaction**. Exactly one code path is allowed to mutate `seats_occupied`: the pool-membership
  service, always inside the transaction described in `MASTER_PLAN.md` Section 6.

## One-active-pool-per-Tesla invariant (resolved gap — see decisions.md item 7)

`MASTER_PLAN.md` specifies `pools.tesla_id` as a required FK but never states how a new `OPEN`
pool picks its Tesla, nor whether a Tesla can have more than one non-terminal pool at a time. This
was a real gap (a Tesla physically drives one trip at a time) — resolved as follows, confirmed
with the project owner:

- **Invariant:** a Tesla may have at most **one** non-terminal pool
  (`OPEN`/`MATCHED`/`DRIVER_ARRIVED`/`STARTED`) at a time.
- **New-pool Tesla selection:** when a ride request can't join an existing compatible `OPEN` pool,
  the matching service creates a new `OPEN` pool only on an **online** Tesla that currently has
  zero non-terminal pools. If no such Tesla exists, the ride request is created but stays
  unpooled — `status = REQUESTED`, no `pool_membership` row (already valid per the ERD's
  zero-or-one relationship). It can be picked up by a later matching pass (e.g. triggered by the
  next `POST /api/rides`, or a driver coming online).
- This invariant is enforced at the application/service layer inside the same transaction that
  creates or accepts a pool (find-or-create is not yet a DB constraint at MVP scope — see
  `docs/decisions.md` item 7 for the full rationale and what a stricter DB-level enforcement would
  look like).

## Concurrency

See `MASTER_PLAN.md` Section 6 for the full Prisma-specific `SELECT ... FOR UPDATE` pattern and
`docs/PROGRESS.md` for implementation status. Summary: seat claims and cancellations both acquire
a row lock on the `pools` row inside a `prisma.$transaction` before reading/writing
`seats_occupied`.

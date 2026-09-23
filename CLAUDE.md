# Dhaka Tesla Pool — Claude Code Instructions

## Source of Truth

`MASTER_PLAN.md` is the primary source of truth for this project. `DOCUMENTATION_PLAN.md` governs
README/video/AI-usage documentation structure. Both live at the repo root.

Before implementing any feature:
1. Read `MASTER_PLAN.md` — check the relevant phase (Section 8) and the domain-model sections
   (3.1, 3.2, 3.3) before touching pooling/matching/fare code specifically.
2. Understand the relevant phase and its acceptance criteria.
3. Check existing implementation before changing anything — grep for the entity/endpoint first.
4. Follow the architecture, database design, API contracts, lifecycle rules, testing
   requirements, and Git workflow defined there.

Do not redesign the project or introduce unnecessary technologies without explicit approval.

If `MASTER_PLAN.md` and the actual code ever disagree, treat that as a conflict to surface
(see "Important Behavior" below) — do not silently pick one side.

## Core Stack

- Backend: Node.js + Express
- Frontend: Next.js App Router
- Database: MySQL / InnoDB
- ORM: Prisma
- Authentication: JWT + bcrypt
- Validation: Zod
- Backend tests: Jest + Supertest
- Docker: Docker Compose

## MVP Restrictions

Do NOT introduce these into the MVP:

- Microservices
- Kafka
- Redis
- Kubernetes
- Message queues
- Real routing/geospatial APIs
- Unnecessary infrastructure

Scaling technologies may only be discussed in the bonus scaling documentation (`docs/scaling.md`).

## Domain Rules

Story cast must remain:

- Jashim — driver
- Bullet — Tesla
- Nusrat — passenger
- Rafiq — passenger
- Shirin — passenger

Bullet capacity = 3. Never generic `user1`/`driver1` in seed data, tests, or examples.

### Two separate state machines — never conflate them

**`RideRequest.status`** (one passenger's journey):
```
REQUESTED → MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED
                  ↘ CANCELLED (only from REQUESTED or MATCHED)
```

**`Pool.status`** (the Tesla's shared trip container):
```
OPEN → MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED
             ↘ CANCELLED (only from OPEN or MATCHED)
```

- A ride request being grouped into a pool (`pool_membership` created) is **not** the same event
  as being matched. `ride_request.status` stays `REQUESTED` while a pool is `OPEN`. It only becomes
  `MATCHED` when a driver explicitly accepts the pool (`OPEN → MATCHED`), which cascades to every
  current member.
- `DRIVER_ARRIVED` / `STARTED` / `COMPLETED` are pool-level events (the whole Tesla moves through
  them together) that cascade down to every active member `ride_request`, writing one
  `ride_status_history` row per affected passenger.
- There is **no separate `FULL` pool status** — "full" is a computed condition
  (`seats_occupied >= tesla.capacity`), not a persisted state. Do not add one.

### Relationships

- `pool_memberships` is the **only** relationship between `pools` and `ride_requests`.
  `ride_requests` must **never** have a `pool_id` column — look up a ride request's pool through
  `pool_memberships`. `pool_memberships.ride_request_id` is UNIQUE.
- `teslas.driver_id` is UNIQUE — one Tesla per driver (MVP assumption). Every driver-facing
  endpoint must check both role AND ownership of the specific Tesla/pool being acted on.

### Fare timing

- `estimated_fare_paisa` — set once, at ride-request creation, **without** pool discount.
- `fare_paisa` — starts `NULL`. Finalized **once**, at the moment the pool transitions
  `OPEN → MATCHED`, based on the final membership count at that instant. Do not recalculate it on
  every membership join, and do not retroactively recalculate it after `MATCHED` (including on a
  later cancellation by another member — that's a documented known limitation, not a bug to fix
  silently).

### Cancellation

Allowed only from `REQUESTED` or `MATCHED`. Atomically, in one transaction: set `CANCELLED`,
release the `pool_membership` if one exists, decrement `pools.seats_occupied`, and cancel the pool
too if it's left with zero active members. Rejected (409) from `DRIVER_ARRIVED`, `STARTED`,
`COMPLETED`.

### Money

Always integer paisa. Never a float literal (e.g. never `baseFare * 0.15`). Use
`Math.floor(baseFarePaisa * 15 / 100)` style integer arithmetic for discounts.

## Engineering Rules

- Business logic belongs in the service/use-case layer. Controllers/routes stay thin.
- Validate all external input with Zod.
- Enforce authentication and resource ownership on every non-public route (passenger owns their
  `ride_request`; driver owns their `Tesla`/`pool`).
- Use database transactions for every capacity-sensitive operation (seat claim, cancellation, pool
  status cascade).
- MySQL/InnoDB row locking (`SELECT ... FOR UPDATE`) is required wherever the master plan specifies
  it (seat-claim, cancellation). Prisma's query builder does not expose `FOR UPDATE` — use
  `tx.$queryRaw` for the locking read and `tx.$executeRaw` (or `tx.<model>.update`) for the write,
  both inside the same `prisma.$transaction(async (tx) => { ... })` callback. A plain Prisma query
  outside a transaction does not lock anything.
- JWT payload stays minimal: `{ sub, role }` only — never put email/name/PII in the token. Token is
  carried as `Authorization: Bearer <token>`, held client-side (React context + `localStorage`).
  Auth-aware Next.js pages are client components (`"use client"`) — do not implement or claim
  SSR-authenticated pages; that requires an `httpOnly` cookie setup that's explicitly out of scope
  for this MVP.
- Never use floating-point money calculations.
- Never commit secrets — `.env.example` only, real `.env` stays gitignored.
- Never bypass tests just to make a feature pass.
- Prefer simple, explainable solutions over clever abstractions.

## Code Quality

Before considering a task complete:

1. Run relevant tests.
2. Run lint/type checks if configured.
3. Verify database migrations apply cleanly from scratch (`prisma migrate reset` or equivalent).
4. Verify the affected API manually when appropriate.
5. Update documentation if behavior or architecture changed (`docs/architecture.md`, `docs/erd.md`,
   `docs/decisions.md` as relevant — see below).
6. Update `docs/PROGRESS.md`.

## Git Workflow

Long-lived branches:

- `master`
- `pre-release`
- `release/v1.0.0`

Feature branches:

- `feature/<name>`

Merge feature branches into `master` with `--no-ff` so the feature history stays visible in `git log`.

Commit format:

`type(scope): short description`

Allowed types:

- feat
- fix
- refactor
- test
- docs
- chore
- build

Do not use meaningless commit messages such as:

- update
- changes
- final
- fixed stuff
- work

Never push feature work directly to `master`.

## Work Tracking

Maintain `docs/PROGRESS.md`.

For every phase/task record:

- Status
- What was implemented
- Files changed
- Tests added
- Tests passed/failed
- Documentation updated
- Known issues
- Next task

Do not mark a task complete unless it is actually implemented and verified.

## Documentation to Keep in Sync

- `docs/architecture.md` — update if the layer flow or component boundaries change.
- `docs/erd.md` — update if any table/column/relationship changes. If a change would reintroduce
  `ride_requests.pool_id` or a persisted `FULL` pool status, stop and flag it (see below) instead
  of making the change.
- `docs/decisions.md` — append a new entry any time you make an unspecified-requirement call,
  labeled as an MVP assumption. Seed entries already exist from `MASTER_PLAN.md` Section 12.
- `docs/scaling.md` — bonus section, reasoning only, not implemented.
- `docs/PROGRESS.md` — per Work Tracking above.

## Important Behavior

If the master plan is ambiguous or two requirements conflict:

1. Stop before making a risky architectural decision.
2. Identify the conflict.
3. Explain the smallest reasonable resolution.
4. Ask for confirmation if the decision materially changes the architecture — this explicitly
   includes anything touching the pool/ride-request relationship, the two state machines, or fare
   timing, since those were deliberately corrected once already (see `MASTER_PLAN.md` Rev 2 note).

Do not silently invent major requirements.

## AI Usage Documentation

Keep track of meaningful AI-assisted development.

When an AI suggestion materially influences the implementation, record:

- What was suggested
- Whether it was accepted/rejected
- Why

This will later be summarized in the README's AI Usage section per `DOCUMENTATION_PLAN.md` Section 2.

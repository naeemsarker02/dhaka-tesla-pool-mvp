# Dhaka Tesla Pool

## Summary

A ride-pooling MVP built for the RoBenDevs Software Engineer assessment. Passengers request rides
between predefined Dhaka zones; compatible requests are pooled into a single Tesla trip so riders
share a car (and split part of the cost) while still tracking their own fare and status
individually. **Current state: Phase 0 (architecture & design documentation) complete. No
application code exists yet.**

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

> Nothing is implemented yet — Phase 0 is documentation only. This checklist will be filled in
> phase by phase per `MASTER_PLAN.md` Section 8, and kept accurate in `docs/PROGRESS.md`.

**Passenger**
- [ ] Signup / login
- [ ] Request a ride (pickup, destination, seats) with immediate estimated fare
- [ ] Track ride status
- [ ] Ride history
- [ ] Cancel a ride (from `REQUESTED`/`MATCHED` only)

**Driver**
- [ ] Signup / login, register Tesla
- [ ] Online / offline toggle
- [ ] View pending pools/requests
- [ ] Accept a pool
- [ ] Advance pool through `DRIVER_ARRIVED` / `STARTED` / `COMPLETED`
- [ ] Trip history

**Pooling**
- [ ] Deterministic zone-cluster matching (no map API)
- [ ] Capacity-safe concurrent seat claiming (`SELECT ... FOR UPDATE`)
- [ ] Fare finalization on pool `MATCHED`

## Screenshots / GIFs

Not yet available — frontend is not built (Phases 7–8).

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
  src/
    routes/
    controllers/
    services/
    prisma/
frontend/
  app/
```

Not yet scaffolded — lands in Phase 1 (`feature/project-scaffold`).

## Prerequisites

To be finalized in Phase 1/9 (Node version, Docker, Docker Compose versions pinned once the
scaffold and Docker setup exist).

## Environment Variables

Not yet defined — `.env.example` lands in Phase 1 and is finalized in Phase 9
(`feature/docker-deploy`). No real secrets will ever be committed.

## Local Setup (without Docker)

Not yet available — depends on Phase 1 scaffold.

## Docker Setup

Not yet available — lands in Phase 9 (`feature/docker-deploy`). Target: `docker compose up` brings
up backend, frontend, and MySQL with migrations and seed data applied automatically.

## Running Tests

Not yet available. Required coverage is tracked in `MASTER_PLAN.md` Section 9 and will be linked
here once tests exist.

## Demo Credentials

Not yet available — seed script (Jashim as driver, Nusrat/Rafiq/Shirin as passengers, Bullet as
the Tesla) lands in Phase 2.

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
concurrency (see `docs/scaling.md`, bonus, not yet written). Full pattern: `MASTER_PLAN.md`
Section 6; cancellation/seat-release flow: Section 6.1.

## Deployment

Not yet deployed — Phase 10/11.

## API Overview

Full contract in `MASTER_PLAN.md` Section 7. Not yet implemented.

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

## Known Limitations

- No real payment gateway.
- No real geo/routing — zone-to-zone distance is a hardcoded lookup table.
- `fare_paisa` is not retroactively recalculated for remaining pool members if another member
  cancels after `MATCHED`.
- JWT in `localStorage` (XSS-readable) instead of an `httpOnly` cookie — accepted MVP trade-off.
- Single-region deploy, no read replicas, no distributed lock — see `docs/scaling.md` (bonus) for
  the reasoning-only scale-out path.

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

**One rejected/changed suggestion:** _To be filled in as implementation proceeds — no code has
been written yet, so no implementation-level suggestions have been accepted or rejected._

## Demo Video

Not yet recorded — Phase 11.

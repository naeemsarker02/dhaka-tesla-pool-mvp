# Dhaka Tesla Pool — Documentation & Presentation Plan

> This maps 1:1 to what the RoBenDevs brief explicitly asks you to produce and explain
> (Sections 8, 9, 12, 13). Fill each section in as you build — don't leave it all to the end.

---

## 1. README.md — required structure (Section 12)

Use this exact section order so nothing is missed:

```markdown
# Dhaka Tesla Pool

## Summary
2-3 sentences: what it is, who it's for, current state.

## Problem Statement
Rephrase Section 2 of the brief in your own words — Nusrat/Rafiq/Jashim scenario,
why pooling + fair individual fares + lifecycle visibility matters.

## Features Implemented
Checklist format, grouped by Passenger / Driver / Pool — mirrors the brief's table.

## Screenshots / GIFs
Embed 4-6: signup, request-ride, status tracking, driver accept, pool view, completed ride.

## Architecture
Embed docs/architecture.md diagram + 2-3 sentences on layer responsibilities.

## Database Design (ERD)
Embed docs/erd.md diagram + a short paragraph per table explaining its role.

## Tech Stack & Justification
Copy the table from MASTER_PLAN.md Section 1 — choice / alternative / why / when-to-switch.

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

## Prerequisites
Node version, Docker, Docker Compose.

## Environment Variables
Table of every var in .env.example with a one-line description. Never real secrets.

## Local Setup (without Docker)
Step-by-step: install, migrate, seed, run backend, run frontend.

## Docker Setup
`docker compose up` — what it starts, how migrations/seed run automatically.

## Running Tests
Command + what's covered (link to the test checklist in MASTER_PLAN.md Section 9).

## Demo Credentials
| Role | Email | Password |
(Jashim as driver, Nusrat/Rafiq/Shirin as passengers)

## Fare Model
Copy Section 5 from MASTER_PLAN.md including the worked Nusrat/Rafiq numbers.

## Matching Rule
Copy Section 4 from MASTER_PLAN.md.

## Concurrency Handling
Copy Section 6 from MASTER_PLAN.md — the FOR UPDATE explanation, and the
"at scale I'd..." line. This is a guaranteed interview question — know it cold.

## Deployment
Live URL (or: "free-tier not available for X reason, use Docker instructions above").

## API Overview
Table from MASTER_PLAN.md Section 7.

## Key Decisions & Trade-offs
3-5 bullets: e.g. "Chose row-lock over distributed lock for MVP simplicity, would
revisit at >X req/sec", "Zone clusters hardcoded instead of real geo — trade-off is
accuracy vs. build time within scope."

## Known Limitations
Be honest: no real payment gateway, no real geo/routing, single-region deploy, etc.

## Next Improvements
3-5 bullets tying into the bonus scaling section.

## AI Usage
(see Section 2 below)

## Demo Video
Link here, prominently.
```

---

## 2. AI Usage Section — exact template to fill

```markdown
## AI Usage

**Tools used:** [e.g. Claude Code, ChatGPT, GitHub Copilot]

**What for:** [e.g. scaffolding Express route boilerplate, drafting Prisma schema
from my ERD, writing the concurrency test, explaining MySQL row-locking options]

**One accepted suggestion:** [describe a specific suggestion the AI gave that you
kept as-is or nearly as-is, and why it was correct/useful]

**One rejected/changed suggestion:** [describe a specific suggestion you changed or
rejected, and WHY — this is the most scrutinized line in this section; have a real,
technical reason, e.g. "AI suggested optimistic locking with a version column; I
switched to pessimistic FOR UPDATE because the seat-claim window is short and
correctness matters more than throughput at this scale."]
```

Keep this factual and specific — vague answers here read as not having reviewed the AI's output.

---

## 3. Architecture/ERD diagrams — where they come from

Both diagrams already exist as Mermaid in `MASTER_PLAN.md` (Sections 2 and 3).
Render them (GitHub renders Mermaid natively in README, or export as PNG via
mermaid.live if the platform you deploy docs to doesn't render it) and embed as
images in the README, not just as unrendered code blocks, so evaluators don't
have to paste them elsewhere to view them.

---

## 4. Six-Minute Video Script (Section 13 — hard 6-minute cap)

| Time | Content | Notes |
|---|---|---|
| 0:00–1:00 | **Problem in your own words.** Nusrat needs Banani→Mohakhali, Rafiq needs Banani→Gulshan1 at nearly the same time, Jashim's Bullet has 3 seats. Explain why pooling + individual fares + a driver-visible manifest + full history is the actual product problem — don't recite the PRD verbatim. | Practice this cold, no notes on screen |
| 1:00–3:00 | **Engineering walkthrough.** Show architecture diagram, explain the 3-layer flow. Show ERD, explain the key tables (ride_requests, pools, pool_memberships) and why pool_membership is a separate join table. State ONE key decision (e.g. row-lock for concurrency) and ONE trade-off (e.g. hardcoded zone clusters vs real geo) explicitly by name. | Screen-share the diagrams while talking, don't just describe them |
| 3:00–6:00 | **Product tour.** Passenger flow (signup → request → track status). Driver flow (accept → arrived → start → complete). Show the shared-Tesla pool view with Nusrat+Rafiq both visible with their own fares. Show ONE edge case live — e.g. attempt to claim the last seat twice, or attempt an invalid state transition, and show it get rejected. End with deployment link if live. | This is where "shipped, not just coded" gets judged — show it running, not slides |

Rehearse with a timer — going over 6:00 is a self-inflicted penalty.

---

## 5. Decisions/Assumptions Log (Section 17 — keep running, don't backfill)

Start `docs/decisions.md` on day one and append one entry every time you make an
unspecified-requirement call. Format:

```markdown
### [Date] — Matching rule granularity
**Assumption:** Zone clusters (predefined groups) rather than real distance/geo for
pool-compatibility.
**Why:** Brief explicitly says not to fight map APIs; a cluster table is testable,
explainable, and swappable for PostGIS later without changing the API contract.
```

This log doubles as interview prep — "why did you assume that" answers already written.

---

## 6. Git History Sanity Check (Section 10/11 — self-audit before submitting)

Before cutting `release/v1.0.0`, verify:
- [ ] No single giant "initial commit" with the whole app
- [ ] Every commit follows `type(scope): description`
- [ ] `master` shows a clean, real feature-by-feature merge history
- [ ] `pre-release` shows fixes/docs commits distinct from feature work
- [ ] No direct pushes to `master` bypassing a feature branch

---

## 7. Submission Checklist (Section 14 — final pass)

- [ ] Public repo accessible to evaluator, working MVP
- [ ] Docker Compose + `.env.example`, zero secrets committed
- [ ] Migrations + seed data using story cast
- [ ] `docs/architecture.md` and `docs/erd.md` present and rendered in README
- [ ] `master` / `pre-release` / `release/v1.0.0` branches present with real history
- [ ] Tests from MASTER_PLAN.md Section 9 all passing
- [ ] README complete per Section 1 of this document
- [ ] Video ≤ 6:00, linked prominently in README
- [ ] AI Usage section filled with specific, real examples
- [ ] Bonus scaling doc attempted (optional but scored as bonus)

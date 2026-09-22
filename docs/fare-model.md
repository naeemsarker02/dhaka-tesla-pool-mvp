# Fare Model

> Source of truth: `MASTER_PLAN.md` Section 5. Integer arithmetic only — must be hand-calculable,
> no float literals anywhere in the codebase (never `baseFare * 0.15`).

## Formula

```
distanceChargePaisa = distanceKm(pickup_zone, destination_zone) * ratePerKmPaisa
poolDiscountPaisa    = floor(baseFarePaisa * 15 / 100)        // NOT baseFare * 0.15
```

- `baseFarePaisa` = 3000 (৳30)
- `ratePerKmPaisa` = 1500 (৳15/km)
- Zone-to-zone distance: hardcoded lookup table (no map API) — a seeded `zone_distance` table or a
  JS constant map, values in whole km (integers).
- All monetary math uses integer paisa and integer/floor division. `Math.floor(baseFarePaisa * 15 / 100)`
  is exact at MVP fare sizes; `BigInt` is not required here.

## Estimated Fare vs. Final Pooled Fare

- **`estimated_fare_paisa`** — computed and stored **at ride-request creation**
  (`POST /api/rides`), **without** `poolDiscountPaisa` applied. This is what the passenger sees
  immediately: "your estimated fare is ৳XX.XX, may be lower if pooled."
- **`fare_paisa`** — starts `NULL`. Computed and written **once**, at the moment the pool
  transitions `OPEN -> MATCHED` (driver accepts), using the final membership count at that instant:
  - **2 or more** active members at acceptance time → each member's `fare_paisa` =
    `baseFarePaisa + distanceChargePaisa - poolDiscountPaisa`, using *their own* distance.
  - Exactly **1** member at acceptance time (no one ever pooled with them) → `fare_paisa` =
    `estimated_fare_paisa` (no discount).
  - Fare is finalized once, at `MATCHED`, never recalculated on later membership joins (there are
    none after `MATCHED`) or on a later cancellation by another member. See
    [decisions.md](./decisions.md) item 2.

## Worked Example (must match test assertions exactly)

Nusrat (Banani→Mohakhali, 3km) & Rafiq (Banani→Gulshan1, 4km), pooled together, pool reaches
`MATCHED` with both as members:

```
poolDiscountPaisa = floor(3000 * 15 / 100) = floor(450) = 450

Nusrat: 3000 + (3 * 1500) - 450 = 3000 + 4500 - 450 = 7050 paisa = ৳70.50
Rafiq:  3000 + (4 * 1500) - 450 = 3000 + 6000 - 450 = 8550 paisa = ৳85.50
```

## Solo (unpooled) example

Shirin requests Dhanmondi → Mirpur (say 6km) and her pool reaches `MATCHED` with only her as a
member (no one pooled with her):

```
estimated_fare_paisa = 3000 + (6 * 1500) = 3000 + 9000 = 12000 paisa = ৳120.00
fare_paisa = estimated_fare_paisa = 12000 paisa = ৳120.00   // no discount applied
```

## Status

Documented only — not yet implemented. Implementation lands in Phase 3 (`estimated_fare_paisa`)
and Phase 4 (`fare_paisa` finalization on `MATCHED`), per `MASTER_PLAN.md` Section 8. Tests must
assert on exact integer paisa values, never floating-point comparisons.

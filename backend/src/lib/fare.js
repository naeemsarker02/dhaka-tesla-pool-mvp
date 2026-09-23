// Integer-paisa fare arithmetic only — never a float literal. Per MASTER_PLAN.md Section 5.
const BASE_FARE_PAISA = 3000; // ৳30
const RATE_PER_KM_PAISA = 1500; // ৳15/km
const POOL_DISCOUNT_PERCENT = 15;
// Section 6.2 grace-window cancellation — computed and recorded only, never charged (no payment
// gateway in this MVP).
const CANCELLATION_FEE_PERCENT = 20;

function calculateFareBeforeDiscount(distanceKm) {
  return BASE_FARE_PAISA + distanceKm * RATE_PER_KM_PAISA;
}

function calculatePoolDiscountPaisa() {
  return Math.floor((BASE_FARE_PAISA * POOL_DISCOUNT_PERCENT) / 100);
}

// estimated_fare_paisa — set at ride-request creation, no pool discount (Section 5.1).
function calculateEstimatedFarePaisa(distanceKm) {
  return calculateFareBeforeDiscount(distanceKm);
}

// fare_paisa when a pool reaches MATCHED with 2+ members — discount applied to this member's own
// distance. A solo (1-member) pool uses estimated_fare_paisa as-is instead (Section 5.1) — that
// case has no dedicated function here since it's just a passthrough, computed in the caller.
function calculatePooledFarePaisa(distanceKm) {
  return calculateFareBeforeDiscount(distanceKm) - calculatePoolDiscountPaisa();
}

// cancellation_fee_paisa (Section 6.2) — computed on a late cancellation from MATCHED, against the
// already-finalized fare_paisa. Recorded for demonstration only; nothing is actually deducted.
function calculateCancellationFeePaisa(farePaisa) {
  return Math.floor((farePaisa * CANCELLATION_FEE_PERCENT) / 100);
}

module.exports = {
  BASE_FARE_PAISA,
  RATE_PER_KM_PAISA,
  POOL_DISCOUNT_PERCENT,
  CANCELLATION_FEE_PERCENT,
  calculateEstimatedFarePaisa,
  calculatePooledFarePaisa,
  calculatePoolDiscountPaisa,
  calculateCancellationFeePaisa,
};

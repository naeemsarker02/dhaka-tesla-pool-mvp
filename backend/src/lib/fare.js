// Integer-paisa fare arithmetic only — never a float literal. Per MASTER_PLAN.md Section 5.
const BASE_FARE_PAISA = 3000; // ৳30
const RATE_PER_KM_PAISA = 1500; // ৳15/km
const POOL_DISCOUNT_PERCENT = 15;

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

module.exports = {
  BASE_FARE_PAISA,
  RATE_PER_KM_PAISA,
  POOL_DISCOUNT_PERCENT,
  calculateEstimatedFarePaisa,
  calculatePooledFarePaisa,
  calculatePoolDiscountPaisa,
};

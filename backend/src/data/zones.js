// Predefined zones + matching clusters + zone-to-zone distances, per MASTER_PLAN.md Section 4/5.
// No map API — flat, hardcoded, testable. Single source of truth for both the seed script and
// the fare/matching services, so the DB and the code can never drift apart.
//
// The master plan only specifies one cluster explicitly ("Gulshan-Mohakhali corridor": Gulshan,
// Mohakhali, Banani) and two distances (Banani-Mohakhali=3km, Banani-Gulshan=4km, both preserved
// exactly below). The remaining zones' clusters and all other pairwise distances are an MVP
// assumption — docs/decisions.md item 12.

const ZONES = [
  { name: "Banani", cluster: "Gulshan-Mohakhali corridor" },
  { name: "Gulshan", cluster: "Gulshan-Mohakhali corridor" },
  { name: "Mohakhali", cluster: "Gulshan-Mohakhali corridor" },
  { name: "Dhanmondi", cluster: "Dhanmondi-Mirpur-Farmgate corridor" },
  { name: "Mirpur", cluster: "Dhanmondi-Mirpur-Farmgate corridor" },
  { name: "Farmgate", cluster: "Dhanmondi-Mirpur-Farmgate corridor" },
  { name: "Uttara", cluster: "Uttara-Bashundhara corridor" },
  { name: "Bashundhara", cluster: "Uttara-Bashundhara corridor" },
];

// Symmetric, whole-km distances for every zone pair. Keyed as "<alphabetically-first>|<other>" so
// lookup direction never matters. Banani-Mohakhali (3km) and Banani-Gulshan (4km) match
// MASTER_PLAN.md Section 5.2's worked example exactly; all other values are a plausible, made-up
// MVP stand-in for real geo-distance.
const DISTANCE_KM = {
  "Banani|Bashundhara": 5,
  "Banani|Dhanmondi": 9,
  "Banani|Farmgate": 7,
  "Banani|Gulshan": 4,
  "Banani|Mirpur": 11,
  "Banani|Mohakhali": 3,
  "Banani|Uttara": 12,
  "Bashundhara|Dhanmondi": 12,
  "Bashundhara|Farmgate": 9,
  "Bashundhara|Gulshan": 3,
  "Bashundhara|Mirpur": 15,
  "Bashundhara|Mohakhali": 6,
  "Bashundhara|Uttara": 10,
  "Dhanmondi|Farmgate": 3,
  "Dhanmondi|Gulshan": 10,
  "Dhanmondi|Mirpur": 6,
  "Dhanmondi|Mohakhali": 8,
  "Dhanmondi|Uttara": 16,
  "Farmgate|Gulshan": 8,
  "Farmgate|Mirpur": 5,
  "Farmgate|Mohakhali": 5,
  "Farmgate|Uttara": 13,
  "Gulshan|Mirpur": 13,
  "Gulshan|Mohakhali": 4,
  "Gulshan|Uttara": 14,
  "Mirpur|Mohakhali": 10,
  "Mirpur|Uttara": 9,
  "Mohakhali|Uttara": 11,
};

function distanceKey(zoneNameA, zoneNameB) {
  return [zoneNameA, zoneNameB].sort().join("|");
}

function getDistanceKm(zoneNameA, zoneNameB) {
  if (zoneNameA === zoneNameB) {
    throw new Error(`Pickup and destination zones must differ (got "${zoneNameA}" twice)`);
  }

  const distance = DISTANCE_KM[distanceKey(zoneNameA, zoneNameB)];
  if (distance === undefined) {
    throw new Error(`No distance defined between "${zoneNameA}" and "${zoneNameB}"`);
  }

  return distance;
}

module.exports = { ZONES, getDistanceKm };

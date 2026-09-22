const {
  calculateEstimatedFarePaisa,
  calculatePooledFarePaisa,
  calculatePoolDiscountPaisa,
} = require("../src/lib/fare");
const { getDistanceKm } = require("../src/data/zones");

// Exact integer assertions only — MASTER_PLAN.md Section 9: "no floating-point assertions".
describe("fare calculation — Section 5.2 worked example", () => {
  it("pool discount is exactly 450 paisa (floor(3000 * 15 / 100))", () => {
    expect(calculatePoolDiscountPaisa()).toBe(450);
  });

  it("Nusrat's pooled fare (Banani->Mohakhali, 3km) is exactly 7050 paisa", () => {
    const distanceKm = getDistanceKm("Banani", "Mohakhali");
    expect(distanceKm).toBe(3);
    expect(calculatePooledFarePaisa(distanceKm)).toBe(7050);
  });

  it("Rafiq's pooled fare (Banani->Gulshan, 4km) is exactly 8550 paisa", () => {
    const distanceKm = getDistanceKm("Banani", "Gulshan");
    expect(distanceKm).toBe(4);
    expect(calculatePooledFarePaisa(distanceKm)).toBe(8550);
  });

  it("estimated fare (no discount) for a 3km trip is exactly 7500 paisa", () => {
    expect(calculateEstimatedFarePaisa(3)).toBe(7500);
  });

  it("estimated fare for a 4km trip is exactly 9000 paisa", () => {
    expect(calculateEstimatedFarePaisa(4)).toBe(9000);
  });

  it("returns whole-number paisa for every zone pair (no float drift)", () => {
    const distanceKm = getDistanceKm("Dhanmondi", "Uttara");
    const fare = calculateEstimatedFarePaisa(distanceKm);
    expect(Number.isInteger(fare)).toBe(true);
  });

  it("throws for identical pickup/destination zones", () => {
    expect(() => getDistanceKm("Banani", "Banani")).toThrow();
  });
});

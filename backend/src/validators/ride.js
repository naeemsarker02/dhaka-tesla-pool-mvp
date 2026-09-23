const { z } = require("zod");

// seatsRequested bounded to 1..3 (MASTER_PLAN.md Section 13.6) — Bullet's capacity is the
// practical ceiling; rejected here before it ever reaches the matching service.
const createRideRequestSchema = z.object({
  pickupZoneId: z.string().uuid("pickupZoneId must be a valid zone id"),
  destinationZoneId: z.string().uuid("destinationZoneId must be a valid zone id"),
  seatsRequested: z
    .number()
    .int()
    .min(1, "seatsRequested must be at least 1")
    .max(3, "seatsRequested must be at most 3"),
});

module.exports = { createRideRequestSchema };

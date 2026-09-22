const { z } = require("zod");

const createRideRequestSchema = z.object({
  pickupZoneId: z.string().uuid("pickupZoneId must be a valid zone id"),
  destinationZoneId: z.string().uuid("destinationZoneId must be a valid zone id"),
  seatsRequested: z.number().int().positive("seatsRequested must be a positive integer"),
});

module.exports = { createRideRequestSchema };

const { prisma } = require("../lib/prisma");
const { getDistanceKm } = require("../data/zones");
const { calculateEstimatedFarePaisa } = require("../lib/fare");
const { ValidationError, ForbiddenError } = require("../lib/errors");

// POST /api/rides — MASTER_PLAN.md Section 7/Phase 3. Only creates the ride_request and computes
// estimated_fare_paisa (no pool discount, Section 5.1). Matching into a pool is Phase 4 — this
// intentionally does not touch pool_memberships yet.
async function createRideRequest(passengerId, { pickupZoneId, destinationZoneId, seatsRequested }) {
  if (pickupZoneId === destinationZoneId) {
    throw new ValidationError("pickupZoneId and destinationZoneId must be different zones");
  }

  const [pickupZone, destinationZone] = await Promise.all([
    prisma.zone.findUnique({ where: { id: pickupZoneId } }),
    prisma.zone.findUnique({ where: { id: destinationZoneId } }),
  ]);

  if (!pickupZone) {
    throw new ValidationError("pickupZoneId does not match a known zone");
  }
  if (!destinationZone) {
    throw new ValidationError("destinationZoneId does not match a known zone");
  }

  const distanceKm = getDistanceKm(pickupZone.name, destinationZone.name);
  const estimatedFarePaisa = calculateEstimatedFarePaisa(distanceKm);

  return prisma.rideRequest.create({
    data: {
      passengerId,
      pickupZoneId,
      destinationZoneId,
      seatsRequested,
      estimatedFarePaisa,
    },
  });
}

async function getRideRequestById(passengerId, rideRequestId) {
  const rideRequest = await prisma.rideRequest.findUnique({ where: { id: rideRequestId } });

  if (!rideRequest) {
    throw new ValidationError("Ride request not found");
  }
  if (rideRequest.passengerId !== passengerId) {
    throw new ForbiddenError("You do not own this ride request");
  }

  return rideRequest;
}

async function listRideRequestsForPassenger(passengerId) {
  return prisma.rideRequest.findMany({
    where: { passengerId },
    orderBy: { requestedAt: "desc" },
  });
}

module.exports = { createRideRequest, getRideRequestById, listRideRequestsForPassenger };

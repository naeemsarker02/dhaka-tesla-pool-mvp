const { prisma } = require("../lib/prisma");
const { getDistanceKm } = require("../data/zones");
const { calculateEstimatedFarePaisa } = require("../lib/fare");
const { ValidationError, ForbiddenError } = require("../lib/errors");
const { matchRideRequest } = require("./matchingService");

// POST /api/rides — MASTER_PLAN.md Section 7. Creates the ride_request with estimated_fare_paisa
// (no pool discount, Section 5.1), then immediately runs the matching service (Section 3.1/4).
// A pool_membership may be created, but ride_request.status always stays REQUESTED here — it only
// becomes MATCHED when a driver accepts the pool (Section 3.1), never at matching time.
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

  const rideRequest = await prisma.rideRequest.create({
    data: {
      passengerId,
      pickupZoneId,
      destinationZoneId,
      seatsRequested,
      estimatedFarePaisa,
    },
  });

  await matchRideRequest(rideRequest, pickupZone, destinationZone);

  return rideRequest;
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

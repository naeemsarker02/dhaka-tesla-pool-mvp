const { prisma } = require("../lib/prisma");
const { getDistanceKm } = require("../data/zones");
const { calculateEstimatedFarePaisa } = require("../lib/fare");
const { ValidationError, ForbiddenError, ConflictError } = require("../lib/errors");
const { matchRideRequest } = require("./matchingService");
const { RIDE_REQUEST_TRANSITIONS, canTransition } = require("../lib/stateMachine");

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

// POST /api/rides/:id/cancel — Section 6.1. Only valid from REQUESTED/MATCHED. Atomically: set
// CANCELLED, release the pool_membership if one exists (row-locked decrement of
// pools.seats_occupied, Section 6 pattern), and cancel the pool too if that was its last active
// member. Known limitation (Section 6.1, not a bug): fare_paisa is NOT retroactively recalculated
// for remaining pool members if a passenger cancels after MATCHED.
async function cancelRideRequest(passengerId, rideRequestId) {
  return prisma.$transaction(async (tx) => {
    // Re-check status inside the transaction to avoid a stale-read race with a driver
    // simultaneously advancing the pool (Section 6.1 step 1).
    const rideRequest = await tx.rideRequest.findUnique({
      where: { id: rideRequestId },
      include: { poolMembership: true },
    });

    if (!rideRequest) {
      throw new ValidationError("Ride request not found");
    }
    if (rideRequest.passengerId !== passengerId) {
      throw new ForbiddenError("You do not own this ride request");
    }
    if (!canTransition(RIDE_REQUEST_TRANSITIONS, rideRequest.status, "CANCELLED")) {
      throw new ConflictError(`Cannot cancel a ride request with status ${rideRequest.status}`);
    }

    const now = new Date();

    await tx.rideRequest.update({
      where: { id: rideRequestId },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    await tx.rideStatusHistory.create({
      data: {
        rideRequestId,
        fromStatus: rideRequest.status,
        toStatus: "CANCELLED",
        changedBy: passengerId,
      },
    });

    const membership = rideRequest.poolMembership;
    if (membership) {
      // Row-locked decrement, same pattern as the seat claim (Section 6).
      await tx.$queryRaw`SELECT id FROM pools WHERE id = ${membership.poolId} FOR UPDATE`;
      await tx.poolMembership.delete({ where: { id: membership.id } });
      await tx.$executeRaw`UPDATE pools SET seats_occupied = seats_occupied - ${membership.seats} WHERE id = ${membership.poolId}`;

      const remainingMembers = await tx.poolMembership.count({ where: { poolId: membership.poolId } });
      if (remainingMembers === 0) {
        const pool = await tx.pool.findUnique({ where: { id: membership.poolId } });
        if (pool.status === "OPEN" || pool.status === "MATCHED") {
          await tx.pool.update({ where: { id: membership.poolId }, data: { status: "CANCELLED" } });
        }
      }
    }

    return tx.rideRequest.findUnique({ where: { id: rideRequestId } });
  });
}

module.exports = {
  createRideRequest,
  getRideRequestById,
  listRideRequestsForPassenger,
  cancelRideRequest,
};

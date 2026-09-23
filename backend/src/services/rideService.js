const { Prisma } = require("@prisma/client");
const { prisma } = require("../lib/prisma");
const { getDistanceKm } = require("../data/zones");
const {
  calculateEstimatedFarePaisa,
  calculateCancellationFeePaisa,
} = require("../lib/fare");
const { ValidationError, ForbiddenError, ConflictError } = require("../lib/errors");
const { matchRideRequest } = require("./matchingService");
const { RIDE_REQUEST_TRANSITIONS, canTransition } = require("../lib/stateMachine");

// A passenger may only have one of these open at a time (Section 13.2).
const ACTIVE_RIDE_STATUSES = ["REQUESTED", "MATCHED", "DRIVER_ARRIVED", "STARTED"];

// Section 6.2 grace-window cancellation — env-configurable, defaults to 60s.
const GRACE_WINDOW_SECONDS = Number(process.env.GRACE_WINDOW_SECONDS) || 60;

// POST /api/rides — MASTER_PLAN.md Section 7. Creates the ride_request with estimated_fare_paisa
// (no pool discount, Section 5.1), then immediately runs the matching service (Section 3.1/4).
// A pool_membership may be created, but ride_request.status always stays REQUESTED here — it only
// becomes MATCHED when a driver accepts the pool (Section 3.1), never at matching time.
//
// idempotencyKey (Section 13.1): if provided and a ride_request with the same
// (passengerId, idempotencyKey) already exists, that original row is returned instead of creating
// a second one — no matching re-run, no duplicate.
async function createRideRequest(
  passengerId,
  { pickupZoneId, destinationZoneId, seatsRequested },
  idempotencyKey
) {
  if (idempotencyKey) {
    const existing = await prisma.rideRequest.findFirst({
      where: { passengerId, idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  if (pickupZoneId === destinationZoneId) {
    throw new ValidationError("pickupZoneId and destinationZoneId must be different zones");
  }

  // One active ride request per passenger (Section 13.2) — must complete or cancel first.
  const activeRideRequest = await prisma.rideRequest.findFirst({
    where: { passengerId, status: { in: ACTIVE_RIDE_STATUSES } },
  });
  if (activeRideRequest) {
    throw new ConflictError("You already have an active ride request");
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

  let rideRequest;
  try {
    rideRequest = await prisma.rideRequest.create({
      data: {
        passengerId,
        pickupZoneId,
        destinationZoneId,
        seatsRequested,
        estimatedFarePaisa,
        idempotencyKey: idempotencyKey || null,
      },
    });
  } catch (err) {
    // Unique-constraint race on idempotencyKey (Section 13.1) — a concurrent retry with the same
    // key beat this one to the insert; return that row instead of failing.
    if (idempotencyKey && err.code === "P2002") {
      const existing = await prisma.rideRequest.findFirst({
        where: { passengerId, idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }
    throw err;
  }

  await matchRideRequest(rideRequest, pickupZone, destinationZone);

  return rideRequest;
}

async function getRideRequestById(passengerId, rideRequestId) {
  const rideRequest = await prisma.rideRequest.findUnique({
    where: { id: rideRequestId },
    include: { pickupZone: true, destinationZone: true },
  });

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
    include: { pickupZone: true, destinationZone: true },
    orderBy: { requestedAt: "desc" },
  });
}

// POST /api/rides/:id/cancel — Section 6.1. Only valid from REQUESTED/MATCHED. Atomically: set
// CANCELLED, compute the Section 6.2 grace-window flags, release the pool_membership if one
// exists (row-locked decrement of pools.seats_occupied, Section 6 pattern), and cancel the pool
// too if that was its last active member. Known limitation (Section 6.1, not a bug): fare_paisa is
// NOT retroactively recalculated for remaining pool members if a passenger cancels after MATCHED.
//
// isolationLevel: ReadCommitted — same reason as matchingService.matchRideRequest
// (docs/decisions.md item 26): this transaction's first statement (rideRequest.findUnique) is a
// plain read, which under MySQL's default REPEATABLE READ would pin a snapshot from before the
// pool row lock below is acquired. The plain `poolMembership.count` right after that lock needs
// to see another concurrently-cancelling passenger's already-committed membership deletion — if
// two members of the same pool cancel at nearly the same instant, a stale snapshot could make
// both see a non-zero remaining count and neither would ever cancel the now-actually-empty pool.
async function cancelRideRequest(passengerId, rideRequestId) {
  return prisma.$transaction(
    async (tx) => {
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

      // Section 6.2 — free from REQUESTED (driver never committed); flagged only when cancelling
      // from MATCHED more than GRACE_WINDOW_SECONDS after matched_at. Fee is computed against the
      // already-finalized fare_paisa, recorded for demonstration only, never charged.
      let lateCancellation = false;
      let cancellationFeePaisa = null;
      if (rideRequest.status === "MATCHED" && rideRequest.matchedAt) {
        const elapsedSeconds = (now.getTime() - new Date(rideRequest.matchedAt).getTime()) / 1000;
        lateCancellation = elapsedSeconds > GRACE_WINDOW_SECONDS;
        if (lateCancellation && rideRequest.farePaisa != null) {
          cancellationFeePaisa = calculateCancellationFeePaisa(rideRequest.farePaisa);
        }
      }

      await tx.rideRequest.update({
        where: { id: rideRequestId },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          lateCancellation,
          cancellationFeePaisa,
        },
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
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
  );
}

module.exports = {
  createRideRequest,
  getRideRequestById,
  listRideRequestsForPassenger,
  cancelRideRequest,
};

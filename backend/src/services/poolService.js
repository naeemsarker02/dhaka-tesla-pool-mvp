const { prisma } = require("../lib/prisma");
const { getDistanceKm } = require("../data/zones");
const { calculatePooledFarePaisa } = require("../lib/fare");
const { ValidationError, ForbiddenError, ConflictError } = require("../lib/errors");
const { POOL_TRANSITIONS, RIDE_REQUEST_TRANSITIONS, canTransition } = require("../lib/stateMachine");

// ride_requests has arrived_at/started_at/completed_at columns per member; pools only tracks
// matched_at/completed_at (docs/erd.md) — DRIVER_ARRIVED/STARTED are pool-status-only on the pool
// row itself, no separate pool timestamp column for those two.
const RIDE_REQUEST_TIMESTAMP_FIELD = {
  DRIVER_ARRIVED: "arrivedAt",
  STARTED: "startedAt",
  COMPLETED: "completedAt",
};

// GET /api/driver/requests — OPEN pools belonging to the requesting driver's own Tesla.
async function listOpenPoolsForDriver(driverId) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) {
    throw new ValidationError("You do not have a registered Tesla");
  }

  return prisma.pool.findMany({
    where: { teslaId: tesla.id, status: "OPEN" },
    include: {
      memberships: {
        include: {
          rideRequest: {
            include: { pickupZone: true, destinationZone: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

// POST /api/driver/pools/:poolId/accept — OPEN -> MATCHED (Section 3.1). Cascades every member's
// ride_request REQUESTED -> MATCHED and finalizes fare_paisa (Section 5.1), all in one
// transaction. No further ride_requests may join this pool after this point.
async function acceptPool(driverId, poolId) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tesla: true },
  });

  if (!pool) {
    throw new ValidationError("Pool not found");
  }
  if (pool.tesla.driverId !== driverId) {
    throw new ForbiddenError("You do not own this pool's Tesla");
  }
  if (!canTransition(POOL_TRANSITIONS, pool.status, "MATCHED")) {
    throw new ConflictError(`Cannot accept a pool with status ${pool.status}`);
  }

  return prisma.$transaction(async (tx) => {
    const memberships = await tx.poolMembership.findMany({
      where: { poolId },
      include: {
        rideRequest: { include: { pickupZone: true, destinationZone: true } },
      },
    });

    const isPooled = memberships.length >= 2;
    const now = new Date();

    for (const membership of memberships) {
      const { rideRequest } = membership;
      const farePaisa = isPooled
        ? calculatePooledFarePaisa(
            getDistanceKm(rideRequest.pickupZone.name, rideRequest.destinationZone.name)
          )
        : rideRequest.estimatedFarePaisa;

      await tx.rideRequest.update({
        where: { id: rideRequest.id },
        data: { status: "MATCHED", matchedAt: now, farePaisa },
      });

      await tx.rideStatusHistory.create({
        data: {
          rideRequestId: rideRequest.id,
          fromStatus: rideRequest.status,
          toStatus: "MATCHED",
          changedBy: driverId,
        },
      });
    }

    return tx.pool.update({
      where: { id: poolId },
      data: { status: "MATCHED", matchedAt: now },
    });
  });
}

// PATCH /api/driver/pools/:poolId/status — DRIVER_ARRIVED/STARTED/COMPLETED are pool-level events
// (the whole Tesla moves through them together, Section 3.2/7). Cascades to every current member's
// ride_request in the same transaction, writing one ride_status_history row per member. Every
// existing membership is "active" by construction — a cancelled member's membership row is
// deleted at cancel time (Section 6.1), never left dangling.
async function advancePoolStatus(driverId, poolId, targetStatus) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tesla: true },
  });

  if (!pool) {
    throw new ValidationError("Pool not found");
  }
  if (pool.tesla.driverId !== driverId) {
    throw new ForbiddenError("You do not own this pool's Tesla");
  }
  if (!canTransition(POOL_TRANSITIONS, pool.status, targetStatus)) {
    throw new ConflictError(`Cannot transition pool from ${pool.status} to ${targetStatus}`);
  }

  return prisma.$transaction(async (tx) => {
    const memberships = await tx.poolMembership.findMany({
      where: { poolId },
      include: { rideRequest: true },
    });
    const now = new Date();
    const rideRequestTimestampField = RIDE_REQUEST_TIMESTAMP_FIELD[targetStatus];

    for (const { rideRequest } of memberships) {
      if (!canTransition(RIDE_REQUEST_TRANSITIONS, rideRequest.status, targetStatus)) {
        // Defensive only — pool and its members' statuses are kept in lockstep by this same
        // cascade, so this should never actually trigger.
        continue;
      }

      await tx.rideRequest.update({
        where: { id: rideRequest.id },
        data: { status: targetStatus, [rideRequestTimestampField]: now },
      });

      await tx.rideStatusHistory.create({
        data: {
          rideRequestId: rideRequest.id,
          fromStatus: rideRequest.status,
          toStatus: targetStatus,
          changedBy: driverId,
        },
      });
    }

    return tx.pool.update({
      where: { id: poolId },
      data: {
        status: targetStatus,
        ...(targetStatus === "COMPLETED" ? { completedAt: now } : {}),
      },
    });
  });
}

// GET /api/driver/pools/:id — full detail for one pool, any status (not just OPEN).
async function getPoolById(driverId, poolId) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      tesla: true,
      memberships: {
        include: { rideRequest: { include: { pickupZone: true, destinationZone: true } } },
      },
    },
  });

  if (!pool) {
    throw new ValidationError("Pool not found");
  }
  if (pool.tesla.driverId !== driverId) {
    throw new ForbiddenError("You do not own this pool's Tesla");
  }

  return pool;
}

// GET /api/driver/history — every pool (any terminal or in-progress status) tied to the driver's
// Tesla, most recent first.
async function listPoolHistoryForDriver(driverId) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) {
    throw new ValidationError("You do not have a registered Tesla");
  }

  return prisma.pool.findMany({
    where: { teslaId: tesla.id },
    include: {
      memberships: {
        include: { rideRequest: { include: { pickupZone: true, destinationZone: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

module.exports = {
  listOpenPoolsForDriver,
  acceptPool,
  advancePoolStatus,
  getPoolById,
  listPoolHistoryForDriver,
};

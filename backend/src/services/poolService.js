const { prisma } = require("../lib/prisma");
const { getDistanceKm } = require("../data/zones");
const { calculatePooledFarePaisa } = require("../lib/fare");
const { ValidationError, ForbiddenError, ConflictError } = require("../lib/errors");

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
  if (pool.status !== "OPEN") {
    throw new ConflictError(`Pool is not open for acceptance (status: ${pool.status})`);
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

module.exports = { listOpenPoolsForDriver, acceptPool };

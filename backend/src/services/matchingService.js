const { prisma } = require("../lib/prisma");

const NON_TERMINAL_POOL_STATUSES = ["OPEN", "MATCHED", "DRIVER_ARRIVED", "STARTED"];

// Section 4 matching rule: same pickup cluster, same destination cluster, capacity available.
// A pool's cluster identity is whatever its first member's zones are — every later join must
// match that, per docs/erd.md.
async function findCompatibleOpenPool(tx, pickupCluster, destinationCluster, seatsRequested) {
  const pools = await tx.pool.findMany({
    where: { status: "OPEN" },
    include: {
      tesla: true,
      memberships: {
        take: 1,
        include: { rideRequest: { include: { pickupZone: true, destinationZone: true } } },
      },
    },
  });

  return (
    pools.find((pool) => {
      const [firstMembership] = pool.memberships;
      if (!firstMembership) return false;

      const { pickupZone, destinationZone } = firstMembership.rideRequest;
      if (pickupZone.cluster !== pickupCluster) return false;
      if (destinationZone.cluster !== destinationCluster) return false;
      if (pool.seatsOccupied + seatsRequested > pool.tesla.capacity) return false;

      return true;
    }) || null
  );
}

// One-active-pool-per-Tesla invariant + new-pool Tesla selection — docs/decisions.md item 7.
// Only an ONLINE Tesla with zero non-terminal pools is eligible to receive a brand-new pool.
async function findEligibleOnlineTesla(tx) {
  const teslas = await tx.tesla.findMany({
    where: { status: "ONLINE" },
    include: { pools: { where: { status: { in: NON_TERMINAL_POOL_STATUSES } } } },
  });

  return teslas.find((tesla) => tesla.pools.length === 0) || null;
}

// Called right after a ride_request is created. Either joins a compatible OPEN pool or opens a
// new one on an eligible Tesla — or leaves the request unpooled if neither is possible.
// ride_request.status is never touched here — it stays REQUESTED either way (Section 3.1).
async function matchRideRequest(rideRequest, pickupZone, destinationZone) {
  return prisma.$transaction(async (tx) => {
    const openPool = await findCompatibleOpenPool(
      tx,
      pickupZone.cluster,
      destinationZone.cluster,
      rideRequest.seatsRequested
    );

    if (openPool) {
      await tx.poolMembership.create({
        data: {
          poolId: openPool.id,
          rideRequestId: rideRequest.id,
          seats: rideRequest.seatsRequested,
        },
      });
      await tx.pool.update({
        where: { id: openPool.id },
        data: { seatsOccupied: { increment: rideRequest.seatsRequested } },
      });
      return { poolId: openPool.id, pooled: true };
    }

    const tesla = await findEligibleOnlineTesla(tx);
    if (!tesla) {
      return { poolId: null, pooled: false };
    }

    const pool = await tx.pool.create({
      data: { teslaId: tesla.id, seatsOccupied: rideRequest.seatsRequested },
    });
    await tx.poolMembership.create({
      data: { poolId: pool.id, rideRequestId: rideRequest.id, seats: rideRequest.seatsRequested },
    });

    return { poolId: pool.id, pooled: true };
  });
}

module.exports = { matchRideRequest, NON_TERMINAL_POOL_STATUSES };

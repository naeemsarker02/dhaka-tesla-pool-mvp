const { prisma } = require("../lib/prisma");

const NON_TERMINAL_POOL_STATUSES = ["OPEN", "MATCHED", "DRIVER_ARRIVED", "STARTED"];

// Section 4 matching rule: same pickup cluster, same destination cluster, capacity available.
// A pool's cluster identity is whatever its first member's zones are — every later join must
// match that, per docs/erd.md. This is an unlocked candidate search only — the actual seat claim
// below re-verifies capacity under a row lock, since concurrent requests can race between this
// read and the write (Section 6).
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

// The actual seat claim — MASTER_PLAN.md Section 6 pattern exactly: SELECT ... FOR UPDATE inside
// the transaction to hold a row lock for its lifetime, re-check capacity against the freshly
// locked value, then write. Prisma's query builder has no FOR UPDATE, so this uses $queryRaw for
// the locking read and $executeRaw for the counter increment. Returns false (not an exception) on
// a lost race — the caller falls back to trying a new pool instead of failing ride-request
// creation outright (docs/decisions.md item 17).
async function tryClaimSeatInPool(tx, poolId, teslaCapacity, rideRequestId, seatsRequested) {
  const rows = await tx.$queryRaw`SELECT seats_occupied FROM pools WHERE id = ${poolId} FOR UPDATE`;
  const pool = rows[0];
  if (!pool) return false;

  if (pool.seats_occupied + seatsRequested > teslaCapacity) {
    return false;
  }

  await tx.poolMembership.create({
    data: { poolId, rideRequestId, seats: seatsRequested },
  });
  await tx.$executeRaw`UPDATE pools SET seats_occupied = seats_occupied + ${seatsRequested} WHERE id = ${poolId}`;

  return true;
}

// One-active-pool-per-Tesla invariant + new-pool Tesla selection — docs/decisions.md item 7.
// Locks candidate ONLINE Tesla rows for the transaction's lifetime so two concurrent ride
// requests can never both decide the same Tesla is free and create two competing pools for it
// (docs/decisions.md item 17) — the same race class as the seat claim above, just on `teslas`
// instead of `pools`.
async function findEligibleOnlineTesla(tx) {
  const onlineTeslas = await tx.$queryRaw`SELECT id, capacity FROM teslas WHERE status = 'ONLINE' FOR UPDATE`;

  for (const tesla of onlineTeslas) {
    const activePool = await tx.pool.findFirst({
      where: { teslaId: tesla.id, status: { in: NON_TERMINAL_POOL_STATUSES } },
      select: { id: true },
    });
    if (!activePool) {
      return tesla;
    }
  }

  return null;
}

// Called right after a ride_request is created. Either joins a compatible OPEN pool or opens a
// new one on an eligible Tesla — or leaves the request unpooled if neither is possible.
// ride_request.status is never touched here — it stays REQUESTED either way (Section 3.1).
async function matchRideRequest(rideRequest, pickupZone, destinationZone) {
  return prisma.$transaction(async (tx) => {
    const candidatePool = await findCompatibleOpenPool(
      tx,
      pickupZone.cluster,
      destinationZone.cluster,
      rideRequest.seatsRequested
    );

    if (candidatePool) {
      const claimed = await tryClaimSeatInPool(
        tx,
        candidatePool.id,
        candidatePool.tesla.capacity,
        rideRequest.id,
        rideRequest.seatsRequested
      );
      if (claimed) {
        return { poolId: candidatePool.id, pooled: true };
      }
      // Lost the race for the last seat under concurrency — fall through and try opening a new
      // pool instead, same as if no compatible pool had existed at all.
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

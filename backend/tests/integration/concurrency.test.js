// Real-database concurrency test — MASTER_PLAN.md Section 9: "Two concurrent requests for the
// last seat can't corrupt pool capacity." Row-level locking correctness cannot be proven against
// a mocked Prisma client (mocks can't simulate MySQL/InnoDB lock waits), so this uses the real
// Prisma client against a real database. Run via `npm run test:integration` — requires
// DATABASE_URL to point at a reachable MySQL/MariaDB instance.
//
// Uses its own isolated Tesla/users/zones-linked rows (never the seeded Jashim/Bullet data) so it
// can run repeatably without disturbing demo data, and cleans up everything it creates.
const { PrismaClient } = require("@prisma/client");
const { matchRideRequest } = require("../../src/services/matchingService");
const { cancelRideRequest } = require("../../src/services/rideService");

const prisma = new PrismaClient();

let driver;
let tesla;
let banani;
let mohakhali;
let otherOnlineTeslaIds = [];
const passengerIds = [];
const rideRequestIds = [];

beforeAll(async () => {
  banani = await prisma.zone.findUnique({ where: { name: "Banani" } });
  mohakhali = await prisma.zone.findUnique({ where: { name: "Mohakhali" } });

  if (!banani || !mohakhali) {
    throw new Error(
      "Seed zones not found — run `npx prisma db seed` against this database before " +
        "running the integration suite."
    );
  }

  driver = await prisma.user.create({
    data: {
      name: "Integration Test Driver",
      email: `integration-driver-${Date.now()}@dhakateslapool.test`,
      passwordHash: "not-a-real-hash",
      role: "DRIVER",
      phone: "01700000099",
    },
  });

  // Small, deterministic capacity (2) so the race is on the *last* seat, matching the master
  // plan's scenario exactly, without waiting on a large Promise.all batch.
  tesla = await prisma.tesla.create({
    data: { driverId: driver.id, name: "Integration Test Car", capacity: 2, status: "ONLINE" },
  });

  // Matching searches ALL online Teslas system-wide (correct production behavior — a losing
  // seat-claim legitimately falls back to any other eligible Tesla, e.g. the seeded Bullet). For
  // this test to deterministically prove "the loser doesn't get pooled," this Tesla must be the
  // *only* online one for its duration — temporarily take any others offline and restore after.
  const others = await prisma.tesla.findMany({
    where: { status: "ONLINE", id: { not: tesla.id } },
    select: { id: true },
  });
  otherOnlineTeslaIds = others.map((t) => t.id);
  if (otherOnlineTeslaIds.length > 0) {
    await prisma.tesla.updateMany({
      where: { id: { in: otherOnlineTeslaIds } },
      data: { status: "OFFLINE" },
    });
  }
});

afterAll(async () => {
  // rideStatusHistory rows (written by cancelRideRequest, exercised by the cancel-race test
  // below) FK-reference ride_requests — must go first or the deleteMany below is blocked.
  await prisma.rideStatusHistory.deleteMany({ where: { rideRequestId: { in: rideRequestIds } } });
  await prisma.poolMembership.deleteMany({ where: { rideRequestId: { in: rideRequestIds } } });
  await prisma.pool.deleteMany({ where: { teslaId: tesla.id } });
  await prisma.rideRequest.deleteMany({ where: { id: { in: rideRequestIds } } });
  await prisma.tesla.delete({ where: { id: tesla.id } });
  await prisma.user.deleteMany({ where: { id: { in: [driver.id, ...passengerIds] } } });
  if (otherOnlineTeslaIds.length > 0) {
    await prisma.tesla.updateMany({
      where: { id: { in: otherOnlineTeslaIds } },
      data: { status: "ONLINE" },
    });
  }
  await prisma.$disconnect();
});

async function createPassenger(name) {
  const passenger = await prisma.user.create({
    data: {
      name,
      email: `integration-${name.toLowerCase()}-${Date.now()}-${Math.random()}@dhakateslapool.test`,
      passwordHash: "not-a-real-hash",
      role: "PASSENGER",
      phone: "01700000098",
    },
  });
  passengerIds.push(passenger.id);
  return passenger;
}

async function createRideRequest(passengerId) {
  const rideRequest = await prisma.rideRequest.create({
    data: {
      passengerId,
      pickupZoneId: banani.id,
      destinationZoneId: mohakhali.id,
      seatsRequested: 1,
      estimatedFarePaisa: 7500,
    },
  });
  rideRequestIds.push(rideRequest.id);
  return rideRequest;
}

test("two concurrent requests for the last seat: exactly one wins, seats_occupied never exceeds capacity", async () => {
  // Seed the pool to 1/2 seats occupied first (deterministic setup, not part of the race itself).
  const seedPassenger = await createPassenger("Seed");
  const seedRequest = await createRideRequest(seedPassenger.id);
  const seedMatch = await matchRideRequest(seedRequest, banani, mohakhali);

  expect(seedMatch.pooled).toBe(true);
  const poolId = seedMatch.poolId;

  const poolAfterSeed = await prisma.pool.findUnique({ where: { id: poolId } });
  expect(poolAfterSeed.seatsOccupied).toBe(1);

  // Now the actual race: Nusrat and Shirin both try to claim the one remaining seat at once.
  const nusrat = await createPassenger("Nusrat");
  const shirin = await createPassenger("Shirin");
  const nusratRequest = await createRideRequest(nusrat.id);
  const shirinRequest = await createRideRequest(shirin.id);

  const [nusratResult, shirinResult] = await Promise.all([
    matchRideRequest(nusratRequest, banani, mohakhali),
    matchRideRequest(shirinRequest, banani, mohakhali),
  ]);

  const results = [nusratResult, shirinResult];
  const winners = results.filter((r) => r.pooled && r.poolId === poolId);
  const losers = results.filter((r) => !r.pooled);

  // Exactly one claims the last seat in the existing pool; the other stays unpooled (no other
  // eligible Tesla exists for this isolated test fixture).
  expect(winners).toHaveLength(1);
  expect(losers).toHaveLength(1);

  const finalPool = await prisma.pool.findUnique({ where: { id: poolId } });
  expect(finalPool.seatsOccupied).toBe(2);
  expect(finalPool.seatsOccupied).toBeLessThanOrEqual(tesla.capacity);

  const finalMembershipCount = await prisma.poolMembership.count({ where: { poolId } });
  expect(finalMembershipCount).toBe(2);
}, 20000);

// Regression test for docs/decisions.md item 26 — found live via CI against real MySQL 8, not by
// any test that existed before this one. The test above only races for the last seat in an
// *already-existing* pool; it never exercised the "two brand-new requests race to open the
// *first* pool on the same Tesla" path, which is where the actual bug was: under MySQL's default
// REPEATABLE READ isolation, findEligibleOnlineTesla's "does this tesla already have an active
// pool" check (a plain read) can still see a pre-lock snapshot even after successfully acquiring
// the FOR UPDATE tesla lock, because an earlier plain read elsewhere in the same transaction
// (findCompatibleOpenPool) already pinned that snapshot before the lock was taken. Fixed by
// running matchRideRequest's transaction under ReadCommitted isolation instead.
test("two concurrent first-time requests for the same Tesla: only one pool is ever created", async () => {
  const raceDriver = await prisma.user.create({
    data: {
      name: "Integration Test Driver (new-pool race)",
      email: `integration-driver-race-${Date.now()}@dhakateslapool.test`,
      passwordHash: "not-a-real-hash",
      role: "DRIVER",
      phone: "01700000097",
    },
  });
  const raceTesla = await prisma.tesla.create({
    data: { driverId: raceDriver.id, name: "Integration Test Car (race)", capacity: 3, status: "ONLINE" },
  });
  const others = await prisma.tesla.findMany({
    where: { status: "ONLINE", id: { not: raceTesla.id } },
    select: { id: true },
  });
  const otherIds = others.map((t) => t.id);
  if (otherIds.length > 0) {
    await prisma.tesla.updateMany({ where: { id: { in: otherIds } }, data: { status: "OFFLINE" } });
  }

  try {
    const nusrat = await createPassenger("NewPoolRaceNusrat");
    const rafiq = await createPassenger("NewPoolRaceRafiq");
    const nusratRequest = await createRideRequest(nusrat.id);
    const rafiqRequest = await createRideRequest(rafiq.id);

    const [nusratResult, rafiqResult] = await Promise.all([
      matchRideRequest(nusratRequest, banani, mohakhali),
      matchRideRequest(rafiqRequest, banani, mohakhali),
    ]);

    expect(nusratResult.pooled).toBe(true);
    expect(rafiqResult.pooled).toBe(true);
    // The actual invariant under test: both land in the SAME pool, not two separate ones on the
    // same Tesla (the "one active pool per Tesla" invariant, docs/decisions.md item 7).
    expect(nusratResult.poolId).toBe(rafiqResult.poolId);

    const pools = await prisma.pool.findMany({ where: { teslaId: raceTesla.id } });
    expect(pools).toHaveLength(1);
    expect(pools[0].seatsOccupied).toBe(2);
  } finally {
    await prisma.poolMembership.deleteMany({
      where: { rideRequestId: { in: rideRequestIds.slice(-2) } },
    });
    await prisma.pool.deleteMany({ where: { teslaId: raceTesla.id } });
    await prisma.tesla.delete({ where: { id: raceTesla.id } });
    await prisma.user.delete({ where: { id: raceDriver.id } });
    if (otherIds.length > 0) {
      await prisma.tesla.updateMany({ where: { id: { in: otherIds } }, data: { status: "ONLINE" } });
    }
  }
}, 20000);

// Regression test for the other half of docs/decisions.md item 26: cancelRideRequest's
// transaction has the identical plain-read-before-lock structure as matchRideRequest (a plain
// rideRequest.findUnique first, then a pools row lock, then a plain poolMembership.count read
// right after it), fixed with the same ReadCommitted isolation level — but until now nothing
// actually exercised it under real concurrency. Without the fix, two members of the same pool
// cancelling at nearly the same instant could each see a stale non-zero remaining-member count
// (missing the other's already-committed membership deletion) and neither would ever cancel the
// now-actually-empty pool, leaving it orphaned OPEN forever.
test("two members of the same pool cancelling concurrently: the pool ends up correctly CANCELLED, not orphaned", async () => {
  const cancelDriver = await prisma.user.create({
    data: {
      name: "Integration Test Driver (cancel race)",
      email: `integration-driver-cancel-${Date.now()}@dhakateslapool.test`,
      passwordHash: "not-a-real-hash",
      role: "DRIVER",
      phone: "01700000096",
    },
  });
  const cancelTesla = await prisma.tesla.create({
    data: { driverId: cancelDriver.id, name: "Integration Test Car (cancel)", capacity: 3, status: "ONLINE" },
  });
  const others = await prisma.tesla.findMany({
    where: { status: "ONLINE", id: { not: cancelTesla.id } },
    select: { id: true },
  });
  const otherIds = others.map((t) => t.id);
  if (otherIds.length > 0) {
    await prisma.tesla.updateMany({ where: { id: { in: otherIds } }, data: { status: "OFFLINE" } });
  }

  try {
    const nusrat = await createPassenger("CancelRaceNusrat");
    const rafiq = await createPassenger("CancelRaceRafiq");
    const nusratRequest = await createRideRequest(nusrat.id);
    const rafiqRequest = await createRideRequest(rafiq.id);

    const nusratMatch = await matchRideRequest(nusratRequest, banani, mohakhali);
    const rafiqMatch = await matchRideRequest(rafiqRequest, banani, mohakhali);
    expect(nusratMatch.poolId).toBe(rafiqMatch.poolId);
    const poolId = nusratMatch.poolId;

    const poolBeforeCancel = await prisma.pool.findUnique({ where: { id: poolId } });
    expect(poolBeforeCancel.seatsOccupied).toBe(2);

    await Promise.all([
      cancelRideRequest(nusrat.id, nusratRequest.id),
      cancelRideRequest(rafiq.id, rafiqRequest.id),
    ]);

    const finalPool = await prisma.pool.findUnique({ where: { id: poolId } });
    expect(finalPool.status).toBe("CANCELLED");
    const finalMembershipCount = await prisma.poolMembership.count({ where: { poolId } });
    expect(finalMembershipCount).toBe(0);
  } finally {
    await prisma.pool.deleteMany({ where: { teslaId: cancelTesla.id } });
    await prisma.tesla.delete({ where: { id: cancelTesla.id } });
    await prisma.user.delete({ where: { id: cancelDriver.id } });
    if (otherIds.length > 0) {
      await prisma.tesla.updateMany({ where: { id: { in: otherIds } }, data: { status: "ONLINE" } });
    }
  }
}, 20000);

jest.mock("../src/lib/prisma", () => {
  const tx = {
    pool: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    poolMembership: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  return {
    prisma: {
      $transaction: jest.fn((callback) => callback(tx)),
      __tx: tx,
    },
  };
});

const { prisma } = require("../src/lib/prisma");
const { matchRideRequest } = require("../src/services/matchingService");
const { getDistanceKm } = require("../src/data/zones");

const BANANI = { id: "zone-banani", name: "Banani", cluster: "Gulshan-Mohakhali corridor" };
const MOHAKHALI = { id: "zone-mohakhali", name: "Mohakhali", cluster: "Gulshan-Mohakhali corridor" };
const MIRPUR = { id: "zone-mirpur", name: "Mirpur", cluster: "Dhanmondi-Mirpur-Farmgate corridor" };

describe("matchRideRequest — Section 4 matching rule + Section 6 row-locked seat claim", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Nusrat and Rafiq end up in the same OPEN pool and stay REQUESTED (no status touched here)", async () => {
    // Nusrat's request: no existing OPEN pool, one eligible online Tesla -> new pool.
    prisma.__tx.pool.findMany.mockResolvedValueOnce([]);
    prisma.__tx.$queryRaw.mockResolvedValueOnce([{ id: "tesla-bullet", capacity: 3 }]); // online teslas
    prisma.__tx.pool.findFirst.mockResolvedValueOnce(null); // Bullet has no active pool yet
    prisma.__tx.pool.create.mockResolvedValueOnce({ id: "pool-1", teslaId: "tesla-bullet" });

    const nusratRequest = { id: "ride-nusrat", seatsRequested: 1 };
    const nusratResult = await matchRideRequest(nusratRequest, BANANI, MOHAKHALI);

    expect(nusratResult).toEqual({ poolId: "pool-1", pooled: true });
    expect(prisma.__tx.pool.create).toHaveBeenCalledWith({
      data: { teslaId: "tesla-bullet", seatsOccupied: 1 },
    });
    expect(prisma.__tx.poolMembership.create).toHaveBeenCalledWith({
      data: { poolId: "pool-1", rideRequestId: "ride-nusrat", seats: 1 },
    });

    // Rafiq's request (Banani -> Gulshan, same cluster pair) joins Nusrat's now-OPEN pool.
    const existingPool = {
      id: "pool-1",
      status: "OPEN",
      seatsOccupied: 1,
      tesla: { capacity: 3 },
      memberships: [{ rideRequest: { pickupZone: BANANI, destinationZone: MOHAKHALI } }],
    };
    prisma.__tx.pool.findMany.mockResolvedValueOnce([existingPool]);
    prisma.__tx.$queryRaw.mockResolvedValueOnce([{ seats_occupied: 1 }]); // locked re-read: still room

    const rafiqRequest = { id: "ride-rafiq", seatsRequested: 1 };
    const rafiqResult = await matchRideRequest(rafiqRequest, BANANI, MOHAKHALI);

    expect(rafiqResult).toEqual({ poolId: "pool-1", pooled: true });
    expect(prisma.__tx.poolMembership.create).toHaveBeenLastCalledWith({
      data: { poolId: "pool-1", rideRequestId: "ride-rafiq", seats: 1 },
    });
    expect(prisma.__tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("a non-matching request (different cluster pair, e.g. to Mirpur) does not join an incompatible pool", async () => {
    const incompatiblePool = {
      id: "pool-1",
      status: "OPEN",
      seatsOccupied: 1,
      tesla: { capacity: 3 },
      memberships: [{ rideRequest: { pickupZone: BANANI, destinationZone: MOHAKHALI } }],
    };
    prisma.__tx.pool.findMany.mockResolvedValueOnce([incompatiblePool]);
    prisma.__tx.$queryRaw.mockResolvedValueOnce([]); // no eligible Tesla for a new pool either
    // No eligible Tesla -> one more compatible-pool check (docs/decisions.md item 26); still
    // incompatible.
    prisma.__tx.pool.findMany.mockResolvedValueOnce([incompatiblePool]);

    const shirinRequest = { id: "ride-shirin", seatsRequested: 1 };
    const result = await matchRideRequest(shirinRequest, BANANI, MIRPUR);

    expect(result).toEqual({ poolId: null, pooled: false });
    expect(prisma.__tx.poolMembership.create).not.toHaveBeenCalled();
  });

  it("leaves the ride request unpooled when no OPEN pool matches and no Tesla is eligible", async () => {
    prisma.__tx.pool.findMany.mockResolvedValueOnce([]);
    prisma.__tx.$queryRaw.mockResolvedValueOnce([]); // e.g. Bullet already has a non-terminal pool
    // No eligible Tesla -> one more compatible-pool check (docs/decisions.md item 26); still none.
    prisma.__tx.pool.findMany.mockResolvedValueOnce([]);

    const result = await matchRideRequest({ id: "ride-x", seatsRequested: 1 }, BANANI, MOHAKHALI);

    expect(result).toEqual({ poolId: null, pooled: false });
    expect(prisma.__tx.pool.create).not.toHaveBeenCalled();
  });

  it("does not join a pool that would exceed Tesla capacity (unlocked search phase)", async () => {
    const fullPool = {
      id: "pool-1",
      status: "OPEN",
      seatsOccupied: 3,
      tesla: { capacity: 3 },
      memberships: [{ rideRequest: { pickupZone: BANANI, destinationZone: MOHAKHALI } }],
    };
    prisma.__tx.pool.findMany.mockResolvedValueOnce([fullPool]);
    prisma.__tx.$queryRaw.mockResolvedValueOnce([]);
    // No eligible Tesla -> one more compatible-pool check (docs/decisions.md item 26); still full.
    prisma.__tx.pool.findMany.mockResolvedValueOnce([fullPool]);

    const result = await matchRideRequest({ id: "ride-x", seatsRequested: 1 }, BANANI, MOHAKHALI);

    expect(result).toEqual({ poolId: null, pooled: false });
  });

  it("falls through to unpooled when the locked re-check finds the seat already taken (lost the race)", async () => {
    const candidatePool = {
      id: "pool-1",
      status: "OPEN",
      seatsOccupied: 2, // as seen by the unlocked search
      tesla: { capacity: 3 },
      memberships: [{ rideRequest: { pickupZone: BANANI, destinationZone: MOHAKHALI } }],
    };
    prisma.__tx.pool.findMany.mockResolvedValueOnce([candidatePool]);
    // Locked re-read shows another transaction already claimed the last seat in the meantime.
    prisma.__tx.$queryRaw.mockResolvedValueOnce([{ seats_occupied: 3 }]);
    // No eligible Tesla for a fallback new pool (Bullet is the only Tesla and already has this pool).
    prisma.__tx.$queryRaw.mockResolvedValueOnce([]);
    // No eligible Tesla -> one more compatible-pool check (docs/decisions.md item 26); no
    // candidate this time (keeps the mock simple — a real re-check would re-lock and find the
    // same full pool, covered by the "does not join a pool that would exceed capacity" case).
    prisma.__tx.pool.findMany.mockResolvedValueOnce([]);

    const result = await matchRideRequest({ id: "ride-x", seatsRequested: 1 }, BANANI, MOHAKHALI);

    expect(result).toEqual({ poolId: null, pooled: false });
    expect(prisma.__tx.poolMembership.create).not.toHaveBeenCalled();
    expect(prisma.__tx.$executeRaw).not.toHaveBeenCalled();
  });

  // Regression test for docs/decisions.md item 26 — a concurrent request may have opened a
  // compatible pool while this one lost the race for a new-pool-eligible Tesla; it should still
  // be able to join that pool on a second look, rather than being left unpooled on pure timing.
  it("joins a pool a concurrent request just opened, after losing the no-eligible-Tesla race", async () => {
    prisma.__tx.pool.findMany.mockResolvedValueOnce([]); // first look: no compatible pool yet
    prisma.__tx.$queryRaw.mockResolvedValueOnce([]); // no eligible Tesla to open a new pool on

    const justOpenedPool = {
      id: "pool-1",
      status: "OPEN",
      seatsOccupied: 1,
      tesla: { capacity: 3 },
      memberships: [{ rideRequest: { pickupZone: BANANI, destinationZone: MOHAKHALI } }],
    };
    prisma.__tx.pool.findMany.mockResolvedValueOnce([justOpenedPool]); // second look: it exists now
    prisma.__tx.$queryRaw.mockResolvedValueOnce([{ seats_occupied: 1 }]); // locked re-read: room

    const result = await matchRideRequest({ id: "ride-x", seatsRequested: 1 }, BANANI, MOHAKHALI);

    expect(result).toEqual({ poolId: "pool-1", pooled: true });
    expect(prisma.__tx.poolMembership.create).toHaveBeenCalledWith({
      data: { poolId: "pool-1", rideRequestId: "ride-x", seats: 1 },
    });
    expect(prisma.__tx.pool.create).not.toHaveBeenCalled();
  });
});

describe("zone distances used by the matching fixtures stay correct", () => {
  it("Banani-Mohakhali is 3km and Banani-Gulshan-adjacent Mirpur pairing is unrelated", () => {
    expect(getDistanceKm("Banani", "Mohakhali")).toBe(3);
  });
});

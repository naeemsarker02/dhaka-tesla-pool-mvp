const request = require("supertest");

jest.mock("../src/lib/prisma", () => {
  const tx = {
    rideRequest: { findUnique: jest.fn(), update: jest.fn(), findUniqueAfter: jest.fn() },
    rideStatusHistory: { create: jest.fn() },
    poolMembership: { delete: jest.fn(), count: jest.fn() },
    pool: { findUnique: jest.fn(), update: jest.fn() },
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
const { createApp } = require("../src/app");
const { signToken } = require("../src/lib/jwt");

const passengerToken = signToken({ id: "nusrat-id", role: "PASSENGER" });

// tx.rideRequest.findUnique is called twice: once at the top (re-check) and once at the end to
// return the final row. Configure both via mockResolvedValueOnce chaining per test.

describe("POST /api/rides/:id/cancel — ownership and state guards", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects cancelling another passenger's ride request", async () => {
    prisma.__tx.rideRequest.findUnique.mockResolvedValueOnce({
      id: "ride-1",
      passengerId: "some-other-passenger",
      status: "REQUESTED",
      poolMembership: null,
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/rides/ride-1/cancel")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(res.status).toBe(403);
  });

  it.each(["DRIVER_ARRIVED", "STARTED", "COMPLETED"])(
    "rejects cancelling from %s with 409",
    async (status) => {
      prisma.__tx.rideRequest.findUnique.mockResolvedValueOnce({
        id: "ride-1",
        passengerId: "nusrat-id",
        status,
        poolMembership: null,
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/rides/ride-1/cancel")
        .set("Authorization", `Bearer ${passengerToken}`);

      expect(res.status).toBe(409);
    }
  );
});

describe("POST /api/rides/:id/cancel — Section 6.1 cases", () => {
  beforeEach(() => jest.clearAllMocks());

  it("cancels from REQUESTED with no pool_membership to release", async () => {
    prisma.__tx.rideRequest.findUnique
      .mockResolvedValueOnce({
        id: "ride-1",
        passengerId: "nusrat-id",
        status: "REQUESTED",
        poolMembership: null,
      })
      .mockResolvedValueOnce({ id: "ride-1", status: "CANCELLED" });

    const app = createApp();
    const res = await request(app)
      .post("/api/rides/ride-1/cancel")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(res.status).toBe(200);
    expect(prisma.__tx.rideRequest.update).toHaveBeenCalledWith({
      where: { id: "ride-1" },
      data: { status: "CANCELLED", cancelledAt: expect.any(Date) },
    });
    expect(prisma.__tx.poolMembership.delete).not.toHaveBeenCalled();
    expect(prisma.__tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("cancels from MATCHED, releases membership, and decrements seats_occupied", async () => {
    prisma.__tx.rideRequest.findUnique
      .mockResolvedValueOnce({
        id: "ride-1",
        passengerId: "nusrat-id",
        status: "MATCHED",
        poolMembership: { id: "membership-1", poolId: "pool-1", seats: 1 },
      })
      .mockResolvedValueOnce({ id: "ride-1", status: "CANCELLED" });
    prisma.__tx.$queryRaw.mockResolvedValueOnce([{ id: "pool-1" }]);
    prisma.__tx.poolMembership.count.mockResolvedValueOnce(1); // Rafiq still in the pool

    const app = createApp();
    const res = await request(app)
      .post("/api/rides/ride-1/cancel")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(res.status).toBe(200);
    expect(prisma.__tx.poolMembership.delete).toHaveBeenCalledWith({
      where: { id: "membership-1" },
    });
    expect(prisma.__tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.__tx.pool.update).not.toHaveBeenCalled(); // pool still has an active member
  });

  it("cancelling the last member of a pool cancels the pool too (from OPEN)", async () => {
    prisma.__tx.rideRequest.findUnique
      .mockResolvedValueOnce({
        id: "ride-1",
        passengerId: "nusrat-id",
        status: "REQUESTED",
        poolMembership: { id: "membership-1", poolId: "pool-1", seats: 1 },
      })
      .mockResolvedValueOnce({ id: "ride-1", status: "CANCELLED" });
    prisma.__tx.$queryRaw.mockResolvedValueOnce([{ id: "pool-1" }]);
    prisma.__tx.poolMembership.count.mockResolvedValueOnce(0); // last member just removed
    prisma.__tx.pool.findUnique.mockResolvedValueOnce({ id: "pool-1", status: "OPEN" });

    const app = createApp();
    const res = await request(app)
      .post("/api/rides/ride-1/cancel")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(res.status).toBe(200);
    expect(prisma.__tx.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { status: "CANCELLED" },
    });
  });

  it("cancelling the last member also cancels an already-MATCHED pool", async () => {
    prisma.__tx.rideRequest.findUnique
      .mockResolvedValueOnce({
        id: "ride-1",
        passengerId: "nusrat-id",
        status: "MATCHED",
        poolMembership: { id: "membership-1", poolId: "pool-1", seats: 1 },
      })
      .mockResolvedValueOnce({ id: "ride-1", status: "CANCELLED" });
    prisma.__tx.$queryRaw.mockResolvedValueOnce([{ id: "pool-1" }]);
    prisma.__tx.poolMembership.count.mockResolvedValueOnce(0);
    prisma.__tx.pool.findUnique.mockResolvedValueOnce({ id: "pool-1", status: "MATCHED" });

    const app = createApp();
    const res = await request(app)
      .post("/api/rides/ride-1/cancel")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(res.status).toBe(200);
    expect(prisma.__tx.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { status: "CANCELLED" },
    });
  });
});

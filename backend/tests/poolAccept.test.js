const request = require("supertest");

jest.mock("../src/lib/prisma", () => {
  const tx = {
    poolMembership: { findMany: jest.fn() },
    rideRequest: { update: jest.fn() },
    rideStatusHistory: { create: jest.fn() },
    pool: { update: jest.fn() },
  };
  return {
    prisma: {
      pool: { findUnique: jest.fn() },
      $transaction: jest.fn((callback) => callback(tx)),
      __tx: tx,
    },
  };
});

const { prisma } = require("../src/lib/prisma");
const { createApp } = require("../src/app");
const { signToken } = require("../src/lib/jwt");

const driverToken = signToken({ id: "jashim-id", role: "DRIVER" });
const passengerToken = signToken({ id: "nusrat-id", role: "PASSENGER" });

const BANANI = { name: "Banani" };
const MOHAKHALI = { name: "Mohakhali" };
const GULSHAN = { name: "Gulshan" };

describe("POST /api/driver/pools/:poolId/accept — guards", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects a passenger-role token", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/driver/pools/pool-1/accept")
      .set("Authorization", `Bearer ${passengerToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects a driver who does not own the pool's Tesla", async () => {
    prisma.pool.findUnique.mockResolvedValue({
      id: "pool-1",
      status: "OPEN",
      tesla: { driverId: "some-other-driver" },
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/driver/pools/pool-1/accept")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects accepting a pool that is not OPEN", async () => {
    prisma.pool.findUnique.mockResolvedValue({
      id: "pool-1",
      status: "MATCHED",
      tesla: { driverId: "jashim-id" },
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/driver/pools/pool-1/accept")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(res.status).toBe(409);
  });
});

describe("POST /api/driver/pools/:poolId/accept — fare finalization (Section 5.2)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("finalizes exact pooled fares for Nusrat (7050) and Rafiq (8550) on a 2-member pool", async () => {
    prisma.pool.findUnique.mockResolvedValue({
      id: "pool-1",
      status: "OPEN",
      tesla: { driverId: "jashim-id" },
    });
    prisma.__tx.poolMembership.findMany.mockResolvedValue([
      {
        rideRequest: {
          id: "ride-nusrat",
          status: "REQUESTED",
          estimatedFarePaisa: 7500,
          pickupZone: BANANI,
          destinationZone: MOHAKHALI,
        },
      },
      {
        rideRequest: {
          id: "ride-rafiq",
          status: "REQUESTED",
          estimatedFarePaisa: 9000,
          pickupZone: BANANI,
          destinationZone: GULSHAN,
        },
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post("/api/driver/pools/pool-1/accept")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(prisma.__tx.rideRequest.update).toHaveBeenCalledWith({
      where: { id: "ride-nusrat" },
      data: { status: "MATCHED", matchedAt: expect.any(Date), farePaisa: 7050 },
    });
    expect(prisma.__tx.rideRequest.update).toHaveBeenCalledWith({
      where: { id: "ride-rafiq" },
      data: { status: "MATCHED", matchedAt: expect.any(Date), farePaisa: 8550 },
    });
    expect(prisma.__tx.rideStatusHistory.create).toHaveBeenCalledTimes(2);
    expect(prisma.__tx.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { status: "MATCHED", matchedAt: expect.any(Date) },
    });
  });

  it("uses estimated_fare_paisa as-is (no discount) for a solo (1-member) pool", async () => {
    prisma.pool.findUnique.mockResolvedValue({
      id: "pool-2",
      status: "OPEN",
      tesla: { driverId: "jashim-id" },
    });
    prisma.__tx.poolMembership.findMany.mockResolvedValue([
      {
        rideRequest: {
          id: "ride-shirin",
          status: "REQUESTED",
          estimatedFarePaisa: 12000,
          pickupZone: BANANI,
          destinationZone: MOHAKHALI,
        },
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post("/api/driver/pools/pool-2/accept")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(prisma.__tx.rideRequest.update).toHaveBeenCalledWith({
      where: { id: "ride-shirin" },
      data: { status: "MATCHED", matchedAt: expect.any(Date), farePaisa: 12000 },
    });
  });
});

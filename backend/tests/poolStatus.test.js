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

function membershipFixture(rideRequestId, status) {
  return {
    rideRequest: { id: rideRequestId, status, pickupZone: {}, destinationZone: {} },
  };
}

describe("PATCH /api/driver/pools/:poolId/status — guards", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects a passenger-role token", async () => {
    const app = createApp();
    const res = await request(app)
      .patch("/api/driver/pools/pool-1/status")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({ status: "DRIVER_ARRIVED" });
    expect(res.status).toBe(403);
  });

  it("rejects an invalid status value", async () => {
    const app = createApp();
    const res = await request(app)
      .patch("/api/driver/pools/pool-1/status")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "OPEN" });
    expect(res.status).toBe(400);
  });

  it("rejects a driver who does not own the pool's Tesla", async () => {
    prisma.pool.findUnique.mockResolvedValue({
      id: "pool-1",
      status: "MATCHED",
      tesla: { driverId: "some-other-driver" },
    });

    const app = createApp();
    const res = await request(app)
      .patch("/api/driver/pools/pool-1/status")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "DRIVER_ARRIVED" });

    expect(res.status).toBe(403);
  });

  it("rejects skipping a stage (e.g. MATCHED -> STARTED, must go through DRIVER_ARRIVED)", async () => {
    prisma.pool.findUnique.mockResolvedValue({
      id: "pool-1",
      status: "MATCHED",
      tesla: { driverId: "jashim-id" },
    });

    const app = createApp();
    const res = await request(app)
      .patch("/api/driver/pools/pool-1/status")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "STARTED" });

    expect(res.status).toBe(409);
  });

  it("rejects advancing a pool that's already COMPLETED", async () => {
    prisma.pool.findUnique.mockResolvedValue({
      id: "pool-1",
      status: "COMPLETED",
      tesla: { driverId: "jashim-id" },
    });

    const app = createApp();
    const res = await request(app)
      .patch("/api/driver/pools/pool-1/status")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "DRIVER_ARRIVED" });

    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/driver/pools/:poolId/status — valid cascade", () => {
  beforeEach(() => jest.clearAllMocks());

  it("MATCHED -> DRIVER_ARRIVED cascades every member and writes history rows", async () => {
    prisma.pool.findUnique.mockResolvedValue({
      id: "pool-1",
      status: "MATCHED",
      tesla: { driverId: "jashim-id" },
    });
    prisma.__tx.poolMembership.findMany.mockResolvedValue([
      membershipFixture("ride-nusrat", "MATCHED"),
      membershipFixture("ride-rafiq", "MATCHED"),
    ]);

    const app = createApp();
    const res = await request(app)
      .patch("/api/driver/pools/pool-1/status")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "DRIVER_ARRIVED" });

    expect(res.status).toBe(200);
    expect(prisma.__tx.rideRequest.update).toHaveBeenCalledWith({
      where: { id: "ride-nusrat" },
      data: { status: "DRIVER_ARRIVED", arrivedAt: expect.any(Date) },
    });
    expect(prisma.__tx.rideRequest.update).toHaveBeenCalledWith({
      where: { id: "ride-rafiq" },
      data: { status: "DRIVER_ARRIVED", arrivedAt: expect.any(Date) },
    });
    expect(prisma.__tx.rideStatusHistory.create).toHaveBeenCalledTimes(2);
    expect(prisma.__tx.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { status: "DRIVER_ARRIVED" },
    });
  });

  it("STARTED -> COMPLETED sets pool.completedAt and cascades completedAt to members", async () => {
    prisma.pool.findUnique.mockResolvedValue({
      id: "pool-1",
      status: "STARTED",
      tesla: { driverId: "jashim-id" },
    });
    prisma.__tx.poolMembership.findMany.mockResolvedValue([membershipFixture("ride-nusrat", "STARTED")]);

    const app = createApp();
    const res = await request(app)
      .patch("/api/driver/pools/pool-1/status")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "COMPLETED" });

    expect(res.status).toBe(200);
    expect(prisma.__tx.rideRequest.update).toHaveBeenCalledWith({
      where: { id: "ride-nusrat" },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
    expect(prisma.__tx.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
  });
});

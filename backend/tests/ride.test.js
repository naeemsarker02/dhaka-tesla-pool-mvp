const request = require("supertest");

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    zone: {
      findUnique: jest.fn(),
    },
    rideRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = require("../src/lib/prisma");
const { createApp } = require("../src/app");
const { signToken } = require("../src/lib/jwt");

const passengerToken = signToken({ id: "nusrat-id", role: "PASSENGER" });
const driverToken = signToken({ id: "jashim-id", role: "DRIVER" });

const BANANI = { id: "11111111-1111-1111-1111-111111111111", name: "Banani", cluster: "Gulshan-Mohakhali corridor" };
const MOHAKHALI = { id: "22222222-2222-2222-2222-222222222222", name: "Mohakhali", cluster: "Gulshan-Mohakhali corridor" };

describe("POST /api/rides — auth/role guards", () => {
  it("rejects with no Authorization header", async () => {
    const app = createApp();
    const res = await request(app).post("/api/rides").send({});
    expect(res.status).toBe(401);
  });

  it("rejects a driver-role token", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ pickupZoneId: BANANI.id, destinationZoneId: MOHAKHALI.id, seatsRequested: 1 });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/rides — validation and fare calculation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a body missing required fields", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({ seatsRequested: 1 });

    expect(res.status).toBe(400);
    expect(prisma.zone.findUnique).not.toHaveBeenCalled();
  });

  it("rejects identical pickup and destination zone ids", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({ pickupZoneId: BANANI.id, destinationZoneId: BANANI.id, seatsRequested: 1 });

    expect(res.status).toBe(400);
    expect(prisma.zone.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a pickupZoneId that does not exist", async () => {
    prisma.zone.findUnique.mockImplementation(({ where }) =>
      where.id === BANANI.id ? Promise.resolve(null) : Promise.resolve(MOHAKHALI)
    );

    const app = createApp();
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({ pickupZoneId: BANANI.id, destinationZoneId: MOHAKHALI.id, seatsRequested: 1 });

    expect(res.status).toBe(400);
    expect(prisma.rideRequest.create).not.toHaveBeenCalled();
  });

  it("creates a ride request with estimated_fare_paisa (no discount) and status REQUESTED", async () => {
    prisma.zone.findUnique.mockImplementation(({ where }) =>
      where.id === BANANI.id ? Promise.resolve(BANANI) : Promise.resolve(MOHAKHALI)
    );
    prisma.rideRequest.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: "ride-1", status: "REQUESTED", farePaisa: null, ...data })
    );

    const app = createApp();
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({ pickupZoneId: BANANI.id, destinationZoneId: MOHAKHALI.id, seatsRequested: 1 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("REQUESTED");
    expect(res.body.farePaisa).toBeNull();
    // Banani -> Mohakhali is 3km per MASTER_PLAN.md Section 5.2 -> 3000 + 3*1500 = 7500, no discount.
    expect(res.body.estimatedFarePaisa).toBe(7500);
    expect(prisma.rideRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passengerId: "nusrat-id", estimatedFarePaisa: 7500 }),
      })
    );
  });
});

describe("GET /api/rides/:id — ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects reading another passenger's ride request", async () => {
    prisma.rideRequest.findUnique.mockResolvedValue({
      id: "ride-1",
      passengerId: "some-other-passenger-id",
      status: "REQUESTED",
    });

    const app = createApp();
    const res = await request(app)
      .get("/api/rides/ride-1")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(res.status).toBe(403);
  });

  it("allows the owning passenger to read their ride request", async () => {
    prisma.rideRequest.findUnique.mockResolvedValue({
      id: "ride-1",
      passengerId: "nusrat-id",
      status: "REQUESTED",
    });

    const app = createApp();
    const res = await request(app)
      .get("/api/rides/ride-1")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("ride-1");
  });
});

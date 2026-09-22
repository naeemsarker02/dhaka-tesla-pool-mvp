const request = require("supertest");

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    tesla: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const { prisma } = require("../src/lib/prisma");
const { createApp } = require("../src/app");
const { signToken } = require("../src/lib/jwt");

const driverToken = signToken({ id: "jashim-id", role: "DRIVER" });
const passengerToken = signToken({ id: "nusrat-id", role: "PASSENGER" });

describe("Tesla routes — auth/role guards", () => {
  it("rejects POST /api/teslas with no Authorization header", async () => {
    const app = createApp();
    const res = await request(app).post("/api/teslas").send({ name: "Bullet", capacity: 3 });

    expect(res.status).toBe(401);
  });

  it("rejects POST /api/teslas with an invalid token", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/teslas")
      .set("Authorization", "Bearer not-a-real-token")
      .send({ name: "Bullet", capacity: 3 });

    expect(res.status).toBe(401);
  });

  it("rejects POST /api/teslas from a passenger-role token", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/teslas")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({ name: "Bullet", capacity: 3 });

    expect(res.status).toBe(403);
  });
});

describe("POST /api/teslas — driver-Tesla uniqueness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers a Tesla for a driver who does not own one yet", async () => {
    prisma.tesla.findUnique.mockResolvedValue(null);
    prisma.tesla.create.mockResolvedValue({
      id: "tesla-1",
      driverId: "jashim-id",
      name: "Bullet",
      capacity: 3,
      status: "OFFLINE",
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/teslas")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ name: "Bullet", capacity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Bullet");
  });

  it("rejects a second Tesla for a driver who already owns one", async () => {
    prisma.tesla.findUnique.mockResolvedValue({
      id: "tesla-1",
      driverId: "jashim-id",
      name: "Bullet",
      capacity: 3,
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/teslas")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ name: "Second Car", capacity: 4 });

    expect(res.status).toBe(409);
    expect(prisma.tesla.create).not.toHaveBeenCalled();
  });

  it("rejects capacity that is not a positive integer", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/teslas")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ name: "Bullet", capacity: 0 });

    expect(res.status).toBe(400);
    expect(prisma.tesla.findUnique).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/teslas/:id/status — ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects toggling a Tesla owned by another driver", async () => {
    prisma.tesla.findUnique.mockResolvedValue({
      id: "tesla-1",
      driverId: "some-other-driver-id",
      status: "OFFLINE",
    });

    const app = createApp();
    const res = await request(app)
      .patch("/api/teslas/tesla-1/status")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "ONLINE" });

    expect(res.status).toBe(403);
    expect(prisma.tesla.update).not.toHaveBeenCalled();
  });

  it("allows the owning driver to toggle online/offline", async () => {
    prisma.tesla.findUnique.mockResolvedValue({
      id: "tesla-1",
      driverId: "jashim-id",
      status: "OFFLINE",
    });
    prisma.tesla.update.mockResolvedValue({
      id: "tesla-1",
      driverId: "jashim-id",
      status: "ONLINE",
    });

    const app = createApp();
    const res = await request(app)
      .patch("/api/teslas/tesla-1/status")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "ONLINE" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ONLINE");
  });
});

describe("GET /api/teslas/me", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the driver's own Tesla", async () => {
    prisma.tesla.findUnique.mockResolvedValue({
      id: "tesla-1",
      driverId: "jashim-id",
      name: "Bullet",
      capacity: 3,
      status: "ONLINE",
    });

    const app = createApp();
    const res = await request(app)
      .get("/api/teslas/me")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Bullet");
  });

  it("returns null when the driver has no Tesla yet", async () => {
    prisma.tesla.findUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .get("/api/teslas/me")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("rejects a passenger-role token", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/teslas/me")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(res.status).toBe(403);
  });
});

const request = require("supertest");

// Mocks the Prisma client wrapper so these run without a live MySQL connection (none is
// available in this sandbox — see docs/PROGRESS.md Phase 2 entry). Exercises real validation,
// hashing, JWT issuance, and error-mapping logic; only the DB round-trip itself is stubbed.
jest.mock("../src/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const bcrypt = require("bcrypt");
const { prisma } = require("../src/lib/prisma");
const { createApp } = require("../src/app");

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a body missing required fields", async () => {
    const app = createApp();
    const res = await request(app).post("/api/auth/signup").send({ email: "nusrat@example.com" });

    expect(res.status).toBe(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an invalid role", async () => {
    const app = createApp();
    const res = await request(app).post("/api/auth/signup").send({
      name: "Nusrat",
      email: "nusrat@example.com",
      password: "password123",
      role: "ADMIN",
      phone: "01700000000",
    });

    expect(res.status).toBe(400);
  });

  it("creates a user and returns a token on valid input", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      name: "Nusrat",
      email: "nusrat@example.com",
      passwordHash: "hashed",
      role: "PASSENGER",
      phone: "01700000000",
    });

    const app = createApp();
    const res = await request(app).post("/api/auth/signup").send({
      name: "Nusrat",
      email: "Nusrat@Example.com",
      password: "password123",
      role: "PASSENGER",
      phone: "01700000000",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: "user-1",
      name: "Nusrat",
      email: "nusrat@example.com",
      role: "PASSENGER",
      phone: "01700000000",
    });
    // password_hash is never returned to the client.
    expect(res.body.user.passwordHash).toBeUndefined();
    // email was normalized to lowercase before hitting the service layer.
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "nusrat@example.com" }) })
    );
  });

  it("rejects signup with an email that is already registered", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });

    const app = createApp();
    const res = await request(app).post("/api/auth/signup").send({
      name: "Nusrat",
      email: "nusrat@example.com",
      password: "password123",
      role: "PASSENGER",
      phone: "01700000000",
    });

    expect(res.status).toBe(409);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs in successfully with correct credentials", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Rafiq",
      email: "rafiq@example.com",
      passwordHash,
      role: "PASSENGER",
      phone: "01700000001",
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "rafiq@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe("rafiq@example.com");
  });

  it("rejects login with the wrong password", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "rafiq@example.com",
      passwordHash,
      role: "PASSENGER",
      phone: "01700000001",
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "rafiq@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("rejects login for a nonexistent user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "password123" });

    expect(res.status).toBe(401);
  });
});

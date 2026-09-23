const request = require("supertest");

// MASTER_PLAN.md Section 13.4/13.5 — regression coverage for the Phase 10 security backfill
// (docs/decisions.md item 23), added during the Phase 10.5 full-plan audit after discovering the
// original backfill had no tests locking any of this in, only a live curl verification.
jest.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}));

const { createApp } = require("../src/app");

describe("Security baseline (Section 13.5) — headers and CORS", () => {
  it("applies helmet security headers to every response", async () => {
    const app = createApp();
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("echoes Access-Control-Allow-Origin for an allowed origin", async () => {
    const app = createApp();
    const res = await request(app).get("/health").set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("omits Access-Control-Allow-Origin for a disallowed origin", async () => {
    const app = createApp();
    const res = await request(app).get("/health").set("Origin", "http://evil.example.com");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("Request correlation (Section 13.4)", () => {
  it("sets X-Request-Id on a successful response", async () => {
    const app = createApp();
    const res = await request(app).get("/health");

    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("includes the same requestId in the response header and the error body", async () => {
    const app = createApp();
    // No Authorization header -> 401 via the centralized errorHandler, no DB call needed.
    const res = await request(app).get("/api/teslas/me");

    expect(res.status).toBe(401);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.requestId).toBe(res.headers["x-request-id"]);
  });

  it("assigns a distinct requestId per request", async () => {
    const app = createApp();
    const [res1, res2] = await Promise.all([
      request(app).get("/health"),
      request(app).get("/health"),
    ]);

    expect(res1.headers["x-request-id"]).not.toBe(res2.headers["x-request-id"]);
  });
});

describe("Rate limiting (Section 13.5) — /api/auth/* only", () => {
  it("returns 429 after the configured limit on /api/auth/login, but not on other routes", async () => {
    const app = createApp();

    let lastStatus;
    for (let i = 0; i < 21; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "wrong" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);

    // A non-auth route is unaffected by the auth-only limiter.
    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
  });
});

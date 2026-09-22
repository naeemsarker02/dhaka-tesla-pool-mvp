// Test-only environment values — never real secrets. Loaded before any test file via
// jest.config.js "setupFiles" so jwt.js has JWT_SECRET available at call time.
//
// Loads .env first (if present) so integration tests (tests/integration/**, run via
// `npm run test:integration`) get the real, developer-configured DATABASE_URL. Unit tests never
// touch the database (Prisma is always mocked), so the fake DATABASE_URL fallback below only
// exists to satisfy Prisma's schema validation at require-time.
require("dotenv").config();

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-production";
process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://test:test@localhost:3306/test";

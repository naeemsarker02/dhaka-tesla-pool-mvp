// Test-only environment values — never real secrets. Loaded before any test file via
// jest.config.js "setupFiles" so jwt.js has JWT_SECRET available at call time.
process.env.JWT_SECRET = "test-secret-do-not-use-in-production";
process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test";

// Integration tests hit a real database — run explicitly via `npm run test:integration`, never
// as part of the default `npm test`. Requires DATABASE_URL to point at a reachable MySQL/MariaDB
// instance (docs/decisions.md item 11).
module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  testMatch: ["<rootDir>/tests/integration/**/*.test.js"],
};

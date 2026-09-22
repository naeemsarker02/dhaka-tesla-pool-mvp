module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  // Integration tests need a real reachable database and run via `npm run test:integration`
  // (jest.integration.config.js) instead — kept out of the default `npm test` run so unit tests
  // stay runnable with no DB available (see docs/decisions.md item 11).
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/tests/integration/"],
};

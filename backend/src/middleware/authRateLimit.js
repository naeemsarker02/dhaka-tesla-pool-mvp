const rateLimit = require("express-rate-limit");

// MASTER_PLAN.md Section 13.5 — applied only to /api/auth/* (login/signup), in-process, no Redis
// store needed at this scale. Bounds naive brute-force attempts against login/signup.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later" },
});

module.exports = { authRateLimiter };

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./routes/auth");
const teslaRoutes = require("./routes/teslas");
const rideRoutes = require("./routes/rides");
const zoneRoutes = require("./routes/zones");
const driverRoutes = require("./routes/driver");
const { errorHandler } = require("./middleware/errorHandler");
const { authRateLimiter } = require("./middleware/authRateLimit");
const { requestContext, requestLogger } = require("./middleware/requestContext");

// MASTER_PLAN.md Section 13.5 — explicit allowlist, never "*". CORS_ORIGIN is a comma-separated
// list (deployed frontend origin(s) + localhost in dev); defaults to the local Next.js dev server.
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function createApp() {
  const app = express();

  app.use(requestContext);
  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRateLimiter, authRoutes);
  app.use("/api/teslas", teslaRoutes);
  app.use("/api/rides", rideRoutes);
  app.use("/api/zones", zoneRoutes);
  app.use("/api/driver", driverRoutes);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

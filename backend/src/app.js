const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const teslaRoutes = require("./routes/teslas");
const { errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/teslas", teslaRoutes);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

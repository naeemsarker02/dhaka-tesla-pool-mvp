const { Router } = require("express");
const rideController = require("../controllers/rideController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { createRideRequestSchema } = require("../validators/ride");

const router = Router();

router.post(
  "/",
  requireAuth,
  requireRole("PASSENGER"),
  validateBody(createRideRequestSchema),
  rideController.create
);

router.get("/", requireAuth, requireRole("PASSENGER"), rideController.list);

router.get("/:id", requireAuth, requireRole("PASSENGER"), rideController.getById);

router.post("/:id/cancel", requireAuth, requireRole("PASSENGER"), rideController.cancel);

module.exports = router;

const { Router } = require("express");
const teslaController = require("../controllers/teslaController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { createTeslaSchema, updateTeslaStatusSchema } = require("../validators/tesla");

const router = Router();

router.post(
  "/",
  requireAuth,
  requireRole("DRIVER"),
  validateBody(createTeslaSchema),
  teslaController.register
);

router.get("/me", requireAuth, requireRole("DRIVER"), teslaController.getMine);

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("DRIVER"),
  validateBody(updateTeslaStatusSchema),
  teslaController.updateStatus
);

module.exports = router;

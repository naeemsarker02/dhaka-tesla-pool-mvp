const { Router } = require("express");
const driverController = require("../controllers/driverController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { updatePoolStatusSchema } = require("../validators/pool");

const router = Router();

router.use(requireAuth, requireRole("DRIVER"));

router.get("/requests", driverController.listOpenPools);
router.post("/pools/:poolId/accept", driverController.acceptPool);
router.patch(
  "/pools/:poolId/status",
  validateBody(updatePoolStatusSchema),
  driverController.advancePoolStatus
);
router.get("/pools/:id", driverController.getPoolById);
router.get("/history", driverController.listHistory);

module.exports = router;

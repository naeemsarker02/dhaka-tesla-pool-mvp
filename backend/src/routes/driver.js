const { Router } = require("express");
const driverController = require("../controllers/driverController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth, requireRole("DRIVER"));

router.get("/requests", driverController.listOpenPools);
router.post("/pools/:poolId/accept", driverController.acceptPool);

module.exports = router;

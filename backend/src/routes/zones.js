const { Router } = require("express");
const zoneController = require("../controllers/zoneController");

const router = Router();

// Public — reference data (zone list + clusters), not user-owned, no auth needed. No dedicated
// service layer: this is a direct passthrough read with zero business logic, unlike the
// auth/tesla/ride endpoints.
router.get("/", zoneController.list);

module.exports = router;

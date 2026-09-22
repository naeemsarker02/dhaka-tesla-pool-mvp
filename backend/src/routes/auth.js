const { Router } = require("express");
const authController = require("../controllers/authController");
const { validateBody } = require("../middleware/validate");
const { signupSchema, loginSchema } = require("../validators/auth");

const router = Router();

router.post("/signup", validateBody(signupSchema), authController.signup);
router.post("/login", validateBody(loginSchema), authController.login);

module.exports = router;

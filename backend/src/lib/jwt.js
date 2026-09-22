const jwt = require("jsonwebtoken");

const EXPIRES_IN = "7d";

// Payload stays minimal per MASTER_PLAN.md Section 1.1 — { sub, role } only, never PII.
function signToken({ id, role }) {
  return jwt.sign({ sub: id, role }, process.env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };

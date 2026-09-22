const { verifyToken } = require("../lib/jwt");
const { UnauthorizedError, ForbiddenError } = require("../lib/errors");

// Verifies the Bearer JWT and attaches { id, role } to req.user. Every non-public route requires
// this per MASTER_PLAN.md Section 7.1.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new UnauthorizedError("Missing or malformed Authorization header"));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (err) {
    return next(new UnauthorizedError("Invalid or expired token"));
  }
}

// Role check only — ownership checks (passenger owns ride_request, driver owns Tesla/pool) are
// separate, done in the service layer, per MASTER_PLAN.md Section 7.1.
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return next(new ForbiddenError(`Requires ${role} role`));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };

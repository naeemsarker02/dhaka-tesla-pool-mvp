const { AppError } = require("../lib/errors");

// Centralized error -> HTTP response mapping. Route handlers/services throw AppError subclasses
// (or let unexpected errors bubble up as 500) instead of building responses inline.
// requestId (Section 13.4) is included on every error response and log line so a failure can be
// traced back to its request via X-Request-Id.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    const body = { error: err.message, requestId: req.id };
    if (err.details) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  console.error(`[${req.id}]`, err);
  return res.status(500).json({ error: "Internal server error", requestId: req.id });
}

module.exports = { errorHandler };

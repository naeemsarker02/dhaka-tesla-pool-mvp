const { AppError } = require("../lib/errors");

// Centralized error -> HTTP response mapping. Route handlers/services throw AppError subclasses
// (or let unexpected errors bubble up as 500) instead of building responses inline.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

module.exports = { errorHandler };

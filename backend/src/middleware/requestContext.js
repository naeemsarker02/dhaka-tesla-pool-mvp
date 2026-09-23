const crypto = require("crypto");

// MASTER_PLAN.md Section 13.4 — every request gets a requestId, echoed in the response header and
// included in every log line for that request, so one request's story can be traced through the
// logs. Plain Express middleware, no logging infrastructure.
function requestContext(req, res, next) {
  req.id = crypto.randomUUID();
  res.set("X-Request-Id", req.id);
  next();
}

function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on("finish", () => {
    // Quiet during the Jest test run (NODE_ENV=test) — the same requestId is still on every
    // response header/error body, so nothing about traceability is lost, just console noise.
    if (process.env.NODE_ENV === "test") return;
    const durationMs = Date.now() - startedAt;
    console.log(`[${req.id}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`);
  });
  next();
}

module.exports = { requestContext, requestLogger };

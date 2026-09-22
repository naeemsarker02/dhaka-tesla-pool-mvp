const { ValidationError } = require("../lib/errors");

// Wraps a Zod schema as Express middleware, validating req.body and replacing it with the
// parsed (typed/defaulted) result. Every external input is validated this way — MASTER_PLAN.md
// Section 8 / CLAUDE.md Engineering Rules.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(new ValidationError("Invalid request body", result.error.flatten()));
    }

    req.body = result.data;
    return next();
  };
}

module.exports = { validateBody };

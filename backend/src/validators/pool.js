const { z } = require("zod");

const updatePoolStatusSchema = z.object({
  status: z.enum(["DRIVER_ARRIVED", "STARTED", "COMPLETED"]),
});

module.exports = { updatePoolStatusSchema };

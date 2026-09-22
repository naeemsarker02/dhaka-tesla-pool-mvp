const { z } = require("zod");

const createTeslaSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  capacity: z.number().int().positive("capacity must be a positive integer"),
});

const updateTeslaStatusSchema = z.object({
  status: z.enum(["ONLINE", "OFFLINE"]),
});

module.exports = { createTeslaSchema, updateTeslaStatusSchema };

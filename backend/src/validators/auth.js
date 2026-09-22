const { z } = require("zod");

const signupSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  email: z.string().trim().toLowerCase().email("invalid email"),
  password: z.string().min(8, "password must be at least 8 characters"),
  role: z.enum(["PASSENGER", "DRIVER"]),
  phone: z.string().trim().min(1, "phone is required"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("invalid email"),
  password: z.string().min(1, "password is required"),
});

module.exports = { signupSchema, loginSchema };

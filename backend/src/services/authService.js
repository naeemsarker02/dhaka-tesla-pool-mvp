const bcrypt = require("bcrypt");
const { prisma } = require("../lib/prisma");
const { signToken } = require("../lib/jwt");
const { ConflictError, UnauthorizedError } = require("../lib/errors");

const SALT_ROUNDS = 10;

async function signup({ name, email, password, role, phone }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError("Email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, phone },
  });

  const token = signToken({ id: user.id, role: user.role });

  return { token, user: toPublicUser(user) };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const token = signToken({ id: user.id, role: user.role });

  return { token, user: toPublicUser(user) };
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
  };
}

module.exports = { signup, login };

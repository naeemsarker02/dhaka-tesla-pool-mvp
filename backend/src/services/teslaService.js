const { Prisma } = require("@prisma/client");
const { prisma } = require("../lib/prisma");
const { ConflictError, ForbiddenError, ValidationError } = require("../lib/errors");

// teslas.driver_id is UNIQUE (docs/erd.md) — one Tesla per driver. The DB constraint is the
// source of truth; this pre-check just gives a clearer 409 than a raw constraint-violation error.
async function registerTesla(driverId, { name, capacity }) {
  const existing = await prisma.tesla.findUnique({ where: { driverId } });
  if (existing) {
    throw new ConflictError("Driver already owns a Tesla");
  }

  try {
    return await prisma.tesla.create({
      data: { driverId, name, capacity },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError("Driver already owns a Tesla");
    }
    throw err;
  }
}

async function setTeslaStatus(driverId, teslaId, status) {
  const tesla = await prisma.tesla.findUnique({ where: { id: teslaId } });

  if (!tesla) {
    throw new ValidationError("Tesla not found");
  }

  if (tesla.driverId !== driverId) {
    throw new ForbiddenError("You do not own this Tesla");
  }

  return prisma.tesla.update({ where: { id: teslaId }, data: { status } });
}

// GET /api/teslas/me — not in MASTER_PLAN.md Section 7's table; added so the driver frontend can
// discover its own Tesla (id + online/offline status) without a hardcoded id (docs/decisions.md
// item 19). Returns null rather than 404 when the driver hasn't registered a Tesla yet — that's a
// valid state, not an error.
async function getMyTesla(driverId) {
  return prisma.tesla.findUnique({ where: { driverId } });
}

module.exports = { registerTesla, setTeslaStatus, getMyTesla };

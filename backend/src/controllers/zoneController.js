const { prisma } = require("../lib/prisma");

async function list(req, res, next) {
  try {
    const zones = await prisma.zone.findMany({ orderBy: { name: "asc" } });
    res.status(200).json(zones);
  } catch (err) {
    next(err);
  }
}

module.exports = { list };

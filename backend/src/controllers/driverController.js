const poolService = require("../services/poolService");

async function listOpenPools(req, res, next) {
  try {
    const pools = await poolService.listOpenPoolsForDriver(req.user.id);
    res.status(200).json(pools);
  } catch (err) {
    next(err);
  }
}

async function acceptPool(req, res, next) {
  try {
    const pool = await poolService.acceptPool(req.user.id, req.params.poolId);
    res.status(200).json(pool);
  } catch (err) {
    next(err);
  }
}

module.exports = { listOpenPools, acceptPool };

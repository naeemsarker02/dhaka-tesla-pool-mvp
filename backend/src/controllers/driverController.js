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

async function advancePoolStatus(req, res, next) {
  try {
    const pool = await poolService.advancePoolStatus(req.user.id, req.params.poolId, req.body.status);
    res.status(200).json(pool);
  } catch (err) {
    next(err);
  }
}

async function getPoolById(req, res, next) {
  try {
    const pool = await poolService.getPoolById(req.user.id, req.params.id);
    res.status(200).json(pool);
  } catch (err) {
    next(err);
  }
}

async function listHistory(req, res, next) {
  try {
    const pools = await poolService.listPoolHistoryForDriver(req.user.id);
    res.status(200).json(pools);
  } catch (err) {
    next(err);
  }
}

module.exports = { listOpenPools, acceptPool, advancePoolStatus, getPoolById, listHistory };

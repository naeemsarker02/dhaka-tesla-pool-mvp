const teslaService = require("../services/teslaService");

async function register(req, res, next) {
  try {
    const tesla = await teslaService.registerTesla(req.user.id, req.body);
    res.status(201).json(tesla);
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const tesla = await teslaService.setTeslaStatus(req.user.id, req.params.id, req.body.status);
    res.status(200).json(tesla);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, updateStatus };

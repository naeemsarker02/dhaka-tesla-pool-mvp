const rideService = require("../services/rideService");

async function create(req, res, next) {
  try {
    const idempotencyKey = req.get("Idempotency-Key") || undefined;
    const rideRequest = await rideService.createRideRequest(req.user.id, req.body, idempotencyKey);
    res.status(201).json(rideRequest);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const rideRequest = await rideService.getRideRequestById(req.user.id, req.params.id);
    res.status(200).json(rideRequest);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const rideRequests = await rideService.listRideRequestsForPassenger(req.user.id);
    res.status(200).json(rideRequests);
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const rideRequest = await rideService.cancelRideRequest(req.user.id, req.params.id);
    res.status(200).json(rideRequest);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getById, list, cancel };

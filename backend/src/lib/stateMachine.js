// Two separate state machines — never conflated (MASTER_PLAN.md Section 3.2 / CLAUDE.md). Shared
// here only because their transition *shapes* happen to be identical; they represent different
// entities and are validated independently wherever they're used.

const POOL_TRANSITIONS = {
  OPEN: ["MATCHED", "CANCELLED"],
  MATCHED: ["DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVED: ["STARTED"],
  STARTED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

const RIDE_REQUEST_TRANSITIONS = {
  REQUESTED: ["MATCHED", "CANCELLED"],
  MATCHED: ["DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVED: ["STARTED"],
  STARTED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

function canTransition(transitions, from, to) {
  return (transitions[from] || []).includes(to);
}

module.exports = { POOL_TRANSITIONS, RIDE_REQUEST_TRANSITIONS, canTransition };

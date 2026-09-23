// Single source of truth for status → color across the whole app (ride status, pool status,
// Tesla online/offline) — Part 2 of the frontend polish pass asked for a consistent, meaningful
// color system: cool neutral for REQUESTED/OPEN, blue for MATCHED, amber for DRIVER_ARRIVED,
// green family for STARTED/COMPLETED, red for CANCELLED.
export const STATUS_STYLES = {
  REQUESTED: { badge: "bg-slate-100 text-slate-700 ring-slate-600/10", dot: "bg-slate-400", label: "Requested" },
  OPEN: { badge: "bg-slate-100 text-slate-700 ring-slate-600/10", dot: "bg-slate-400", label: "Open" },
  MATCHED: { badge: "bg-blue-50 text-blue-700 ring-blue-700/10", dot: "bg-blue-500", label: "Matched" },
  DRIVER_ARRIVED: { badge: "bg-amber-50 text-amber-800 ring-amber-700/10", dot: "bg-amber-500", label: "Driver arrived" },
  STARTED: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-700/10", dot: "bg-emerald-500", label: "In progress" },
  COMPLETED: { badge: "bg-green-50 text-green-700 ring-green-700/10", dot: "bg-green-600", label: "Completed" },
  CANCELLED: { badge: "bg-red-50 text-red-700 ring-red-700/10", dot: "bg-red-500", label: "Cancelled" },
  ONLINE: { badge: "bg-green-50 text-green-700 ring-green-700/10", dot: "bg-green-600", label: "Online" },
  OFFLINE: { badge: "bg-slate-100 text-slate-600 ring-slate-600/10", dot: "bg-slate-400", label: "Offline" },
};

export const DEFAULT_STATUS_STYLE = {
  badge: "bg-slate-100 text-slate-600 ring-slate-600/10",
  dot: "bg-slate-400",
  label: "Unknown",
};

export function statusStyle(status) {
  return STATUS_STYLES[status] || DEFAULT_STATUS_STYLE;
}

// The linear happy-path order for the passenger/pool stepper. CANCELLED is deliberately excluded
// — it's a terminal branch from REQUESTED or MATCHED, not a step in the linear sequence, and is
// rendered as a distinct banner instead (see StatusStepper).
export const LIFECYCLE_STEPS = ["REQUESTED", "MATCHED", "DRIVER_ARRIVED", "STARTED", "COMPLETED"];

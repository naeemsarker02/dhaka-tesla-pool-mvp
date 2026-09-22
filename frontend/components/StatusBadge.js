const COLORS = {
  REQUESTED: "bg-amber-100 text-amber-800",
  MATCHED: "bg-blue-100 text-blue-800",
  DRIVER_ARRIVED: "bg-indigo-100 text-indigo-800",
  STARTED: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-slate-200 text-slate-600",
  OPEN: "bg-amber-100 text-amber-800",
  ONLINE: "bg-green-100 text-green-800",
  OFFLINE: "bg-slate-200 text-slate-600",
};

export function StatusBadge({ status }) {
  const className = COLORS[status] || "bg-slate-200 text-slate-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}

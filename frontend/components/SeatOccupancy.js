// Visual seat-occupancy indicator (filled vs. empty seat dots) instead of plain "2/3" text —
// driver dashboard, Part 2 of the frontend polish pass.
export function SeatOccupancy({ occupied, capacity }) {
  const seats = Array.from({ length: capacity }, (_, i) => i < occupied);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" role="img" aria-label={`${occupied} of ${capacity} seats occupied`}>
        {seats.map((filled, i) => (
          <svg
            key={i}
            viewBox="0 0 20 20"
            className={`h-5 w-5 ${filled ? "text-slate-900" : "text-slate-200"}`}
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10 2a3 3 0 0 1 3 3v3.17A3 3 0 0 1 15 11v3a1 1 0 0 1-1 1h-1v2a1 1 0 1 1-2 0v-2H9v2a1 1 0 1 1-2 0v-2H6a1 1 0 0 1-1-1v-3a3 3 0 0 1 2-2.83V5a3 3 0 0 1 3-3Z" />
          </svg>
        ))}
      </div>
      <span className="text-sm font-medium text-slate-600">
        {occupied}/{capacity} seats
      </span>
    </div>
  );
}

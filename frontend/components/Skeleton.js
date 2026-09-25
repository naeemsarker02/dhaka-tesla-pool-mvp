// Styled loading skeletons — replaces bare "Loading…" text across every page, per the brief's
// "clear loading/error/empty states" scoring criterion.
export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 h-4 w-1/3 rounded bg-slate-200" />
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="h-3 rounded bg-slate-100" style={{ width: `${85 - i * 15}%` }} />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

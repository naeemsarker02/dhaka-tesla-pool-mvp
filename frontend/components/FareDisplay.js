import { formatPaisa } from "../lib/format";

// Makes the pooling discount visible — "it's the actual product story" (Part 2 brief). The API
// doesn't return how many other riders shared the pool, but the discount is only ever applied
// when 2+ riders share a pool (Section 5.1 — a solo pool keeps estimatedFarePaisa as-is), so
// estimatedFarePaisa > farePaisa is itself a reliable, backend-verified signal that pooling
// happened — no new endpoint needed for this display-only inference.
export function FareDisplay({ estimatedFarePaisa, farePaisa }) {
  if (farePaisa === null || farePaisa === undefined) {
    return (
      <div>
        <p className="text-2xl font-semibold text-slate-900">{formatPaisa(estimatedFarePaisa)}</p>
        <p className="text-xs text-slate-500">Estimated — finalized once a driver accepts your pool</p>
      </div>
    );
  }

  const savedPaisa = estimatedFarePaisa - farePaisa;
  const wasPooled = savedPaisa > 0;

  return (
    <div>
      {wasPooled ? (
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-slate-400 line-through">{formatPaisa(estimatedFarePaisa)}</span>
          <span className="text-2xl font-semibold text-slate-900">{formatPaisa(farePaisa)}</span>
        </div>
      ) : (
        <p className="text-2xl font-semibold text-slate-900">{formatPaisa(farePaisa)}</p>
      )}
      {wasPooled ? (
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-green-700">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M6.267 3.455a3.066 3.066 0 0 0 1.745-.723 3.066 3.066 0 0 1 3.976 0 3.066 3.066 0 0 0 1.745.723 3.066 3.066 0 0 1 2.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 0 1 0 3.976 3.066 3.066 0 0 0-.723 1.745 3.066 3.066 0 0 1-2.812 2.812 3.066 3.066 0 0 0-1.745.723 3.066 3.066 0 0 1-3.976 0 3.066 3.066 0 0 0-1.745-.723 3.066 3.066 0 0 1-2.812-2.812 3.066 3.066 0 0 0-.723-1.745 3.066 3.066 0 0 1 0-3.976 3.066 3.066 0 0 0 .723-1.745 3.066 3.066 0 0 1 2.812-2.812Zm7.44 5.252a.75.75 0 0 0-1.214-.882l-2.474 3.393-1.28-1.281a.75.75 0 0 0-1.06 1.06l1.884 1.885a.75.75 0 0 0 1.137-.089l3.007-4.086Z"
              clipRule="evenodd"
            />
          </svg>
          Pooled with another rider — saved {formatPaisa(savedPaisa)}
        </p>
      ) : (
        <p className="mt-0.5 text-xs text-slate-500">Rode solo — no pool discount this trip</p>
      )}
    </div>
  );
}

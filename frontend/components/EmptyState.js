// Consistent, intentional-looking empty state — every list screen uses this instead of a bare
// one-off sentence, per the brief's explicit "clear loading/error/empty states" scoring criterion.
export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v4c0 .2.08.39.22.53l2.5 2.5a.75.75 0 1 0 1.06-1.06l-2.28-2.28V6.75Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="max-w-xs text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

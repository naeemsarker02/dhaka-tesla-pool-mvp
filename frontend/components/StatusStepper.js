import { LIFECYCLE_STEPS, statusStyle } from "../lib/statusStyles";

// Visual progress stepper through REQUESTED -> MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED.
// CANCELLED is a terminal branch from REQUESTED or MATCHED, not a step in this linear sequence —
// rendered as a distinct banner instead of forced into the stepper.
export function StatusStepper({ status }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-700/10">
        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
        Cancelled
      </div>
    );
  }

  const currentIndex = LIFECYCLE_STEPS.indexOf(status);
  const currentLabel = statusStyle(status).label;

  return (
    <div>
      <ol className="flex items-center" aria-label="Trip progress">
      {LIFECYCLE_STEPS.map((step, index) => {
        const isComplete = currentIndex >= 0 && index < currentIndex;
        const isCurrent = index === currentIndex;
        const style = statusStyle(step);
        const isLast = index === LIFECYCLE_STEPS.length - 1;

        return (
          <li key={step} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ${
                  isComplete
                    ? "bg-slate-900 text-white ring-slate-900"
                    : isCurrent
                      ? `${style.badge} ring-current`
                      : "bg-white text-slate-400 ring-slate-200"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isComplete ? "✓" : index + 1}
              </div>
              <span
                className={`hidden text-center text-[11px] leading-tight sm:block ${
                  isCurrent ? "font-semibold text-slate-900" : "text-slate-500"
                }`}
                style={{ maxWidth: "5rem" }}
              >
                {style.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-1.5 h-0.5 flex-1 rounded ${isComplete ? "bg-slate-900" : "bg-slate-200"}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
      </ol>
      {/* Per-step labels are hidden below sm (5 labels don't fit a phone width) — this single
          current-step caption is the mobile replacement, so a phone user isn't left with only
          bare numbered circles and no indication of what step 2 of 5 actually means. */}
      <p className="mt-2 text-center text-xs font-medium text-slate-600 sm:hidden">
        Step {currentIndex + 1} of {LIFECYCLE_STEPS.length}: {currentLabel}
      </p>
    </div>
  );
}

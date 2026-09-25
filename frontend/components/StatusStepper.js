import { LIFECYCLE_STEPS, statusStyle } from "../lib/statusStyles";

// Visual progress stepper through REQUESTED -> MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED.
// Shared by both the passenger's ride view and the driver's pool view (StatusStepper takes a
// plain `status` string either way) so the two use the same visual language for the same concept.
// CANCELLED is a terminal branch from REQUESTED or MATCHED, not a step in this linear sequence —
// rendered as a distinct banner instead of forced into the stepper, so it never looks like a
// progress bar that just stopped partway.
export function StatusStepper({ status }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-700/20">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"
          aria-hidden="true"
        >
          ✕
        </span>
        <span>
          Cancelled
          <span className="block text-xs font-normal text-red-600/80">
            This trip won&apos;t continue past this point.
          </span>
        </span>
      </div>
    );
  }

  const currentIndex = LIFECYCLE_STEPS.indexOf(status);
  const currentLabel = statusStyle(status).label;

  return (
    <div>
      <ol className="flex items-start" aria-label="Trip progress">
      {LIFECYCLE_STEPS.map((step, index) => {
        const isComplete = currentIndex >= 0 && index < currentIndex;
        const isCurrent = index === currentIndex;
        const style = statusStyle(step);
        const isLast = index === LIFECYCLE_STEPS.length - 1;

        return (
          <li key={step} className={`flex flex-col items-center ${isLast ? "" : "flex-1"}`}>
            {/* Circle and connecting line share one row so the line centers on the circle,
                independent of the label's height below it. */}
            <div className="flex w-full items-center">
              <div
                className={`flex shrink-0 items-center justify-center rounded-full transition-all ${
                  isCurrent
                    ? `h-9 w-9 text-sm font-bold ring-4 ring-offset-2 ${style.badge} ring-current/30`
                    : "h-7 w-7 text-xs font-semibold ring-2"
                } ${
                  isComplete
                    ? "bg-slate-900 text-white ring-slate-900"
                    : isCurrent
                      ? ""
                      : "bg-white text-slate-400 ring-slate-200"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isComplete ? "✓" : isCurrent ? "●" : index + 1}
              </div>
              {!isLast && (
                <div
                  className={`mx-1.5 h-0.5 flex-1 rounded ${isComplete ? "bg-slate-900" : "bg-slate-200"}`}
                  aria-hidden="true"
                />
              )}
            </div>
            <span
              className={`hidden text-center leading-tight sm:block ${
                isCurrent ? "text-xs font-bold text-slate-900" : "text-[11px] text-slate-500"
              }`}
              style={{ maxWidth: "5rem", marginTop: "0.375rem" }}
            >
              {style.label}
            </span>
          </li>
        );
      })}
      </ol>
      {/* Per-step labels are hidden below sm (5 labels don't fit a phone width) — this single
          current-step caption is the mobile replacement, so a phone user isn't left with only
          bare numbered circles and no indication of what step 2 of 5 actually means. */}
      <p className="mt-2 text-center text-xs font-semibold text-slate-700 sm:hidden">
        Step {currentIndex + 1} of {LIFECYCLE_STEPS.length}: {currentLabel}
      </p>
    </div>
  );
}

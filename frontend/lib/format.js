// paisa is always an integer (docs/fare-model.md) — never do float math here, only display
// formatting on an already-computed integer.
export function formatPaisa(paisa) {
  if (paisa === null || paisa === undefined) return "—";
  const taka = Math.floor(paisa / 100);
  const remainder = paisa % 100;
  return `৳${taka}.${String(remainder).padStart(2, "0")}`;
}

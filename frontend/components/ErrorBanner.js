export function ErrorBanner({ children }) {
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-700/10"
    >
      {children}
    </p>
  );
}

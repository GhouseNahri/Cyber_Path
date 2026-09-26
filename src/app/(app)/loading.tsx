/**
 * Route-level loading UI for the whole (app) group. Server Components can't
 * stream their shell earlier — every protected page awaits Supabase reads —
 * so this skeleton is what the user sees between navigation and render.
 * Uses the existing `skeleton` shimmer utility; pure CSS, no JS.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Header block */}
      <div className="space-y-2">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-8 w-72 max-w-full" />
      </div>

      {/* Card rows */}
      <div className="space-y-4">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="skeleton h-44" />
          <div className="skeleton h-44" />
        </div>
      </div>
    </div>
  );
}

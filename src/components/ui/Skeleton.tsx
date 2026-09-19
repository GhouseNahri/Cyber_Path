/** Skeleton primitives for loading states (paired with app/route loaders). */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 rounded-md ${className}`} aria-hidden="true" />;
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />;
}

/** Dashboard skeleton — mirrors the dashboard grid so layout doesn't jump. */
export function DashboardSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-[92px]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonBlock className="h-64 lg:col-span-2" />
        <SkeletonBlock className="h-64" />
      </div>
      <SkeletonBlock className="h-40" />
    </div>
  );
}

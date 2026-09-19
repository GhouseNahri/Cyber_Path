import { DashboardSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="skeleton h-8 w-64 rounded-lg" />
      <DashboardSkeleton />
    </div>
  );
}

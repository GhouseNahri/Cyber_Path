import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, buttonClasses } from "@/components/ui";
import { getMissionState } from "@/lib/session/queries";
import { getProfile } from "@/lib/profile";
import { TaskRunner } from "./TaskRunner";

export const metadata = { title: "Session" };

export default async function SessionPage() {
  const profile = await getProfile();
  const [missionState] = await Promise.all([getMissionState()]);

  return (
    <div className="space-y-6">
      <section aria-labelledby="session-heading">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">
          Daily session
        </p>
        <h1 id="session-heading" className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Today&apos;s <span className="text-gradient">mission</span>
        </h1>
      </section>

      {!missionState.ok ? (
        <Card>
          <CardHeader title="Can't load today's mission" subtitle="Database migrations not applied yet" />
          <EmptyState
            title="Migrations 0003 and 0006 aren't run yet"
            body="Today's mission is generated from your real roadmap. Run the SQL files (0003, 0006) in the Supabase SQL Editor and reload."
          />
        </Card>
      ) : (
        <>
          <TaskRunner
            mission={missionState.mission}
            session={missionState.session}
            goalMinutes={profile?.daily_goal_minutes ?? 45}
          />
          <p className="text-[13px] text-ink-medium">
            New tasks land at local midnight in {profile?.timezone ?? "UTC"} — your day, your clock.
          </p>
        </>
      )}
    </div>
  );
}

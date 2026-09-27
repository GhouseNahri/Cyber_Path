import type { Metadata } from "next";
import { Card, CardHeader, EmptyState, ProgressBar, StatCard } from "@/components/ui";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { getStreakData } from "@/lib/streak/queries";
import { getRevisionQueue } from "@/lib/revision/queries";
import { getStudyTotals } from "@/lib/session/queries";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { deriveAchievements } from "@/lib/ai/achievements";

export const metadata: Metadata = { title: "Achievements" };

/** Derived milestones — computed per request from the same cached queries the
 *  dashboard uses (request-deduped), so achievements never drift from reality. */
export default async function AchievementsPage() {
  const profile = await getProfile();
  if (!profile) {
    return <EmptyState title="Sign in required" body="Achievements appear once you start learning." />;
  }

  const supabase = await createClient();
  const [overview, streak, revision, totals, quizPassRes, projectsRes] = await Promise.all([
    getRoadmapOverview(),
    getStreakData(),
    getRevisionQueue(),
    getStudyTotals(),
    supabase.from("quiz_attempts").select("passed").eq("user_id", profile.id).eq("passed", true),
    supabase.from("user_projects").select("status").eq("user_id", profile.id).in("status", ["completed", "published"]),
  ]);

  const totalTopics = overview.ok ? overview.totals.topics : 0;
  const completedTopics = overview.ok ? overview.totals.completed : 0;

  const achievements = deriveAchievements({
    completedTopics,
    totalTopics,
    currentStreak: streak.ok ? streak.streak.current : 0,
    longestStreak: streak.ok ? streak.streak.longest : 0,
    projectsCompleted: (projectsRes.data ?? []).length,
    quizPasses: (quizPassRes.data ?? []).length,
    revisionGraduates: revision.ok ? revision.graduatedCount : 0,
    firstSessionLogged: (totals?.sessions ?? 0) > 0,
  });

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Milestones</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Achievements</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          Earned automatically from real learning activity — no busywork badges.
        </p>
      </section>

      <section aria-label="Achievement summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Earned" value={`${earnedCount}/${achievements.length}`} hint="Milestones reached" tone="accent" />
        <StatCard label="Topics" value={`${completedTopics}/${totalTopics}`} hint="Roadmap completed" />
        <StatCard
          label="Streak"
          value={streak.ok ? `${streak.streak.longest}d` : "—"}
          hint={streak.ok ? "Personal best" : "Starts with your first session"}
        />
        <StatCard label="Projects" value={String((projectsRes.data ?? []).length)} hint="Completed or published" />
      </section>

      <section aria-label="Milestone list" className="grid gap-4 md:grid-cols-2">
        {achievements.map((a) => (
          <Card key={a.id} className={a.earned ? "border-accent/30" : undefined}>
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className={`text-3xl ${a.earned ? "" : "opacity-40 grayscale"}`}>
                {a.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-[15px] font-semibold text-ink-high">{a.title}</p>
                  {a.earned ? (
                    <span className="font-mono text-[11px] text-ok">earned</span>
                  ) : a.progressPct != null ? (
                    <span className="font-mono text-[11px] text-ink-low">{a.progressPct}%</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-medium">{a.description}</p>
                {!a.earned && a.progressPct != null && a.progressPct > 0 ? (
                  <div className="mt-2">
                    <ProgressBar value={a.progressPct} label={`${a.title} progress`} size="sm" />
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}

import Link from "next/link";
import { Card, CardHeader, Badge, StatCard, ProgressRing, EmptyState, buttonClasses } from "@/components/ui";
import { timeGreeting, formatToday } from "@/lib/greeting";

export default function DashboardPage() {
  // Phase 1: no profile in the database yet (Phase 2/3) — greeting stays
  // generic and all metrics are honest zeros. Nothing here is simulated.
  const name: string | null = null;
  const greeting = timeGreeting();
  const today = formatToday();

  return (
    <div className="space-y-6">
      {/* ── Welcome ─────────────────────────────────────────────────── */}
      <section className="animate-rise" aria-labelledby="welcome-heading">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">{today}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <h1 id="welcome-heading" className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting}{name ? `, ${name}` : ""}. <span className="text-gradient">What are we learning today?</span>
          </h1>
          <div className="flex items-center gap-2">
            <Badge tone="accent">Phase 1 · Foundation</Badge>
          </div>
        </div>
      </section>

      {/* ── Stat strip (honest zeros until data exists) ─────────────── */}
      <section aria-label="Learning metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Streak" value="0 days" hint="Starts with your first session" tone="accent" />
        <StatCard label="Study time" value="0h 0m" hint="Logged study time" />
        <StatCard label="Labs" value="0" hint="Completed labs" />
        <StatCard label="Projects" value="0" hint="Completed projects" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Today's mission ───────────────────────────────────────── */}
        <Card className="lg:col-span-2" glow>
          <CardHeader
            title="Today's mission"
            subtitle="Daily tasks generated from your roadmap position and available time"
            action={<Badge tone="neutral">Arrives in Phase 6</Badge>}
          />
          <EmptyState
            title="Your first mission is on its way"
            body="Missions are generated from the roadmap once you set a daily goal and your account exists. Today's dashboard is the foundation — the engine comes next."
            action={
              <Link href="/roadmap" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Preview the roadmap
              </Link>
            }
          />
        </Card>

        {/* ── Roadmap progress ──────────────────────────────────────── */}
        <Card>
          <CardHeader title="Roadmap progress" subtitle="Across all phases and topics" />
          <div className="flex items-center gap-5">
            <ProgressRing value={0} label="Roadmap progress" caption="overall" />
            <div className="min-w-0 space-y-2 text-sm">
              <p className="text-ink-medium">
                <span className="font-semibold text-ink-high">0 topics</span> completed
              </p>
              <p className="text-[13px] leading-relaxed text-ink-medium">
                The full phase/topic tree is built in Phase 4 and stored in the database — no placeholder data.
              </p>
              <Link href="/roadmap" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                Open roadmap
                <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Revision queue ────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Revision queue"
            subtitle="Spaced review keeps knowledge from decaying"
            action={<Badge tone="neutral">Phase 9</Badge>}
          />
          <EmptyState
            title="Nothing to review yet"
            body="Topics you've completed enter a spaced revision schedule — 1, 3, 7, 14 and 30 days out. Complete a topic and it will appear here."
          />
        </Card>

        {/* ── What should I do now ──────────────────────────────────── */}
        <Card>
          <CardHeader
            title="What should I do now?"
            subtitle="One explainable recommendation, every time you open the app"
            action={<Badge tone="neutral">Phase 14</Badge>}
          />
          <EmptyState
            title="Recommendations unlock with your progress data"
            body="The engine weighs prerequisites, weak skills, revision queue and your available time to answer one question: what now? It needs your roadmap progress first."
            action={
              <Link href="/roadmap" className={buttonClasses({ variant: "primary", size: "sm" })}>
                Start the roadmap
              </Link>
            }
          />
        </Card>
      </div>
    </div>
  );
}

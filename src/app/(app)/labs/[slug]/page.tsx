import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, type BadgeTone } from "@/components/ui";
import { LabAskMentorButton } from "@/components/labs/LabAskMentorButton";
import { LabEvidencePanel } from "@/components/labs/LabEvidencePanel";
import { LabReflectionForm } from "@/components/labs/LabReflectionForm";
import { LabStatusControls } from "@/components/labs/LabStatusControls";
import { LabWorkbench } from "@/components/labs/LabWorkbench";
import { SimTerminal } from "@/components/labs/SimTerminal";
import { StartLabButton } from "@/components/labs/StartLabButton";
import { getLabDetail } from "@/lib/labs/queries";
import { getSimGoals } from "@/lib/labs/sim";
import { getScenario } from "@/lib/labs/sims/scenarios";
import { formatLabMinutes, LAB_DIFFICULTY_LABEL, LAB_TYPE_LABEL } from "@/lib/labs/engine";
import { getRoadmapOverview } from "@/lib/roadmap/queries";

export const metadata = { title: "Lab" };

const TYPE_BADGE: Record<string, BadgeTone> = {
  simulation: "accent",
  sandbox: "neutral",
  external: "info",
  ctf: "warn",
  home_lab: "ok",
  custom: "neutral",
};

export default async function LabDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getLabDetail(slug);

  if (data.ok === false) {
    if (data.ok === false && "notFound" in data) notFound();
    return (
      <div className="space-y-6">
        <Card>
          <EmptyState
            title="Labs are warming up"
            body="The lab schema is not available yet. Run the labs migrations and refresh."
            className="border-none bg-transparent"
          />
        </Card>
      </div>
    );
  }

  const { lab, tasks, skillOptions, evidence, reflection } = data.detail;
  const mine = lab.mine;

  // Topic titles for cross-links (best-effort; unknown slugs are skipped).
  const overview = await getRoadmapOverview();
  const topicMeta = new Map<string, { title: string; locked: boolean }>();
  if (overview.ok) {
    for (const p of overview.phases) {
      for (const t of p.topics) topicMeta.set(t.slug, { title: t.title, locked: t.locked });
    }
  }

  // Sim context resolved once: the terminal needs the scenario, the AI-mentor
  // button needs the goals the user hasn't hit yet.
  const simKey = lab.completion.mode === "sim" ? lab.completion.sim_key : null;
  const scenario = simKey ? getScenario(simKey) : null;
  let simGoals: { id: string; description: string; done: boolean }[] = [];
  if (scenario) {
    const goalsRes = await getSimGoals(lab.slug);
    simGoals = goalsRes.ok
      ? goalsRes.goals
      : scenario.goals.map((g) => ({ id: g.id, description: g.description, done: false }));
  }
  const stuckOn = simGoals.filter((g) => !g.done).map((g) => g.description);

  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">
          <Link href="/labs" className="hover:text-ink-high">
            Labs
          </Link>{" "}
          / {lab.category_slug.replace("-", " ")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={TYPE_BADGE[lab.lab_type] ?? "neutral"}>{LAB_TYPE_LABEL[lab.lab_type]}</Badge>
          <Badge tone="neutral">{LAB_DIFFICULTY_LABEL[lab.difficulty]}</Badge>
          <Badge tone="neutral">~{formatLabMinutes(lab.estimated_minutes)}</Badge>
          {mine ? <Badge tone={mine.status === "completed" ? "ok" : "info"}>{mine.status.replace("_", " ")}</Badge> : null}
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{lab.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">{lab.summary}</p>
        {lab.provider && lab.external_url ? (
          <a
            href={lab.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline"
          >
            Open at {lab.provider} ↗
          </a>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Objective" subtitle="What done looks like" />
            <p className="text-sm leading-relaxed text-ink-high">{lab.objective}</p>
            <div className="mt-3">
              <LabAskMentorButton labTitle={lab.title} objective={lab.objective} stuckOn={stuckOn} />
            </div>
          </Card>

          {lab.instructions ? (
            <Card>
              <CardHeader title="How to run it" subtitle="Always inside authorized environments" />
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-high">{lab.instructions}</p>
            </Card>
          ) : null}

          {lab.learning_objectives.length > 0 ? (
            <Card>
              <CardHeader title="You'll practice" subtitle="Learning objectives" />
              <ul className="space-y-1.5">
                {lab.learning_objectives.map((o) => (
                  <li key={o} className="flex items-start gap-2 text-sm text-ink-high">
                    <span aria-hidden className="mt-0.5 text-accent">▹</span>
                    {o}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {lab.topics.length > 0 ? (
            <Card>
              <CardHeader title="Roadmap connections" subtitle="Topics this lab exercises" />
              <div className="flex flex-wrap gap-2">
                {lab.topics.map((t) => {
                  const meta = topicMeta.get(t);
                  return (
                    <Link
                      key={t}
                      href={`/roadmap/${t}`}
                      className="rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-[13px] text-ink-medium transition-colors hover:border-ink-low hover:text-ink-high"
                    >
                      {meta?.title ?? t}
                      {meta?.locked ? <span className="ml-1.5 font-mono text-[11px] text-ink-low">locked</span> : null}
                    </Link>
                  );
                })}
              </div>
              {lab.ticks_practice_stage ? (
                <p className="mt-3 text-[13px] leading-relaxed text-ink-medium">
                  Completing this lab marks the Practice stage on its mapped roadmap topics — through the normal flow, not a bypass.
                </p>
              ) : null}
            </Card>
          ) : null}

          {mine?.status === "completed" ? (
            <section aria-label="After the lab" className="space-y-4">
              <h2 className="font-display text-lg font-semibold tracking-tight">After the lab</h2>
              <LabEvidencePanel userLabId={mine.id} skillOptions={skillOptions} initial={evidence} />
              <LabReflectionForm userLabId={mine.id} initial={reflection} />
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Your tracker" subtitle={mine ? "Progress, time and notes" : "Not in your tracker yet"} />
            {mine ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-hairline bg-surface-2 px-2 py-2.5">
                    <div className="font-display text-lg font-semibold">{mine.attempts_count}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-ink-low">attempts</div>
                  </div>
                  <div className="rounded-lg border border-hairline bg-surface-2 px-2 py-2.5">
                    <div className="font-display text-lg font-semibold">{formatLabMinutes(mine.minutes_spent)}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-ink-low">logged</div>
                  </div>
                  <div className="rounded-lg border border-hairline bg-surface-2 px-2 py-2.5">
                    <div className="font-display text-lg font-semibold">{mine.hints_revealed}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-ink-low">hints</div>
                  </div>
                </div>
                <LabStatusControls userLabId={mine.id} status={mine.status} />
                {mine.completed_at ? (
                  <p className="font-mono text-[11px] text-ink-low">completed {mine.completed_at.slice(0, 10)}</p>
                ) : null}
              </div>
            ) : lab.completion.mode === "sim" ? (
              <p className="text-[13px] leading-relaxed text-ink-medium">
                This is a built-in simulation — just start typing in the terminal below. Your tracker row is created automatically.
              </p>
            ) : (
              <StartLabButton slug={lab.slug} />
            )}
          </Card>

          {mine && lab.completion.mode !== "sim" ? (
            <LabWorkbench
              userLabId={mine.id}
              tasks={tasks}
              tasksDone={mine.tasks_done}
              hints={lab.hints}
              hintsRevealed={mine.hints_revealed}
              minutesSpent={mine.minutes_spent}
              notes={mine.notes}
            />
          ) : null}
        </div>
      </div>

      {lab.completion.mode === "sim" ? (
        scenario ? (
          <section aria-label="Simulation" className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Simulation — {scenario.title}</h2>
            <SimTerminal
              slug={lab.slug}
              brief={scenario.brief}
              notes={scenario.notes}
              initialGoals={simGoals}
              initialHistory={[]}
              promptUser={scenario.initial().user.username}
              completed={mine?.status === "completed"}
            />
          </section>
        ) : (
          <Card>
            <EmptyState
              title="Simulation coming soon"
              body="This lab's simulation is not registered yet — it will appear here once shipped."
              className="border-none bg-transparent"
            />
          </Card>
        )
      ) : null}
    </div>
  );
}

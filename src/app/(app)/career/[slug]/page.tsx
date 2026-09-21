import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, ProgressBar } from "@/components/ui";
import { SelectPathButton } from "@/components/career/SelectPathButton";
import { getCareerPathBySlug } from "@/lib/career/queries";
import { getSkillsOverview } from "@/lib/roadmap/skills";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { getUserProjects } from "@/lib/projects/queries-helper";
import { TIER_LABEL } from "@/lib/career/engine";

export const metadata = { title: "Career path" };

const STATE_TONE: Record<"not_started" | "started" | "competent" | "demonstrated", "neutral" | "info" | "ok" | "accent"> = {
  not_started: "neutral",
  started: "info",
  competent: "accent",
  demonstrated: "ok",
};

const STATE_LABEL: Record<"not_started" | "started" | "competent" | "demonstrated", string> = {
  not_started: "Not started",
  started: "Started",
  competent: "Competent",
  demonstrated: "Demonstrated",
};

const TIER_TONE: Record<"exploring" | "building" | "strong_evidence", "neutral" | "info" | "ok"> = {
  exploring: "neutral",
  building: "info",
  strong_evidence: "ok",
};

export default async function CareerPathPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [path, skillsRes, roadmapRes, myProjects] = await Promise.all([
    getCareerPathBySlug(slug),
    getSkillsOverview(),
    getRoadmapOverview(),
    getUserProjects(),
  ]);

  if (!path) notFound();

  const skillNames = new Map(
    skillsRes.ok ? skillsRes.skills.map((s) => [s.slug, { name: s.name, level: s.level }]) : [],
  );
  const topicMeta = new Map(
    roadmapRes.ok
      ? roadmapRes.phases.flatMap((ph) =>
          ph.topics.map((t) => [t.slug, { title: t.title, status: t.progress.status, phase: ph.title }]),
        )
      : [],
  );

  // The viewer's finished project ideas (completed/published), for per-idea badges.
  const ideaDone = new Set(
    myProjects
      .filter((p) => p.idea_slug && (p.status === "completed" || p.status === "published"))
      .map((p) => p.idea_slug as string),
  );

  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <Link href="/career" className="text-[13px] text-ink-low hover:text-accent hover:underline">
          ← All career paths
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{path.name}</h1>
          <Badge tone={TIER_TONE[path.coverage.tier]}>{TIER_LABEL[path.coverage.tier]}</Badge>
          {path.selected ? <Badge tone="accent">selected</Badge> : null}
        </div>
        {path.nice_category ? (
          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-ink-low">{path.nice_category}</p>
        ) : null}
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">{path.description}</p>
      </section>

      {/* Coverage summary */}
      <Card>
        <CardHeader title="Your coverage" subtitle="Computed from real evidence — skills, topics, finished projects" />
        <div className="mt-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-ink-medium">Path coverage</span>
            <span className="font-mono text-[11px] text-ink-low">{path.coverage.readinessPct}%</span>
          </div>
          <ProgressBar value={path.coverage.readinessPct} label={`${path.name} coverage`} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-hairline bg-surface-2/40 p-3">
            <p className="font-display text-lg font-semibold text-ink-high">
              {path.coverage.skillsCompetent}/{path.coverage.skillsTotal}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-low">skills competent+</p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface-2/40 p-3">
            <p className="font-display text-lg font-semibold text-ink-high">
              {path.coverage.topicsDone}/{path.coverage.topicsTotal}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-low">topics completed</p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface-2/40 p-3">
            <p className="font-display text-lg font-semibold text-ink-high">
              {path.coverage.projectsDone}/{path.coverage.projectsTotal}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-low">projects finished</p>
          </div>
        </div>
        <div className="mt-4">
          <SelectPathButton slug={path.slug} selected={path.selected} size="md" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Responsibilities */}
        <Card>
          <CardHeader title="Typical responsibilities" subtitle="What the day-to-day actually looks like" />
          <ul className="mt-1 space-y-2">
            {path.responsibilities.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-medium">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent/70" />
                {r}
              </li>
            ))}
          </ul>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader title="Foundational skills" subtitle="Your current state per skill" />
          <ul className="mt-1 flex flex-wrap gap-2">
            {path.foundational_skills.map((s) => {
              const meta = skillNames.get(s);
              const state = path.coverage.perSkill.find((x) => x.slug === s)?.state ?? "not_started";
              return (
                <li key={s}>
                  <Link href="/skills" className="inline-flex" title={state === "not_started" ? "Not started" : `Skill state: ${STATE_LABEL[state]}`}>
                    <Badge tone={STATE_TONE[state]}>
                      {meta?.name ?? s} · {STATE_LABEL[state]}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-ink-low">
            Skill states grow from completed topics, practice and finished projects — see the Skills page for the full rules.
          </p>
        </Card>
      </div>

      {/* Recommended topics */}
      <Card>
        <CardHeader title="Recommended roadmap topics" subtitle="Straight from the Cyber_Path roadmap" />
        {path.recommended_topics.length === 0 ? (
          <EmptyState title="No topics mapped" body="This path has no recommended topics yet." className="border-none bg-transparent" />
        ) : (
          <ul className="mt-1 divide-y divide-hairline">
            {path.recommended_topics.map((t) => {
              const meta = topicMeta.get(t);
              const done = meta?.status === "completed";
              const inProgress = meta?.status === "in_progress";
              return (
                <li key={t} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/roadmap/${t}`} className="text-[13px] font-medium text-ink-high hover:text-accent hover:underline">
                      {meta?.title ?? t}
                    </Link>
                    {meta?.phase ? <p className="text-[11px] text-ink-low">{meta.phase}</p> : null}
                  </div>
                  {done ? (
                    <Badge tone="ok">done</Badge>
                  ) : inProgress ? (
                    <Badge tone="info">in progress</Badge>
                  ) : (
                    <Badge tone="neutral">not started</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Projects + certifications */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Portfolio projects" subtitle="Evidence employers can actually look at" />
          {path.project_ideas.length === 0 ? (
            <EmptyState title="No projects mapped" body="This path has no project ideas yet." className="border-none bg-transparent" />
          ) : (
            <ul className="mt-1 divide-y divide-hairline">
              {path.project_ideas.map((idea) => (
                <li key={idea} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href="/projects" className="min-w-0 text-[13px] font-medium text-ink-high capitalize hover:text-accent hover:underline">
                    {idea.replace(/-/g, " ")}
                  </Link>
                  {ideaDone.has(idea) ? <Badge tone="ok">finished</Badge> : <Badge tone="neutral">not started</Badge>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-ink-low">Project names are slugs from the Projects catalog.</p>
        </Card>

        <Card>
          <CardHeader title="Certifications" subtitle="Optional unless a specific employer requires them" />
          {path.certifications.length === 0 ? (
            <EmptyState title="No certifications listed" body="No certs mapped for this path." className="border-none bg-transparent" />
          ) : (
            <ul className="mt-1 space-y-2.5">
              {path.certifications.map((c) => (
                <li key={c.name} className="text-[13px] leading-relaxed">
                  <p className="font-medium text-ink-high">{c.name}</p>
                  <p className="text-[12px] text-ink-low">{c.note}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Entry guidance */}
      <Card>
        <CardHeader title="Getting in — honest guidance" subtitle="Read this before anything else on this page" />
        <p className="text-[13px] leading-relaxed text-ink-medium">{path.entry_guidance}</p>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, ErrorState, ProgressBar } from "@/components/ui";
import { SelectPathButton } from "@/components/career/SelectPathButton";
import { getCareerData } from "@/lib/career/queries";
import { TIER_LABEL } from "@/lib/career/engine";

export const metadata = { title: "Career" };

const TIER_TONE: Record<"exploring" | "building" | "strong_evidence", "neutral" | "info" | "ok"> = {
  exploring: "neutral",
  building: "info",
  strong_evidence: "ok",
};

export default async function CareerPage() {
  const data = await getCareerData();

  if (!data.ok) {
    return (
      <div className="space-y-6">
        <Header />
        <ErrorState
          title="Career explorer unavailable"
          message="The career-path data isn't reachable right now. If migration 0017 was just applied, reload in a moment."
        />
      </div>
    );
  }

  const selectedCount = data.paths.filter((p) => p.selected).length;

  return (
    <div className="space-y-6">
      <Header />

      <p className="max-w-3xl rounded-xl border border-hairline bg-surface-2/40 px-4 py-3 text-[13px] leading-relaxed text-ink-medium">
        Coverage below is computed from your <strong className="text-ink-high">real evidence</strong> —
        skills, completed topics and finished projects. Selecting a path is a bookmark, not a
        commitment, and completing anything here <strong className="text-ink-high">never guarantees a job</strong>.
      </p>

      {data.paths.length === 0 ? (
        <Card>
          <EmptyState
            title="No career paths configured"
            body="Run migration 0017_career_paths.sql to seed the six role paths."
            className="border-none bg-transparent"
          />
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.paths.map((p) => (
            <li key={p.slug} className="flex">
              <Card pad="md" className="flex w-full flex-col">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-[16px] font-semibold text-ink-high">
                        <Link href={`/career/${p.slug}`} className="hover:text-accent hover:underline">
                          {p.name}
                        </Link>
                      </h2>
                      {p.selected ? <Badge tone="accent">selected</Badge> : null}
                      {p.matchesTarget && !p.selected ? <Badge tone="info">matches your goal</Badge> : null}
                    </div>
                    {p.nice_category ? (
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-ink-low">{p.nice_category}</p>
                    ) : null}
                  </div>
                  <Badge tone={TIER_TONE[p.coverage.tier]}>{TIER_LABEL[p.coverage.tier]}</Badge>
                </div>

                <p className="mt-2 text-[13px] leading-relaxed text-ink-medium">{p.tagline}</p>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] font-medium text-ink-medium">Path coverage</span>
                    <span className="font-mono text-[11px] text-ink-low">{p.coverage.readinessPct}%</span>
                  </div>
                  <ProgressBar value={p.coverage.readinessPct} label={`${p.name} coverage`} size="sm" />
                  <p className="mt-1.5 text-[11px] text-ink-low">
                    {p.coverage.skillsStarted}/{p.coverage.skillsTotal} skills touched ·{" "}
                    {p.coverage.topicsDone}/{p.coverage.topicsTotal} topics done ·{" "}
                    {p.coverage.projectsDone}/{p.coverage.projectsTotal} projects finished
                  </p>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                  <Link
                    href={`/career/${p.slug}`}
                    className="text-[13px] font-medium text-accent hover:underline"
                  >
                    View path →
                  </Link>
                  <SelectPathButton slug={p.slug} selected={p.selected} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {selectedCount > 0 ? (
        <p className="text-[12px] text-ink-low">
          {selectedCount} path{selectedCount === 1 ? "" : "s"} selected — these feed your daily mission
          recommendations in a later phase.
        </p>
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <section className="animate-rise">
      <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Skills + evidence, not promises</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Career paths</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
        Explore SOC, pentesting, AppSec, DFIR, cloud and security engineering — with realistic
        responsibilities, skills, projects and cert context. No employment guarantees; certifications
        are labeled optional unless a role truly requires them.
      </p>
    </section>
  );
}

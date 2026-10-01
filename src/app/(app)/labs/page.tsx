import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, StatCard, type BadgeTone } from "@/components/ui";
import { AddLabForm } from "@/components/labs/AddLabForm";
import { LabStatusControls } from "@/components/labs/LabStatusControls";
import { getLabsData, applyFilters } from "@/lib/labs/queries";
import {
  formatLabMinutes,
  LAB_DIFFICULTY_LABEL,
  LAB_TYPE_LABEL,
  suggestedLabs,
  type LabFilters,
} from "@/lib/labs/engine";
import { getRoadmapOverview } from "@/lib/roadmap/queries";

export const metadata = { title: "Labs" };

const TYPE_BADGE: Record<string, BadgeTone> = {
  simulation: "accent",
  sandbox: "neutral",
  external: "info",
  ctf: "warn",
  home_lab: "ok",
  custom: "neutral",
};

type SearchParams = Promise<{ type?: string; category?: string; difficulty?: string; status?: string }>;

export default async function LabsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const data = await getLabsData();

  if (!data.ok) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <EmptyState
            title="Labs are warming up"
            body="The lab catalog schema is not available yet. Run the labs migrations and refresh."
            className="border-none bg-transparent"
          />
        </Card>
      </div>
    );
  }

  const filters: LabFilters = {
    type: (sp.type as LabFilters["type"]) ?? "all",
    category: sp.category ?? "all",
    difficulty: (sp.difficulty as LabFilters["difficulty"]) ?? "all",
    status: (sp.status as LabFilters["status"]) ?? "all",
  };
  const visible = applyFilters(data.catalog, filters);

  // "Practice alongside your roadmap": in-progress topics first, then roadmap order.
  const overview = await getRoadmapOverview();
  const topicOrder: string[] = [];
  const inProgressTopics = new Set<string>();
  if (overview.ok) {
    for (const p of overview.phases) {
      for (const t of p.topics) {
        topicOrder.push(t.slug);
        if (t.progress.status === "in_progress") inProgressTopics.add(t.slug);
      }
    }
  }
  const suggestedSlugs = new Set(
    suggestedLabs(
      data.catalog.map((l) => ({ slug: l.slug, status: l.mine?.status ?? null })),
      new Map(data.catalog.map((l) => [l.slug, l.topics])),
      topicOrder,
      inProgressTopics,
    ),
  );
  const suggested = data.catalog.filter((l) => suggestedSlugs.has(l.slug));

  const activeCustom = data.custom.filter((c) => c.status !== "abandoned");
  const abandonedCustom = data.custom.filter((c) => c.status === "abandoned");

  return (
    <div className="space-y-6">
      <Header />

      {/* Stats */}
      <section aria-label="Lab statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Completed" value={String(data.stats.completed)} hint={`${data.stats.total} tracked`} />
        <StatCard label="In progress" value={String(data.stats.inProgress)} hint={data.stats.revisiting > 0 ? `${data.stats.revisiting} revisiting` : "—"} />
        <StatCard label="Practical time" value={formatLabMinutes(data.stats.minutesTotal)} hint="logged across labs" />
        <StatCard label="CTF / home lab" value={`${data.stats.ctfCount} / ${data.stats.homeLabCount}`} hint="events + own machines" />
      </section>

      {/* Suggested */}
      {suggested.length > 0 ? (
        <section aria-label="Recommended labs" className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">Practice alongside your roadmap</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {suggested.map((lab) => (
              <Card key={lab.slug} className="flex flex-col">
                <div className="flex items-center gap-2">
                  <Badge tone={TYPE_BADGE[lab.lab_type] ?? "neutral"}>{LAB_TYPE_LABEL[lab.lab_type]}</Badge>
                  <Badge tone="neutral">{LAB_DIFFICULTY_LABEL[lab.difficulty]}</Badge>
                </div>
                <h3 className="mt-2.5 font-display text-[15px] font-semibold leading-snug">{lab.title}</h3>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-medium">{lab.summary}</p>
                <Link href={`/labs/${lab.slug}`} className="mt-3 text-[13px] font-medium text-accent hover:underline">
                  Open lab →
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* Catalog */}
      <section aria-label="Lab catalog" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 font-display text-lg font-semibold tracking-tight">Catalog</h2>
          <FilterLink href={buildHref(sp, { status: "all" })} active={filters.status === "all"}>All</FilterLink>
          <FilterLink href={buildHref(sp, { status: "not_started" })} active={filters.status === "not_started"}>Not started</FilterLink>
          <FilterLink href={buildHref(sp, { status: "in_progress" })} active={filters.status === "in_progress"}>In progress</FilterLink>
          <FilterLink href={buildHref(sp, { status: "completed" })} active={filters.status === "completed"}>Completed</FilterLink>
          <FilterLink href={buildHref(sp, { status: "revisit" })} active={filters.status === "revisit"}>Revisit</FilterLink>
          <span aria-hidden className="mx-1 h-4 w-px bg-hairline" />
          <FilterLink href={buildHref(sp, { type: "all" })} active={filters.type === "all"}>Any type</FilterLink>
          <FilterLink href={buildHref(sp, { type: "external" })} active={filters.type === "external"}>Provider</FilterLink>
          <FilterLink href={buildHref(sp, { type: "ctf" })} active={filters.type === "ctf"}>CTF</FilterLink>
          <FilterLink href={buildHref(sp, { type: "home_lab" })} active={filters.type === "home_lab"}>Home lab</FilterLink>
        </div>

        {visible.length === 0 ? (
          <Card>
            <EmptyState
              title="No labs match these filters"
              body="Try widening the filter — or add an external lab you're working on below."
              className="border-none bg-transparent"
            />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((lab) => (
              <Card key={lab.slug} className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TYPE_BADGE[lab.lab_type] ?? "neutral"}>{LAB_TYPE_LABEL[lab.lab_type]}</Badge>
                  <Badge tone="neutral">{LAB_DIFFICULTY_LABEL[lab.difficulty]}</Badge>
                  {lab.mine ? <Badge tone={lab.mine.status === "completed" ? "ok" : "info"}>{lab.mine.status.replace("_", " ")}</Badge> : null}
                  {lab.ticks_practice_stage ? <Badge tone="accent">practice stage</Badge> : null}
                </div>
                <h3 className="mt-2.5 font-display text-[15px] font-semibold leading-snug">{lab.title}</h3>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-medium">{lab.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-low">
                  <span>~{formatLabMinutes(lab.estimated_minutes)}</span>
                  {lab.provider ? <span>{lab.provider}</span> : null}
                  {lab.topics.length > 0 ? <span>{lab.topics.length} topic{lab.topics.length === 1 ? "" : "s"}</span> : null}
                </div>
                <div className="mt-3 flex-1" />
                {lab.mine ? (
                  <LabStatusControls userLabId={lab.mine.id} status={lab.mine.status} compact />
                ) : null}
                <div className="mt-2 flex items-center gap-3">
                  <Link href={`/labs/${lab.slug}`} className="text-[13px] font-medium text-accent hover:underline">
                    {lab.mine ? "Open lab" : "View lab"} →
                  </Link>
                  {lab.external_url ? (
                    <a href={lab.external_url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-ink-medium hover:underline">
                      {lab.provider || "External"} ↗
                    </a>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Custom labs */}
      <section aria-label="Your added labs" className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Your added labs</h2>
        {activeCustom.length === 0 && abandonedCustom.length === 0 ? (
          <Card>
            <EmptyState
              title="Tracking something outside the catalog?"
              body="Add provider labs, CTF events or home-lab exercises you're working on. Notes, time and status live here — all private."
              className="border-none bg-transparent"
            />
            <div className="mt-4">
              <AddLabForm categories={data.categories} />
            </div>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {activeCustom.map((lab) => (
                <Card key={lab.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TYPE_BADGE[lab.lab_type] ?? "neutral"}>{LAB_TYPE_LABEL[lab.lab_type]}</Badge>
                    {lab.category_slug ? <Badge tone="neutral">{lab.category_slug}</Badge> : null}
                  </div>
                  <h3 className="mt-2.5 font-display text-[15px] font-semibold leading-snug">{lab.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-low">
                    <span>{formatLabMinutes(lab.minutes_spent)} logged</span>
                    {lab.provider ? <span>{lab.provider}</span> : null}
                    {lab.completed_at ? <span>done {lab.completed_at.slice(0, 10)}</span> : null}
                  </div>
                  <div className="mt-3">
                    <LabStatusControls userLabId={lab.id} status={lab.status} compact />
                  </div>
                  {lab.external_url ? (
                    <a href={lab.external_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[13px] text-ink-medium hover:underline">
                      Open external link ↗
                    </a>
                  ) : null}
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader title="Add another lab" subtitle="Provider labs, CTFs, home-lab exercises" />
              <AddLabForm categories={data.categories} />
            </Card>
          </>
        )}
      </section>
    </div>
  );
}

function Header() {
  return (
    <section className="animate-rise">
      <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Hands-on, always authorized</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Labs</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
        Practice that proves the roadmap: provider labs, CTFs and home-lab exercises with tasks,
        hints, time and honest evidence. Built-in simulations arrive next.
      </p>
    </section>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
        active
          ? "border-accent/40 bg-surface-3 text-ink-high"
          : "border-hairline text-ink-medium hover:border-ink-low hover:text-ink-high"
      }`}
    >
      {children}
    </Link>
  );
}

function buildHref(
  sp: Record<string, string | undefined>,
  patch: Record<string, string>,
): string {
  const params = new URLSearchParams();
  const merged = { ...sp, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== "all") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/labs?${qs}` : "/labs";
}

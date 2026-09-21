import { Badge, Card, CardHeader, EmptyState, ErrorState } from "@/components/ui";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { StartProjectForm } from "@/components/projects/StartProjectForm";
import { getProjectsData } from "@/lib/projects/queries";

export const metadata = { title: "Projects" };

const DIFF_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const DIFF_TONE: Record<string, "ok" | "info" | "warn"> = {
  beginner: "ok",
  intermediate: "info",
  advanced: "warn",
};

export default async function ProjectsPage() {
  const data = await getProjectsData();

  if (!data.ok) {
    return (
      <div className="space-y-6">
        <Header />
        <ErrorState title="Could not load projects" message="The projects catalog is unavailable right now. Try again in a moment." />
      </div>
    );
  }

  const { ideas, mine } = data;
  const startedSlugs = new Set(mine.map((p) => p.idea_slug).filter((v): v is string => v != null));
  const inProgress = mine.filter((p) => p.status !== "completed" && p.status !== "published");
  const finished = mine.filter((p) => p.status === "completed" || p.status === "published");

  return (
    <div className="space-y-6">
      <Header />

      {/* ── My projects ─────────────────────────────────────────── */}
      <section aria-labelledby="my-projects" className="space-y-4">
        <h2 id="my-projects" className="font-display text-lg font-semibold tracking-tight">
          My projects
        </h2>
        {mine.length === 0 ? (
          <Card>
            <EmptyState
              title="No projects started yet"
              body="Pick an idea below and hit Start. Even the beginner ideas produce a real, portfolio-worthy artifact."
              className="border-none bg-transparent"
            />
          </Card>
        ) : (
          <>
            {inProgress.length > 0 ? (
              <ul className="space-y-4">
                {inProgress.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </ul>
            ) : null}
            {finished.length > 0 ? (
              <div className="space-y-4">
                {inProgress.length > 0 ? (
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">
                    Completed &amp; published
                  </h3>
                ) : null}
                <ul className="space-y-4">
                  {finished.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* ── Idea catalog ────────────────────────────────────────── */}
      <section aria-labelledby="ideas" className="space-y-4">
        <h2 id="ideas" className="font-display text-lg font-semibold tracking-tight">
          Ideas ({ideas.length})
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {ideas.map((idea) => {
            const started = startedSlugs.has(idea.slug);
            return (
              <li key={idea.slug} className="flex">
                <Card pad="md" className="flex w-full flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-display text-[15px] font-semibold text-ink-high">{idea.title}</p>
                    <Badge tone={DIFF_TONE[idea.difficulty] ?? "neutral"}>{DIFF_LABEL[idea.difficulty] ?? idea.difficulty}</Badge>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-medium">{idea.summary}</p>
                  {idea.authorized_use ? (
                    <p className="mt-3 rounded-lg border border-warn/25 bg-warn/[0.06] px-3 py-2 text-[12px] leading-relaxed text-warn">
                      <strong>Authorized use:</strong> {idea.authorized_use}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {idea.skills.map((s) => (
                      <Badge key={s} tone="neutral">
                        {s}
                      </Badge>
                    ))}
                    {idea.estimated_hours ? <Badge tone="neutral">~{idea.estimated_hours}h</Badge> : null}
                  </div>
                  {idea.milestones.length > 0 ? (
                    <details className="mt-3 text-[12px] text-ink-low">
                      <summary className="cursor-pointer select-none font-medium text-ink-medium hover:text-ink-high">
                        Milestones ({idea.milestones.length})
                      </summary>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed">
                        {idea.milestones.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ol>
                      {idea.requirements.length > 0 ? (
                        <>
                          <p className="mt-3 font-medium text-ink-medium">Requirements</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {idea.requirements.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </details>
                  ) : null}
                  <div className="mt-auto pt-4">
                    {started ? (
                      <span className="font-mono text-[12px] text-ink-low">started — see My projects</span>
                    ) : (
                      <StartProjectForm ideaSlug={idea.slug} ideaTitle={idea.title} />
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Header() {
  return (
    <section className="animate-rise">
      <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Build real things</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
        Ideas from beginner to advanced, each with milestones and clear authorized-use boundaries.
        Completed projects feed <strong className="text-ink-high">demonstrated</strong> evidence into your skill graph.
      </p>
    </section>
  );
}

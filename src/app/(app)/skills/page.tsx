import { Badge, Card, CardHeader, EmptyState, ProgressBar } from "@/components/ui";
import { getSkillsOverview, LEVEL_LABEL, type SkillView } from "@/lib/roadmap/skills";

export const metadata = { title: "Skills" };

const LEVEL_TONE: Record<SkillView["level"], "neutral" | "accent" | "ok" | "info"> = {
  not_started: "neutral",
  learning: "accent",
  practicing: "info",
  competent: "ok",
  demonstrated: "ok",
};

function SkillCard({ skill }: { skill: SkillView }) {
  return (
    <Card pad="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-high">{skill.name}</p>
          <p className="mt-0.5 text-[12px] text-ink-low">
            {skill.topics_completed}/{skill.topics_mapped} topics completed
            {skill.projects_completed > 0 ? (
              <>
                {' '}
                · <span className="text-ok">{skill.projects_completed} project{skill.projects_completed === 1 ? "" : "s"} demonstrated</span>
              </>
            ) : null}
          </p>
        </div>
        <Badge tone={LEVEL_TONE[skill.level]}>{LEVEL_LABEL[skill.level]}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-ink-medium">Theory</span>
            <span className="font-mono text-[11px] text-ink-low">{skill.theoryPct}%</span>
          </div>
          <ProgressBar value={skill.theoryPct} label={`${skill.name} theory`} size="sm" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-ink-medium">Practical</span>
            <span className="font-mono text-[11px] text-ink-low">{skill.practicalPct}%</span>
          </div>
          <ProgressBar value={skill.practicalPct} label={`${skill.name} practical`} size="sm" />
        </div>
      </div>
    </Card>
  );
}

export default async function SkillsPage() {
  const overview = await getSkillsOverview();

  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Evidence over checkboxes</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Skills</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          Every skill tracks theory and practice separately. Finishing reading is never the same as
          being able to do — the two bars below each skill keep you honest.
        </p>
      </section>

      {!overview.ok ? (
        <Card>
          <CardHeader title="Skill data unavailable" subtitle="Runs on the same migrations as the roadmap" action={<Badge tone="warn">Setup</Badge>} />
          <EmptyState
            title="Waiting on migrations 0003–0005"
            body="Run the three roadmap SQL files in Supabase, then reload this page."
            className="border-none bg-transparent"
          />
        </Card>
      ) : overview.skills.length === 0 ? (
        <Card>
          <EmptyState
            title="No skills mapped yet"
            body="Skills appear as roadmap content links topics to them. Seed migrations 0004–0005 include the first 14 skills."
          />
        </Card>
      ) : (
        <>
          {/* Group by category */}
          {Object.entries(
            overview.skills.reduce<Record<string, SkillView[]>>((acc, s) => {
              (acc[s.category] ??= []).push(s);
              return acc;
            }, {})
          ).map(([category, skills]) => (
            <section key={category} className="animate-rise" aria-labelledby={`cat-${category}`}>
              <h2 id={`cat-${category}`} className="mb-3 font-display text-lg font-semibold tracking-tight">
                {category}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {skills.map((s) => (
                  <SkillCard key={s.slug} skill={s} />
                ))}
              </div>
            </section>
          ))}

          <p className="text-center text-[13px] text-ink-low">
            Levels: Not started → Learning → Practicing → Competent → Demonstrated. No one becomes
            an expert from clicking checkboxes — demonstration comes from labs and projects.
          </p>
        </>
      )}
    </div>
  );
}

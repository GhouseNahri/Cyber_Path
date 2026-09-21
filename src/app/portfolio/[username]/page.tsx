import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

type PortfolioRow = {
  display_name: string | null;
  github_login: string | null;
  experience_level: string | null;
  finished_projects: { title: string; status: string; github_url: string | null; demo_url: string | null; completed_at: string | null }[];
  selected_paths: { name: string }[];
  skill_evidence: { name: string; level: string }[];
};

const LEVEL_TONE: Record<string, "neutral" | "info" | "accent" | "ok"> = {
  learning: "neutral",
  practicing: "info",
  competent: "accent",
  demonstrated: "ok",
};

export default async function PublicPortfolioPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  // Only data the SQL function whitelists is available here — no direct
  // table reads, no tokens, no emails, no in-progress anything.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_portfolio", { p_username: username });

  if (error || !data || (Array.isArray(data) && data.length === 0)) notFound();

  const row = (Array.isArray(data) ? data[0] : data) as PortfolioRow;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Learning portfolio</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{row.display_name || row.github_login || username}</h1>
        {row.github_login ? (
          <a
            href={`https://github.com/${encodeURIComponent(row.github_login)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-accent hover:underline"
          >
            github.com/{row.github_login} ↗
          </a>
        ) : null}
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-medium">
          A record of what I&apos;ve actually finished while learning cybersecurity — tracked with
          real evidence in Cyber_Path. Work in progress, shared honestly.
        </p>
      </section>

      {/* Career paths */}
      {row.selected_paths.length > 0 ? (
        <section className="mt-10" aria-label="Career focus">
          <h2 className="font-display text-lg font-semibold tracking-tight">Focus areas</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {row.selected_paths.map((p) => (
              <Badge key={p.name} tone="info">
                {p.name}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {/* Finished projects */}
      <section className="mt-10" aria-label="Finished projects">
        <h2 className="font-display text-lg font-semibold tracking-tight">Finished projects</h2>
        {row.finished_projects.length === 0 ? (
          <Card className="mt-3">
            <EmptyState title="Nothing finished yet" body="Projects appear here once they're completed — the bar is real." className="border-none bg-transparent" />
          </Card>
        ) : (
          <ul className="mt-3 space-y-3">
            {row.finished_projects.map((p) => (
              <li key={p.title} className="rounded-xl border border-hairline bg-surface-2/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-medium text-ink-high">{p.title}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="ok">{p.status === "published" ? "published" : "completed"}</Badge>
                    {p.completed_at ? (
                      <span className="font-mono text-[11px] text-ink-low">{p.completed_at.slice(0, 10)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
                  {p.github_url ? (
                    <a href={p.github_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      repository ↗
                    </a>
                  ) : null}
                  {p.demo_url ? (
                    <a href={p.demo_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      live demo ↗
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Skill evidence */}
      <section className="mt-10" aria-label="Skills">
        <h2 className="font-display text-lg font-semibold tracking-tight">Skills with evidence</h2>
        {row.skill_evidence.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-low">No skill evidence yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {row.skill_evidence.map((s) => (
              <Badge key={s.name} tone={LEVEL_TONE[s.level] ?? "neutral"}>
                {s.name} · {s.level}
              </Badge>
            ))}
          </div>
        )}
        <p className="mt-3 text-[12px] leading-relaxed text-ink-low">
          Levels reflect tracked practice and completed work in{" "}
          <Link href="/" className="text-accent hover:underline">
            Cyber_Path
          </Link>{" "}
          — they are learning milestones, not certifications or employment claims.
        </p>
      </section>
    </main>
  );
}

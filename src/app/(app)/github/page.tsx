import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { ConnectPanel } from "@/components/github/ConnectPanel";
import { ProjectLinker, RepoGrid } from "@/components/github/RepoLinker";
import { getGithubData } from "@/lib/github/queries";
import { getProfile } from "@/lib/profile";

export const metadata = { title: "GitHub" };

export default async function GithubPage() {
  const [data, profile] = await Promise.all([getGithubData(), getProfile()]);

  if (!data.ok) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardHeader title="GitHub unavailable" subtitle="Migration 0018 provides this feature" action={<Badge tone="warn">Setup</Badge>} />
          <EmptyState title="Waiting on the database" body="The github_connections table is not reachable. If migration 0018 was just applied, reload in a moment." className="border-none bg-transparent" />
        </Card>
      </div>
    );
  }

  const securityCount = data.repos.filter((r) => r.isSecurity).length;

  return (
    <div className="space-y-6">
      <Header />

      {/* ── Connection ──────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="GitHub connection"
          subtitle="Public data only (read:user). Your token is stored server-side and never shown."
        />
        <div className="mt-2">
          <ConnectPanel
            connection={data.connection}
            portfolioPublic={data.portfolioPublic}
            username={profile?.username ?? null}
          />
        </div>
        {data.connection?.lastSyncedAt ? (
          <p className="mt-3 text-[11px] text-ink-low">Last synced {data.connection.lastSyncedAt.slice(0, 10)}</p>
        ) : null}
      </Card>

      {/* ── Repositories ────────────────────────────────────────── */}
      <section aria-labelledby="repos" className="space-y-4">
        <h2 id="repos" className="font-display text-lg font-semibold tracking-tight">
          Repositories
          {data.repos.length > 0 ? (
            <span className="ml-2 font-mono text-[12px] font-normal text-ink-low">
              {data.repos.length} public · {securityCount} security-related
            </span>
          ) : null}
        </h2>
        {data.reposError ? (
          <Card>
            <EmptyState
              title="Could not load repositories"
              body="GitHub rejected the request — the token may have expired or been revoked. Click “Refresh token” above to reconnect."
              className="border-none bg-transparent"
            />
          </Card>
        ) : !data.connection ? (
          <Card>
            <EmptyState
              title="Connect GitHub to see your repositories"
              body="Public repositories only — private code is never requested."
              className="border-none bg-transparent"
            />
          </Card>
        ) : (
          <RepoGrid repos={data.repos} />
        )}
      </section>

      {/* ── Project linking ─────────────────────────────────────── */}
      <section aria-labelledby="linking" className="space-y-4">
        <h2 id="linking" className="font-display text-lg font-semibold tracking-tight">
          Link repos to projects
        </h2>
        <Card>
          <CardHeader title="Your projects" subtitle="A finished project with a real repo is portfolio evidence" />
          <div className="mt-2">
            <ProjectLinker projects={data.projects} />
          </div>
        </Card>
      </section>
    </div>
  );
}

function Header() {
  return (
    <section className="animate-rise">
      <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Real work, verifiable</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">GitHub</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
        Connect your account to surface security-relevant repositories, link them to your
        Cyber_Path projects, and optionally publish a learning portfolio. Read-only, public
        data, revocable anytime — from here or from GitHub.
      </p>
    </section>
  );
}

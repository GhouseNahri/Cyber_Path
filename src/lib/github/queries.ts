import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getUserProjects } from "@/lib/projects/queries-helper";
import { toRepoLite, sortRepos, type GithubRepoLite } from "./mapping";

export type ConnectionInfo = {
  githubLogin: string;
  connectedAt: string;
  lastSyncedAt: string | null;
};

export type GithubData =
  | {
      ok: true;
      connection: ConnectionInfo | null;
      repos: GithubRepoLite[];
      reposError: boolean;
      portfolioPublic: boolean;
      projects: { id: string; title: string; github_url: string | null; status: string }[];
    }
  | { ok: false; missingSchema: true };

/** The viewer's connection + repos. The access token NEVER leaves this
 *  module's server scope — only derived, non-secret data is returned. */
export const getGithubData = cache(async (): Promise<GithubData> => {
  const profile = await getProfile();
  if (!profile) return { ok: false, missingSchema: true };

  const supabase = await createClient();
  const [connRes, projectsRes] = await Promise.all([
    supabase
      .from("github_connections")
      .select("github_login, connected_at, last_synced_at, access_token")
      .eq("user_id", profile.id)
      .maybeSingle(),
    getUserProjects(),
  ]);

  if (connRes.error) return { ok: false, missingSchema: true };

  const conn = connRes.data as
    | { github_login: string; connected_at: string; last_synced_at: string | null; access_token: string }
    | null;

  const connection: ConnectionInfo | null = conn
    ? {
        githubLogin: conn.github_login,
        connectedAt: conn.connected_at,
        lastSyncedAt: conn.last_synced_at,
      }
    : null;

  let repos: GithubRepoLite[] = [];
  let reposError = false;
  if (conn) {
    try {
      const res = await fetch(
        `https://api.github.com/users/${encodeURIComponent(conn.github_login)}/repos?per_page=100&sort=pushed`,
        {
          headers: {
            Authorization: `Bearer ${conn.access_token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          cache: "no-store",
        },
      );
      if (res.ok) {
        const raw = (await res.json()) as unknown;
        repos = sortRepos(
          (Array.isArray(raw) ? raw : [])
            .map((r) => toRepoLite(r as never))
            .filter((r): r is GithubRepoLite => r !== null),
        );
      } else {
        reposError = true;
      }
    } catch {
      reposError = true;
    }
  }

  return {
    ok: true,
    connection,
    repos,
    reposError,
    portfolioPublic: (profile as unknown as { portfolio_public?: boolean }).portfolio_public ?? false,
    projects: projectsRes.map((p) => ({
      id: p.id,
      title: p.title,
      github_url: p.github_url,
      status: p.status,
    })),
  };
});

"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/roadmap/actions";
import { getProfile } from "@/lib/profile";

/** The user's GitHub repos (lite shape) for the attach drawer. Reuses the
 *  same server-side token path as the GitHub page — never exposes the token. */
export async function listGithubReposForAi(): Promise<
  | { ok: true; connected: boolean; login: string | null; repos: { fullName: string; name: string; language: string | null; isPrivate: boolean }[] }
  | { ok: false; error: string }
> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Profile unavailable." };

  const { data: conn } = await supabase
    .from("github_connections")
    .select("github_login, access_token")
    .eq("user_id", userId)
    .maybeSingle();
  const row = conn as { github_login: string; access_token: string } | null;
  if (!row) return { ok: true, connected: false, login: null, repos: [] };

  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(row.github_login)}/repos?per_page=100&sort=pushed`, {
      headers: {
        Authorization: `Bearer ${row.access_token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!res.ok) return { ok: true, connected: true, login: row.github_login, repos: [] };
    const raw = (await res.json()) as unknown;
    const repos = (Array.isArray(raw) ? raw : [])
      .map((r) => {
        const x = r as { name?: string; full_name?: string; language?: string | null; private?: boolean };
        if (typeof x.full_name !== "string" || typeof x.name !== "string") return null;
        return { fullName: x.full_name, name: x.name, language: x.language ?? null, isPrivate: x.private ?? false };
      })
      .filter((r): r is { fullName: string; name: string; language: string | null; isPrivate: boolean } => r !== null);
    return { ok: true, connected: true, login: row.github_login, repos };
  } catch {
    return { ok: true, connected: true, login: row.github_login, repos: [] };
  }
}

export type RepoAccessRow = { repo_full_name: string; enabled: boolean; granted_at: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/** Repositories the user has explicitly enabled for AI access. */
export async function listAiRepos(): Promise<RepoAccessRow[]> {
  const { supabase, userId } = await requireUser();
  if (!userId) return [];
  const { data } = await supabase
    .from("ai_repo_access")
    .select("repo_full_name, enabled, granted_at")
    .eq("user_id", userId)
    .order("granted_at", { ascending: false });
  return (data ?? []) as RepoAccessRow[];
}

/**
 * Enable read-only AI access for ONE repository.
 * `confirmReadonly` must be true — the UI presents what AI access means and
 * the user explicitly acknowledges it (master prompt Phase 6/8).
 */
export async function enableAiRepoAccess(repoFullName: string, confirmReadonly: boolean): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };
  if (!confirmReadonly) return { ok: false, error: "Read-only consent is required to enable AI access." };

  const repo = repoFullName.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    return { ok: false, error: "Invalid repository name." };
  }

  const { error } = await supabase
    .from("ai_repo_access")
    .upsert({ user_id: userId, repo_full_name: repo, enabled: true, granted_at: new Date().toISOString() });
  if (error) return { ok: false, error: "Could not enable AI access. Try again." };
  return { ok: true };
}

/** Disconnect a repository from AI access. */
export async function disableAiRepoAccess(repoFullName: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };
  const { error } = await supabase
    .from("ai_repo_access")
    .delete()
    .eq("user_id", userId)
    .eq("repo_full_name", repoFullName.trim());
  if (error) return { ok: false, error: "Could not disconnect the repository. Try again." };
  return { ok: true };
}

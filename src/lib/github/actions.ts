"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { parseGithubUser } from "./mapping";

export type GithubActionResult = { ok: true } | { ok: false; error: string };

const REVALIDATE = ["/github", "/projects", "/settings"];

/**
 * Persist the connection after the OAuth redirect. Supabase hands back the
 * provider_token on the session after `linkIdentity`; we read it once and
 * store it server-side. The token is never returned to any client.
 */
export async function saveGithubConnection(): Promise<GithubActionResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Your session expired — sign in again." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  // provider_token appears on the session right after the OAuth flow.
  const { data: sessionData } = await supabase.auth.getSession();
  const providerToken = sessionData.session?.provider_token;

  // The identity row for GitHub.
  const identity = user.identities?.find((i) => i.provider === "github");
  const githubUser = parseGithubUser((identity?.identity_data ?? {}) as Record<string, unknown>);
  if (!githubUser) {
    return { ok: false, error: "GitHub identity not found on your account. Connect GitHub first." };
  }
  if (!providerToken) {
    return {
      ok: false,
      error: "No GitHub token in the session. Reconnect GitHub — the token appears only right after approving access.",
    };
  }

  const scopes = typeof sessionData.session?.provider_refresh_token === "string"
    ? []
    : []; // Supabase does not surface scopes reliably; store empty, harmless.

  const { error } = await supabase.from("github_connections").upsert(
    {
      user_id: profile.id,
      github_id: githubUser.id,
      github_login: githubUser.login,
      access_token: providerToken,
      scopes,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: "Could not save the GitHub connection. Try again in a moment." };

  for (const p of REVALIDATE) revalidatePath(p);
  return { ok: true };
}

/** Disconnect: drop the stored token and unlink the GitHub identity. */
export async function disconnectGithub(): Promise<GithubActionResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Your session expired — sign in again." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("github_connections")
    .delete()
    .eq("user_id", profile.id);
  if (error) return { ok: false, error: "Could not disconnect GitHub. Try again in a moment." };

  // Best-effort identity unlink (fails harmlessly if already gone).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ghIdentity = user?.identities?.find((i) => i.provider === "github");
  if (ghIdentity) {
    await supabase.auth.unlinkIdentity(ghIdentity);
  }

  for (const p of REVALIDATE) revalidatePath(p);
  return { ok: true };
}

/** Opt in / out of the public portfolio page. */
export async function setPortfolioPublic(isPublic: boolean): Promise<GithubActionResult> {
  if (typeof isPublic !== "boolean") return { ok: false, error: "Invalid value." };

  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Your session expired — sign in again." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ portfolio_public: isPublic })
    .eq("id", profile.id);
  if (error) return { ok: false, error: "Could not update portfolio visibility. Try again in a moment." };

  for (const p of [...REVALIDATE, `/portfolio/${profile.username ?? ""}`]) revalidatePath(p);
  return { ok: true };
}

/** Link a repo URL onto one of the user's projects (https only). */
export async function linkProjectRepo(projectId: string, repoUrl: string): Promise<GithubActionResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Your session expired — sign in again." };

  const url = repoUrl.trim();
  if (url.length > 300) return { ok: false, error: "URL too long." };
  if (url.length > 0) {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" || u.hostname !== "github.com") {
        return { ok: false, error: "Only https://github.com/… repository URLs can be linked." };
      }
    } catch {
      return { ok: false, error: "That is not a valid URL." };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_projects")
    .update({ github_url: url || null, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", profile.id);
  if (error) return { ok: false, error: "Could not link the repo. Try again in a moment." };

  for (const p of REVALIDATE) revalidatePath(p);
  return { ok: true };
}

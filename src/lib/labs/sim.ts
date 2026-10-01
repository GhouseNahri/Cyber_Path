"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getScenario, scenarioCommand, type SimStateWithFlags } from "./sims/scenarios";

export type SimRunResult =
  | {
      ok: true;
      output: string[];
      commandOk: boolean;
      goalsDone: string[];
      allGoalsDone: boolean;
      goals: { id: string; description: string; done: boolean }[];
    }
  | { ok: false; error: string };

export type SimResetResult =
  | { ok: true; goals: { id: string; description: string; done: boolean }[] }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

type SimContext = {
  ok: true;
  user: NonNullable<Awaited<ReturnType<typeof requireUser>>>;
  supabase: Awaited<ReturnType<typeof createClient>>;
  slug: string;
  scenario: NonNullable<ReturnType<typeof getScenario>>;
  row: { id: string; status: string; tasks_done: unknown };
  state: SimStateWithFlags;
};
type SimContextError = { ok: false; error: string };

/**
 * Load (or lazily create) the caller's sim state for a lab. Only labs whose
 * completion_criteria.mode === "sim" and whose sim_key has a registered
 * scenario are eligible — enforced here, not trusted from the client.
 */
async function loadOrCreateSim(slug: string): Promise<SimContext | SimContextError> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };

  const supabase = await createClient();
  const { data: lab } = await supabase
    .from("labs")
    .select("slug, completion_criteria, is_published")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!lab) return { ok: false, error: "That lab does not exist." };

  const criteria = lab.completion_criteria as Record<string, unknown> | null;
  const simKey = criteria && criteria.mode === "sim" ? criteria.sim_key : null;
  if (typeof simKey !== "string") return { ok: false, error: "This lab has no simulation." };
  const scenario = getScenario(simKey);
  if (!scenario) return { ok: false, error: "This lab's simulation is not available yet." };

  // The tracker row must exist (created by startLab). Auto-start on first
  // sim command keeps the flow friction-free.
  let { data: row } = await supabase
    .from("user_labs")
    .select("id, status, tasks_done")
    .eq("user_id", user.id)
    .eq("lab_slug", slug)
    .maybeSingle();
  if (!row) {
    const now = new Date().toISOString();
    const { data: created, error } = await supabase
      .from("user_labs")
      .insert({ user_id: user.id, lab_slug: slug, status: "in_progress", started_at: now, updated_at: now })
      .select("id, status, tasks_done")
      .single();
    if (error || !created) return { ok: false, error: "Could not start the lab. Try again." };
    row = created;
  }

  const { data: simRow } = await supabase
    .from("lab_sim_states")
    .select("state")
    .eq("user_id", user.id)
    .eq("lab_slug", slug)
    .maybeSingle();

  const stored = simRow?.state as SimStateWithFlags | null;
  const state = stored && stored.root && stored.cwd && stored.user ? stored : scenario.initial();

  return { ok: true, user, supabase, slug, scenario, row, state };
}

async function goalsView(slug: string, scenario: ReturnType<typeof getScenario>, state: unknown) {
  void slug;
  if (!scenario) return [] as { id: string; description: string; done: boolean }[];
  return scenario.goals.map((g) => {
    let done = false;
    try {
      done = g.check(state as never);
    } catch {
      done = false;
    }
    return { id: g.id, description: g.description, done };
  });
}

/** Run one command in the lab's simulation. Persists state; auto-completes. */
export async function runSimCommand(slug: string, raw: string): Promise<SimRunResult> {
  if (typeof raw !== "string" || raw.length > 500) return { ok: false, error: "Invalid command." };

  const ctx = await loadOrCreateSim(slug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase, user, scenario, row, state } = ctx;

  const result = scenarioCommand(scenario, state as SimStateWithFlags, raw);

  const now = new Date().toISOString();
  await supabase
    .from("lab_sim_states")
    .upsert({ user_id: user.id, lab_slug: slug, state: result.state, updated_at: now });

  const allDone = result.goalsDone.length === scenario.goals.length;
  if (allDone && row.status !== "completed") {
    // Auto-complete through the normal tracker flow: status + attempt log.
    const currentAttempt = (row as unknown as { attempts_count?: number }).attempts_count ?? 1;
    await supabase
      .from("user_labs")
      .update({ status: "completed", completed_at: now, updated_at: now })
      .eq("id", row.id)
      .eq("user_id", user.id);
    await supabase.from("lab_attempts").insert({
      user_id: user.id,
      user_lab_id: row.id,
      attempt_number: currentAttempt,
      result: "completed",
      detail: { sim: scenario.key, goals: result.goalsDone },
      completed_at: now,
    });
    revalidatePath("/labs");
  }

  return {
    ok: true,
    output: result.output,
    commandOk: result.ok,
    goalsDone: result.goalsDone,
    allGoalsDone: allDone,
    goals: await goalsView(slug, scenario, result.state),
  };
}

/** Reset the simulation to its initial state (fresh attempt). */
export async function resetSim(slug: string): Promise<SimResetResult> {
  const ctx = await loadOrCreateSim(slug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase, user, scenario } = ctx;

  const fresh = scenario.initial();
  await supabase
    .from("lab_sim_states")
    .upsert({ user_id: user.id, lab_slug: slug, state: fresh, updated_at: new Date().toISOString() });

  return { ok: true, goals: await goalsView(slug, scenario, fresh) };
}

/** Read the current sim state's goal view without running a command. */
export async function getSimGoals(slug: string): Promise<SimResetResult> {
  const ctx = await loadOrCreateSim(slug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  return { ok: true, goals: await goalsView(slug, ctx.scenario, ctx.state) };
}

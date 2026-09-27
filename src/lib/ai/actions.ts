"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/roadmap/actions";
import type { AiPermissions } from "./context";

/** Settings path + nothing else (AI surfaces are client-side state). */
function revalidateAi() {
  revalidatePath("/settings");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/** Ensure a permissions row exists and return the effective permissions. */
export async function getAiPermissions(): Promise<AiPermissions | null> {
  const { supabase, userId } = await requireUser();
  if (!userId) return null;

  const { data } = await supabase
    .from("ai_permissions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data as AiPermissions;

  // First visit: create the default row (owner-only RLS allows this).
  const { data: created, error } = await supabase
    .from("ai_permissions")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (error) return null;
  return created as AiPermissions;
}

export type AiPermissionsUpdate = Partial<
  Pick<AiPermissions, "assistant_enabled" | "use_roadmap_context" | "use_progress_context" | "use_github_context" | "history_enabled" | "response_level">
>;

export async function updateAiPermissions(update: AiPermissionsUpdate): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const clean: AiPermissionsUpdate = {};
  if (typeof update.assistant_enabled === "boolean") clean.assistant_enabled = update.assistant_enabled;
  if (typeof update.use_roadmap_context === "boolean") clean.use_roadmap_context = update.use_roadmap_context;
  if (typeof update.use_progress_context === "boolean") clean.use_progress_context = update.use_progress_context;
  if (typeof update.use_github_context === "boolean") clean.use_github_context = update.use_github_context;
  if (typeof update.history_enabled === "boolean") clean.history_enabled = update.history_enabled;
  if (update.response_level && ["beginner", "intermediate", "advanced"].includes(update.response_level)) {
    clean.response_level = update.response_level;
  }

  const { error } = await supabase
    .from("ai_permissions")
    .upsert({ user_id: userId, ...clean, updated_at: new Date().toISOString() });

  if (error) return { ok: false, error: "Could not save AI settings. Try again." };
  revalidateAi();
  return { ok: true };
}

export type ConversationRow = { id: string; title: string; updated_at: string };

export async function listConversations(): Promise<ConversationRow[]> {
  const { supabase, userId } = await requireUser();
  if (!userId) return [];
  const { data } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  return (data ?? []) as ConversationRow[];
}

export async function listMessages(conversationId: string): Promise<{ id: string; role: "user" | "assistant"; content: string; created_at: string }[]> {
  const { supabase, userId } = await requireUser();
  if (!userId) return [];
  // RLS guarantees ownership; the explicit user_id filter keeps the query honest.
  const { data } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data ?? []) as { id: string; role: "user" | "assistant"; content: string; created_at: string }[];
}

export async function createConversation(title?: string): Promise<ActionResult & { id?: string }> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };
  const clean = (title ?? "New chat").trim().slice(0, 120) || "New chat";
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title: clean })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not start a new chat. Try again." };
  return { ok: true, id: data.id };
}

export async function renameConversation(conversationId: string, title: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };
  const clean = title.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Title cannot be empty." };
  const { error } = await supabase
    .from("ai_conversations")
    .update({ title: clean })
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not rename the chat. Try again." };
  return { ok: true };
}

export async function deleteConversation(conversationId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not delete the chat. Try again." };
  return { ok: true };
}

/** Delete every conversation (and, by cascade, their messages). */
export async function clearAllConversations(): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };
  const { error } = await supabase.from("ai_conversations").delete().eq("user_id", userId);
  if (error) return { ok: false, error: "Could not clear history. Try again." };
  return { ok: true };
}

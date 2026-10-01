import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /settings/export — download the signed-in user's data as JSON.
 *  Owner-only: the handler re-checks auth; RLS constrains every query even
 *  if a stale session ever reached this point. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const uid = user.id;
  const [profile, progress, tasks, sessions, missed, notes, bookmarks, resourceStatus, reviews, projects, labs, labAttempts, labEvidence, aiConversations] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("user_topic_progress").select("*").eq("user_id", uid),
    supabase.from("daily_tasks").select("*").eq("user_id", uid),
    supabase.from("study_sessions").select("*").eq("user_id", uid),
    supabase.from("missed_days").select("*").eq("user_id", uid),
    supabase.from("topic_notes").select("*").eq("user_id", uid),
    supabase.from("user_topic_bookmarks").select("*").eq("user_id", uid),
    supabase.from("user_resource_status").select("*").eq("user_id", uid),
    supabase.from("topic_reviews").select("*").eq("user_id", uid),
    supabase.from("user_projects").select("*").eq("user_id", uid),
    supabase.from("user_labs").select("*").eq("user_id", uid),
    supabase.from("lab_attempts").select("*").eq("user_id", uid),
    supabase.from("lab_evidence").select("*").eq("user_id", uid),
    supabase.from("ai_conversations").select("*").eq("user_id", uid),
  ]);

  const errors = [profile.error, progress.error, tasks.error, sessions.error, missed.error, notes.error, bookmarks.error, resourceStatus.error, reviews.error, projects.error, labs.error, labAttempts.error, labEvidence.error, aiConversations.error]
    .filter(Boolean)
    .length;
  if (errors > 0) {
    return NextResponse.json({ error: "Export failed. Try again." }, { status: 500 });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    app: "Cyber_Path",
    format_version: 2,
    profile: profile.data,
    topic_progress: progress.data ?? [],
    daily_tasks: tasks.data ?? [],
    study_sessions: sessions.data ?? [],
    missed_days: missed.data ?? [],
    topic_notes: notes.data ?? [],
    topic_bookmarks: bookmarks.data ?? [],
    resource_statuses: resourceStatus.data ?? [],
    topic_reviews: reviews.data ?? [],
    projects: projects.data ?? [],
    labs: labs.data ?? [],
    lab_attempts: labAttempts.data ?? [],
    lab_evidence: labEvidence.data ?? [],
    // Sim positions are machine state, not human-readable data — excluded.
    ai_conversations: aiConversations.data ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="cyber-path-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

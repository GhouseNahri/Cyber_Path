import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getAiPermissions } from "@/lib/ai/actions";
import { buildContext } from "@/lib/ai/context";
import { isAiMode, buildSystemPrompt } from "@/lib/ai/modes";
import { fetchRepoContext, fenceRepoContext } from "@/lib/ai/githubContext";

export const runtime = "nodejs";

const MAX_MESSAGE_CHARS = 4000;
const RATE_LIMIT_MESSAGES = 50;
const RATE_LIMIT_WINDOW_HOURS = 24;
/** Send at most this many recent messages to the provider. */
const HISTORY_WINDOW = 20;

type ApiMessage = { role: "user" | "assistant"; content: string };

function sseEncode(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    message?: unknown;
    conversationId?: unknown;
    topicSlug?: unknown;
    mode?: unknown;
    repoFullName?: unknown;
  };

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  const topicSlug = typeof body.topicSlug === "string" ? body.topicSlug : null;
  const mode = isAiMode(body.mode) ? body.mode : "mentor";
  const repoFullName = typeof body.repoFullName === "string" ? body.repoFullName : null;

  if (!message) return Response.json({ error: "Empty message." }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) {
    return Response.json({ error: "Message too long (max 4000 characters)." }, { status: 413 });
  }

  const perms = await getAiPermissions();
  if (!perms || !perms.assistant_enabled) {
    return Response.json({ error: "AI assistant is disabled in Settings → AI assistant." }, { status: 403 });
  }

  const profile = await getProfile();
  if (!profile) return Response.json({ error: "Profile unavailable." }, { status: 500 });

  // ── Rate limit: N assistant messages per rolling 24h ──────────────────────
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 3600_000).toISOString();
  const { count, error: countError } = await supabase
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", since);
  if (countError) {
    return Response.json({ error: "Could not verify usage limits. Try again." }, { status: 500 });
  }
  if ((count ?? 0) >= RATE_LIMIT_MESSAGES) {
    return Response.json(
      { error: `You've reached ${RATE_LIMIT_MESSAGES} AI messages per ${RATE_LIMIT_WINDOW_HOURS}h. Try again later.` },
      { status: 429 },
    );
  }

  // ── Conversation resolution (must be owned by the caller) ─────────────────
  let convId: string | null = conversationId;
  if (convId) {
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", convId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!conv) return Response.json({ error: "Conversation not found." }, { status: 404 });
  } else if (perms.history_enabled) {
    // Auto-create when history is on and none was provided.
    const { data: created, error: createError } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (createError || !created) {
      return Response.json({ error: "Could not start a conversation. Try again." }, { status: 500 });
    }
    convId = created.id;
  }
  // When history is disabled, convId stays null → nothing is persisted.

  const { contextBlock, visible } = await buildContext(perms, topicSlug);

  // ── Repository context: ONLY for explicitly granted repos ────────────
  let system = buildSystemPrompt(mode, contextBlock, perms.response_level);
  let repoMeta: { repo: string; files: number; bytes: number } | null = null;
  if (repoFullName) {
    if (!perms.use_github_context) {
      return Response.json({ error: "GitHub context is disabled in Settings → AI assistant." }, { status: 403 });
    }
    const { data: grant } = await supabase
      .from("ai_repo_access")
      .select("repo_full_name")
      .eq("user_id", user.id)
      .eq("repo_full_name", repoFullName)
      .eq("enabled", true)
      .maybeSingle();
    if (!grant) {
      return Response.json({ error: "AI access for that repository is not enabled." }, { status: 403 });
    }
    // Token never leaves this server scope; read-only GETs only.
    const { data: conn } = await supabase
      .from("github_connections")
      .select("access_token")
      .eq("user_id", user.id)
      .maybeSingle();
    const token = (conn as { access_token?: string } | null)?.access_token;
    if (!token) {
      return Response.json({ error: "Connect GitHub first from the GitHub page." }, { status: 400 });
    }
    const ctx = await fetchRepoContext(repoFullName, { token, signal: req.signal });
    if (!ctx.ok) {
      return Response.json({ error: ctx.error ?? "Could not read the repository." }, { status: 502 });
    }
    system = buildSystemPrompt(mode, `${contextBlock}\n\n${fenceRepoContext(ctx)}`.trim(), perms.response_level);
    repoMeta = { repo: ctx.repo, files: ctx.files.length, bytes: ctx.totalBytes };
  }

  // ── Recent history window (for continuity when history is on) ─────────────
  let history: ApiMessage[] = [];
  if (convId && perms.history_enabled) {
    const { data } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_WINDOW);
    history = ((data ?? []) as ApiMessage[]).reverse();
  }

  const { streamChat, AiProviderError } = await import("@/lib/ai/provider");

  const stream = new ReadableStream({
    async start(controller) {
      const sse = (data: unknown) => controller.enqueue(sseEncode(data));

      try {
        sse({ type: "meta", conversationId: convId, visibleContext: visible, repo: repoMeta });

        // Persist the user message (only when history is enabled).
        if (convId && perms.history_enabled) {
          await supabase.from("ai_messages").insert({
            conversation_id: convId,
            user_id: user.id,
            role: "user",
            content: message,
          });
        }

        const collector: string[] = [];
        for await (const chunk of streamChat({
          messages: [
            { role: "system", content: system },
            ...history,
            { role: "user", content: message },
          ],
          signal: req.signal,
          maxOutputTokens: 2048,
        })) {
          if (chunk.text) {
            collector.push(chunk.text);
            sse({ type: "delta", text: chunk.text });
          }
        }
        const full = collector.join("");
        sse({ type: "done", ok: true });

        // Persist assistant reply (history on) + bump conversation stamp.
        if (convId && perms.history_enabled) {
          await supabase.from("ai_messages").insert({
            conversation_id: convId,
            user_id: user.id,
            role: "assistant",
            content: full || "(no response)",
          });
          await supabase
            .from("ai_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", convId);
        }
      } catch (err) {
        const status = err instanceof AiProviderError ? err.status : 500;
        const friendly =
          status === 429
            ? "The AI provider is rate-limiting requests. Try again in a moment."
            : status === 503
              ? "AI is not configured on this deployment yet — add AI_API_KEY (server env)."
              : status === 404
                ? "The configured AI model isn't available on this provider. Update AI_MODEL to a current model (for Gemini: gemini-2.5-flash)."
                : status === 400
                ? "The AI provider rejected the request — the saved API key looks invalid. Re-check AI_API_KEY in the Vercel project settings (a Gemini key is ~39 characters starting with 'AIza')."
                : "The AI provider request failed. Try again.";
        sse({ type: "error", error: friendly });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-RateLimit-Limit": String(RATE_LIMIT_MESSAGES),
      "X-RateLimit-Remaining": String(Math.max(0, RATE_LIMIT_MESSAGES - (count ?? 0) - 1)),
    },
  });
}

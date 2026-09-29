/**
 * AI provider abstraction.
 *
 * The application talks to `streamChat` only — the concrete provider is
 * chosen server-side from environment variables, so swapping providers or
 * models later never touches feature code.
 *
 * MODEL STRATEGY (Gemini): the default is Google's rolling alias
 * `gemini-flash-latest`, which always tracks the current flash model, so
 * scheduled model retirements stop breaking the assistant. Stream attempts
 * degrade gracefully: thinking-capable models get `thinkingBudget: 0` (so
 * the output budget is spent on answers, not hidden reasoning), models that
 * reject that field are retried without it, a 404 falls back to
 * `GEMINI_FALLBACK_MODEL`, and transient overload (500/503) is retried once.
 *
 * SECURITY: `AI_API_KEY` is a server-only secret. It must never be prefixed
 * with NEXT_PUBLIC_ and never crosses to the client; this module throws if
 * imported into a client bundle by accident (`"server-only"` guard).
 */
import "server-only";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

export type ChatOptions = {
  messages: ChatMessage[];
  /** Sampling temperature (0–1). Defaults modest for factual tutoring. */
  temperature?: number;
  /** Hard output cap in tokens. */
  maxOutputTokens?: number;
  /** Abort signal — the client can stop generation mid-stream. */
  signal?: AbortSignal;
};

/** A parsed chunk of the model's output stream. */
export type ChatChunk = { text?: string };

export type ProviderName = "gemini" | "openai" | "anthropic";

export type ProviderConfig = {
  provider: ProviderName;
  model: string;
  hasKey: boolean;
};

/** True when a real key is configured — drives the UI's "not configured" state. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

/** Current provider identity (safe to expose to the client — no secrets). */
export function getProviderConfig(): ProviderConfig {
  const raw = process.env.AI_PROVIDER?.trim();
  const provider: ProviderName = raw === "openai" || raw === "anthropic" ? raw : "gemini";
  const model =
    process.env.AI_MODEL?.trim() ||
    (provider === "gemini"
      ? "gemini-flash-latest"
      : provider === "openai"
        ? "gpt-4o-mini"
        : "claude-3-5-haiku-latest");
  return { provider, model, hasKey: isAiConfigured() };
}

/** Gemini fallback when the rolling alias is unavailable (rare). */
export const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

/** Thrown when the provider returns a non-200; `status` maps to UI states. */
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

function assertKey(): string {
  const key = process.env.AI_API_KEY;
  if (!key) throw new AiProviderError("AI is not configured on this deployment.", 503);
  return key;
}

/** Base URL override for gateways/proxies; defaults to the real provider. */
function providerHost(provider: ProviderName): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "gemini":
    default:
      return "https://generativelanguage.googleapis.com/v1beta/models";
  }
}

/**
 * Stream a chat completion as an async iterator of text chunks.
 * Implemented with plain fetch + SSE parsing — no SDK dependency — for the
 * three providers the app targets.
 */
export async function* streamChat(options: ChatOptions): AsyncGenerator<ChatChunk> {
  const { provider, model } = getProviderConfig();
  const key = assertKey();
  const { messages, temperature = 0.4, maxOutputTokens = 2048, signal } = options;

  if (provider === "gemini") {
    // Gemini: contents[] with role user/model; system via systemInstruction.
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

    const attempt = (modelName: string, withThinking: boolean) =>
      fetch(`${providerHost(provider)}/${modelName}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          contents,
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          generationConfig: {
            temperature,
            maxOutputTokens,
            // Thinking-capable flash models otherwise spend the entire output
            // budget on hidden reasoning before emitting a single word.
            ...(withThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      });

    let currentModel = model;
    let withThinking = true;
    let res = await attempt(currentModel, withThinking);
    // Some models reject thinkingConfig outright — retry without it once.
    if (res.status === 400) {
      withThinking = false;
      res = await attempt(currentModel, withThinking);
    }
    // The rolling alias can lag behind a retirement window — fall back once.
    if (res.status === 404 && currentModel !== GEMINI_FALLBACK_MODEL) {
      currentModel = GEMINI_FALLBACK_MODEL;
      withThinking = false;
      res = await attempt(currentModel, withThinking);
    }
    // Transient provider overload: back off once, then retry — switching to
    // the fallback model, since overload is often model-specific.
    if ((res.status === 503 || res.status === 500) && !signal?.aborted) {
      await new Promise((r) => setTimeout(r, 900));
      if (!signal?.aborted) {
        if (currentModel !== GEMINI_FALLBACK_MODEL) {
          currentModel = GEMINI_FALLBACK_MODEL;
          withThinking = false;
        }
        res = await attempt(currentModel, withThinking);
      }
    }
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      // 429 from the provider = quota/rate limit; surface as-is for the UI.
      throw new AiProviderError(detail.slice(0, 200) || "AI provider request failed.", res.status);
    }
    yield* parseSse(res.body, (raw) => {
      const json = raw as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text =
        json?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("") ?? "";
      return text || undefined;
    });
    return;
  }

  if (provider === "openai" || provider === "anthropic") {
    // OpenAI-compatible / Anthropic SSE shapes kept side-by-side for the
    // swappability promise. (Gemini is the primary target; these two are
    // minimal but complete for chat streaming.)
    const isAnthropic = provider === "anthropic";
    const res = await fetch(providerHost(provider), {
      method: "POST",
      headers: isAnthropic
        ? {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          }
        : { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal,
      body: JSON.stringify(
        isAnthropic
          ? {
              model,
              max_tokens: maxOutputTokens,
              temperature,
              stream: true,
              system: messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") || undefined,
              messages: messages
                .filter((m) => m.role !== "system")
                .map((m) => ({ role: m.role, content: m.content })),
            }
          : {
              model,
              temperature,
              max_tokens: maxOutputTokens,
              stream: true,
              messages,
            },
      ),
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new AiProviderError(detail.slice(0, 200) || "AI provider request failed.", res.status);
    }
    yield* parseSse(res.body, (raw) => {
      if (isAnthropic) {
        const json = raw as { type?: string; delta?: { text?: string } };
        return json?.type === "content_block_delta" ? (json?.delta?.text ?? undefined) : undefined;
      }
      const json = raw as { choices?: { delta?: { content?: string } }[] };
      return json?.choices?.[0]?.delta?.content || undefined;
    });
    return;
  }

  throw new AiProviderError(`Unknown provider: ${provider}`, 500);
}

/** Minimal SSE reader: yields parsed `data:` payloads until the stream ends. */
async function* parseSse(
  body: ReadableStream<Uint8Array>,
  extract: (json: unknown) => string | undefined,
): AsyncGenerator<ChatChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const text = extract(JSON.parse(payload) as unknown);
        if (text) yield { text };
      } catch {
        // Ignore malformed keepalive chunks.
      }
    }
  }
}

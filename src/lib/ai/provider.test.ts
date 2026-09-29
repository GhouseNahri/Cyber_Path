import { afterEach, describe, expect, it, vi } from "vitest";
import { AiProviderError, getProviderConfig, streamChat } from "./provider";

function sseResponse(chunks: unknown[], status = 200) {
  const text = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("");
  return {
    ok: status === 200,
    status,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
    text: async () => JSON.stringify(chunks),
  } as unknown as Response;
}

const GEMINI_CHUNK = {
  candidates: [{ content: { parts: [{ text: "hello" }] } }],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("AI provider config", () => {
  it("defaults to gemini with a flash model", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("AI_API_KEY", "test-key");
    const cfg = getProviderConfig();
    expect(cfg.provider).toBe("gemini");
    expect(cfg.model).toBe("gemini-flash-latest");
    expect(cfg.hasKey).toBe(true);
  });

  it("reports not-configured without a key", () => {
    vi.stubEnv("AI_API_KEY", "");
    expect(getProviderConfig().hasKey).toBe(false);
  });

  it("supports provider overrides", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_MODEL", "gpt-4o-mini");
    vi.stubEnv("AI_API_KEY", "k");
    expect(getProviderConfig()).toMatchObject({ provider: "openai", model: "gpt-4o-mini", hasKey: true });
  });
});

describe("streamChat", () => {
  it("streams gemini chunks and maps roles correctly", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("AI_MODEL", "gemini-2.5-flash");
    vi.stubEnv("AI_API_KEY", "test-key");

    const fetchMock = vi.fn().mockResolvedValue(sseResponse([GEMINI_CHUNK, GEMINI_CHUNK]));
    vi.stubGlobal("fetch", fetchMock);

    const chunks: string[] = [];
    for await (const c of streamChat({ messages: [{ role: "user", content: "hi" }] })) {
      if (c.text) chunks.push(c.text);
    }

    expect(chunks).toEqual(["hello", "hello"]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("key=test-key");
    const payload = JSON.parse(String(init.body));
    expect(payload.contents).toEqual([{ role: "user", parts: [{ text: "hi" }] }]);
    expect(payload.systemInstruction).toBeUndefined();
  });

  it("hoists a system message into systemInstruction", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("AI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([GEMINI_CHUNK]));
    vi.stubGlobal("fetch", fetchMock);

    for await (const _ of streamChat({
      messages: [
        { role: "system", content: "be nice" },
        { role: "user", content: "hi" },
      ],
    })) {
      void _;
    }

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.systemInstruction.parts[0].text).toBe("be nice");
  });

  it("throws AiProviderError with provider status on failure", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "quota" } as unknown as Response),
    );

    await expect(async () => {
      for await (const _ of streamChat({ messages: [{ role: "user", content: "hi" }] })) {
        void _;
      }
    }).rejects.toBeInstanceOf(AiProviderError);

    try {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "" } as unknown as Response),
      );
      for await (const _ of streamChat({ messages: [{ role: "user", content: "hi" }] })) {
        void _;
      }
    } catch (e) {
      expect((e as AiProviderError).status).toBe(429);
    }
  });

  it("throws 503 when no key is configured", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn()); // must not be called
    await expect(async () => {
      for await (const _ of streamChat({ messages: [{ role: "user", content: "hi" }] })) {
        void _;
      }
    }).rejects.toMatchObject({ status: 503 });
  });
});

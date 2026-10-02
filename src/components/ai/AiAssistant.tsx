"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "@/components/ui";
import { AIAssistantButton } from "./AIAssistantButton";
import { Markdown } from "./Markdown";
import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  getAiPermissions,
} from "@/lib/ai/actions";
import { listAiRepos, enableAiRepoAccess, disableAiRepoAccess, listGithubReposForAi } from "@/lib/ai/repoActions";
import { AI_MODES, type AiMode } from "@/lib/ai/modes";

type UiMessage = { id: string; role: "user" | "assistant"; content: string };
type ConversationRow = { id: string; title: string; updated_at: string };

const SUGGESTIONS = [
  "Explain SQL injection like I'm a beginner",
  "What should I study next?",
  "I have 30 minutes — what should I do?",
  "Why is Linux important for cybersecurity?",
];

/** Quick actions shown while a topic is active (Phase 14 of the master prompt). */
const TOPIC_ACTIONS: { label: string; prompt: (title: string) => string }[] = [
  { label: "Explain", prompt: (t) => `Explain "${t}" step by step for my level.` },
  { label: "Example", prompt: (t) => `Give me a real-world cybersecurity example of "${t}".` },
  { label: "Quiz me", prompt: (t) => `Quiz me with 5 questions on "${t}" at my level. Grade my answers as I respond.` },
  { label: "Practice", prompt: (t) => `Give me a practical exercise for "${t}" I can do in under 30 minutes.` },
  { label: "Summarize", prompt: (t) => `Summarize "${t}" in 5 bullet points I can revise from.` },
  { label: "Challenge", prompt: (t) => `Give me a tricky scenario question on "${t}" and walk through the reasoning after I answer.` },
];

/** Floating AI assistant: launcher bubble + slide-in panel.
 *  Desktop: right-side panel. Mobile (<sm): full-screen sheet.
 *  Any page can summon it via the `cyberpath:ai-ask` CustomEvent
 *  (detail: { message?, topicSlug?, topicTitle? }). */
export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [visibleContext, setVisibleContext] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [perms, setPerms] = useState<Awaited<ReturnType<typeof getAiPermissions>>>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mode, setMode] = useState<AiMode>("mentor");
  const [showModes, setShowModes] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [repos, setRepos] = useState<{ fullName: string; name: string; language: string | null; isPrivate: boolean }[]>([]);
  const [repoConnected, setRepoConnected] = useState(false);
  const [repoLogin, setRepoLogin] = useState<string | null>(null);
  const [enabledRepos, setEnabledRepos] = useState<string[]>([]);
  const [attachedRepo, setAttachedRepo] = useState<string | null>(null);
  const [attachBusy, setAttachBusy] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<{ slug: string; title: string | null } | null>(null);
  const pendingAsk = useRef<string | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevOpen = useRef(false);
  const [announce, setAnnounce] = useState("");

  // Load permissions once; decide whether the launcher should render at all.
  useEffect(() => {
    let cancelled = false;
    getAiPermissions().then((p) => {
      if (!cancelled) setPerms(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
    setPanelVisible(false);
  }, []);

  // Focus the input when the panel opens; Escape closes (not while streaming).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !streaming) closePanel();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, streaming, closePanel]);

  // Return focus to the launcher when the panel closes (a11y).
  useEffect(() => {
    if (prevOpen.current && !open) launcherRef.current?.focus();
    prevOpen.current = open;
  }, [open]);

  // Throttled live region so screen readers follow streaming output without spam.
  const streamTextRef = useRef("");
  useEffect(() => {
    streamTextRef.current = streamText;
  }, [streamText]);
  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(() => setAnnounce(streamTextRef.current.slice(-400)), 1200);
    return () => clearInterval(id);
  }, [streaming]);

  // External open/ask bridge (roadmap "Ask AI", missed-day support, …).
  useEffect(() => {
    function onAsk(e: Event) {
      const d = (e as CustomEvent<{ message?: string; topicSlug?: string | null; topicTitle?: string | null }>).detail ?? {};
      // Microtask defer: keeps state updates out of the effect's synchronous
      // path (react-hooks/set-state-in-effect) without changing behavior.
      queueMicrotask(() => {
        if (d.topicSlug !== undefined) {
          setActiveTopic(d.topicSlug ? { slug: d.topicSlug, title: d.topicTitle ?? null } : null);
        }
        if (d.message) pendingAsk.current = d.message;
        setOpen(true);
        setPanelVisible(true);
      });
    }
    window.addEventListener("cyberpath:ai-ask", onAsk);
    return () => window.removeEventListener("cyberpath:ai-ask", onAsk);
  }, []);

  // Auto-scroll to the newest content while the transcript grows.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, streamText]);

  async function openPanel() {
    setOpen(true);
    setPanelVisible(true);
    const [convs, p] = await Promise.all([listConversations(), getAiPermissions()]);
    setConversations(convs);
    setPerms(p);
  }

  async function loadConversation(id: string) {
    if (streaming) return;
    setConversationId(id);
    setMessages(await listMessages(id));
    setError(null);
    setShowHistory(false);
  }

  function newChat() {
    if (streaming) return;
    setConversationId(null);
    setMessages([]);
    setStreamText("");
    setError(null);
    setVisibleContext([]);
    inputRef.current?.focus();
  }

  /** Keep Tab cycling inside the open panel (a11y focus trap). */
  function trapTab(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !panelRef.current) return;
    const els = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    const first = els[0];
    const last = els[els.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    const inside = panelRef.current.contains(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
    if (streamText.trim()) {
      setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "assistant", content: streamText }]);
    }
    setStreaming(false);
    setStreamText("");
    setAnnounce("");
  }

  const activeTopicTitle = activeTopic?.title ?? null;
  const activeTopicSlug = activeTopic?.slug ?? null;

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streaming) return;
      setError(null);
      setNotConfigured(false);
      setStreaming(true);
      setStreamText("");
      setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, conversationId, topicSlug: activeTopicSlug, mode, repoFullName: attachedRepo }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 503) setNotConfigured(true);
          setError(body.error ?? "The assistant is unavailable right now.");
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        let sawMeta = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 2);
            if (!raw.startsWith("data:")) continue;
            try {
              const evt = JSON.parse(raw.slice(5)) as {
                type: string;
                text?: string;
                error?: string;
                conversationId?: string | null;
                visibleContext?: string[];
              };
              if (evt.type === "meta") {
                sawMeta = true;
                if (evt.conversationId) setConversationId(evt.conversationId);
                if (evt.visibleContext) setVisibleContext(evt.visibleContext);
              } else if (evt.type === "delta") {
                acc += evt.text ?? "";
                setStreamText(acc);
              } else if (evt.type === "error") {
                setError(evt.error ?? "The AI request failed.");
              }
            } catch {
              // Ignore malformed frames.
            }
          }
        }

        if (!sawMeta && !acc) {
          setError("The AI provider returned an empty response (it may be overloaded). Try again in a moment.");
        }
        if (acc) {
          setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: acc }]);
        }
        setStreamText("");
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          // Stopped by the user — partial text was already committed above.
        } else {
          setError("Network error — the assistant is unreachable. Try again.");
        }
      } finally {
        setStreaming(false);
        setStreamText("");
        setAnnounce("");
        abortRef.current = null;
      }
    },
    [conversationId, streaming, activeTopicSlug, mode, attachedRepo],
  );

  // Fire any pending external ask once the panel is open (state settled).
  useEffect(() => {
    if (!open) return;
    const msg = pendingAsk.current;
    if (!msg) return;
    pendingAsk.current = null;
    const t = setTimeout(() => void send(msg), 50);
    return () => clearTimeout(t);
  }, [open, send]);

  const canSend = input.trim().length > 0 && !streaming && perms?.assistant_enabled !== false;

  return (
    <div>
      {/* Screen-reader live region for streaming responses */}
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      {/* Launcher (hidden when disabled in settings) — slingshot primitive.
          All AI logic stays in this file; the button only toggles the panel. */}
      {perms?.assistant_enabled !== false ? (
        <AIAssistantButton
          buttonRef={launcherRef}
          open={open}
          onToggle={() => {
            if (open) {
              closePanel();
            } else {
              void openPanel();
            }
          }}
        />
      ) : null}

      {/* Backdrop */}
      {open ? (
        <div
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 motion-reduce:transition-none ${
            panelVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => {
            if (!streaming) closePanel();
          }}
          aria-hidden="true"
        />
      ) : null}

      {/* Panel */}
      {open ? (
        <div
          ref={panelRef}
          id="ai-panel"
          role="dialog"
          aria-modal="true"
          aria-label="AI assistant"
          aria-busy={streaming}
          onKeyDown={trapTab}
          className={`fixed z-50 flex flex-col border-hairline bg-surface-1 shadow-lift transition-transform duration-200 ease-out-expo motion-reduce:transition-none max-sm:inset-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0 sm:bottom-4 sm:right-4 sm:top-4 sm:w-[420px] sm:rounded-2xl sm:border ${
            panelVisible ? "translate-x-0" : "sm:translate-x-[110%] max-sm:translate-y-2"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true">🤖</span>
              <h2 className="font-display text-[15px] font-semibold text-ink-high">AI Assistant</h2>
              {activeTopicTitle ? (
                <span className="truncate rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">{activeTopicTitle}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  setAttachOpen((v) => !v);
                  setShowModes(false);
                  if (!attachOpen) {
                    const gh = await listGithubReposForAi();
                    if (gh.ok) {
                      setRepos(gh.repos);
                      setRepoConnected(gh.connected);
                      setRepoLogin(gh.login);
                      const en = await listAiRepos();
                      setEnabledRepos(en.filter((r) => r.enabled).map((r) => r.repo_full_name));
                    }
                  }
                }}
                className="rounded-lg p-1.5 text-ink-medium hover:bg-surface-2 hover:text-ink-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label="Attach a GitHub repository"
                title="Attach project"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                  <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowModes((v) => !v);
                  setAttachOpen(false);
                }}
                className={`rounded-lg p-1.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${showModes ? "text-accent" : "text-ink-medium hover:text-ink-high"}`}
                aria-label="Switch assistant mode"
                title={`Mode: ${AI_MODES.find((m) => m.id === mode)?.label}`}
              >
                <span aria-hidden="true" className="text-sm">{AI_MODES.find((m) => m.id === mode)?.emoji}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="rounded-lg p-1.5 text-ink-medium hover:bg-surface-2 hover:text-ink-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label="Toggle conversation history"
                title="History"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                  <path d="M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={newChat}
                className="rounded-lg p-1.5 text-ink-medium hover:bg-surface-2 hover:text-ink-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label="Start a new chat"
                title="New chat"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                  <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mode picker */}
          {showModes ? (
            <div className="grid grid-cols-2 gap-1.5 border-b border-hairline bg-surface-2/40 p-2">
              {AI_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMode(m.id);
                    setShowModes(false);
                  }}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                    mode === m.id
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-hairline bg-surface-1 text-ink-medium hover:border-accent/30 hover:text-ink-high"
                  }`}
                >
                  <span aria-hidden="true">{m.emoji}</span> <span className="font-medium">{m.label}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-low">{m.hint}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* Attach-project drawer */}
          {attachOpen ? (
            <div className="max-h-64 space-y-1.5 overflow-y-auto border-b border-hairline bg-surface-2/40 p-2">
              {!repoConnected ? (
                <p className="px-2 py-1 text-xs text-ink-medium">
                  Connect GitHub from the <a href="/github" className="text-accent hover:underline">GitHub page</a> first.
                </p>
              ) : repos.length === 0 ? (
                <p className="px-2 py-1 text-xs text-ink-low">No repositories found.</p>
              ) : (
                repos.map((r) => {
                  const enabled = enabledRepos.includes(r.fullName);
                  const attached = attachedRepo === r.fullName;
                  return (
                    <div key={r.fullName} className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-1 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink-high">{r.name}</p>
                        <p className="text-[11px] text-ink-low">{r.language ?? "—"}{r.isPrivate ? " · private" : ""}{enabled ? " · AI: read-only" : ""}</p>
                      </div>
                      {enabled ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setAttachedRepo(attached ? null : r.fullName)}
                            className={`rounded-lg px-2 py-1 text-[11px] ${attached ? "bg-accent/15 text-accent" : "text-ink-medium hover:bg-surface-2"}`}
                          >
                            {attached ? "Attached ✓" : "Attach"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setAttachBusy(r.fullName);
                              await disableAiRepoAccess(r.fullName);
                              setEnabledRepos((rs) => rs.filter((x) => x !== r.fullName));
                              if (attachedRepo === r.fullName) setAttachedRepo(null);
                              setAttachBusy(null);
                            }}
                            disabled={attachBusy === r.fullName}
                            className="rounded-lg p-1 text-ink-low hover:text-danger"
                            aria-label={`Disconnect AI access for ${r.name}`}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            setAttachBusy(r.fullName);
                            // Explicit read-only consent happens in the confirm click below.
                            const res = await enableAiRepoAccess(r.fullName, window.confirm(
                              `Allow the AI assistant READ-ONLY access to "${r.fullName}"?\n\nIt can read files from this repository to help you. It can never push, modify, or delete anything.`
                            ));
                            if (res.ok) setEnabledRepos((rs) => [...rs, r.fullName]);
                            setAttachBusy(null);
                          }}
                          disabled={attachBusy === r.fullName}
                          className="rounded-lg border border-hairline px-2 py-1 text-[11px] text-ink-medium hover:border-accent/40 hover:text-accent"
                        >
                          Enable AI
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              {attachedRepo ? (
                <p className="px-2 pt-1 text-[11px] text-accent">Attached: {attachedRepo} — the AI reads it read-only while attached.</p>
              ) : null}
            </div>
          ) : null}

          {/* History drawer */}
          {showHistory ? (
            <div className="border-b border-hairline bg-surface-2/40 px-2 py-2">
              {conversations.length === 0 ? (
                <p className="px-2 py-1 text-xs text-ink-low">No saved chats yet.</p>
              ) : (
                <ul className="max-h-44 space-y-0.5 overflow-y-auto">
                  {conversations.map((c) => (
                    <li key={c.id} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void loadConversation(c.id)}
                        className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-[13px] text-ink-high hover:bg-surface-2"
                      >
                        {c.title}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteConversation(c.id);
                          setConversations((cs) => cs.filter((x) => x.id !== c.id));
                          if (conversationId === c.id) newChat();
                        }}
                        className="rounded-lg p-1 text-ink-low opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        aria-label={`Delete conversation: ${c.title}`}
                      >
                        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
                          <path d="M4 7h16M9 7V5h6v2m-7 0 1 12h6l1-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {/* Topic quick actions (Phase 14) */}
          {activeTopicSlug ? (
            <div className="flex flex-wrap gap-1.5 border-b border-hairline bg-surface-2/30 px-4 py-2">
              {TOPIC_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={streaming}
                  onClick={() => void send(a.prompt(activeTopicTitle ?? activeTopicSlug))}
                  className="rounded-full border border-hairline bg-surface-1 px-2.5 py-1 text-[11px] text-ink-medium transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Context visibility strip */}
          {visibleContext.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-b border-hairline bg-surface-2/30 px-4 py-2">
              {visibleContext.map((v) => (
                <span key={v} className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                  {v}
                </span>
              ))}
            </div>
          ) : null}

          {/* Transcript */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !streaming ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-hairline bg-surface-2/40 p-4">
                  <p className="text-sm font-medium text-ink-high">How can I help?</p>
                  <p className="mt-1 text-[13px] text-ink-medium">
                    Ask cybersecurity questions, get topic explanations, or plan your next study session.
                  </p>
                </div>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="w-full rounded-xl border border-hairline bg-surface-2/40 px-3 py-2 text-left text-[13px] text-ink-medium hover:border-accent/40 hover:text-ink-high"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent/15 px-3.5 py-2.5 text-[13.5px] text-ink-high">
                    {m.content}
                  </div>
                ) : (
                  <div className="group w-full max-w-[95%]">
                    <Markdown>{m.content}</Markdown>
                    <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(m.content);
                          setCopiedId(m.id);
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                        className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-low hover:bg-surface-2 hover:text-ink-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        aria-label="Copy response"
                      >
                        {copiedId === m.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {streamText ? (
              <div className="flex justify-start">
                <div className="w-full max-w-[95%]">
                  <Markdown>{streamText}</Markdown>
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-accent align-middle motion-reduce:animate-none" aria-hidden="true" />
                </div>
              </div>
            ) : null}

            {error ? (
              <div role="alert" className="rounded-xl border border-danger/30 bg-danger/[0.07] p-3 text-[13px] text-danger">
                <p>{error}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void send(messages.filter((m) => m.role === "user").at(-1)?.content ?? input)}
                  >
                    Retry
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setError(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Composer */}
          <form
            className="border-t border-hairline p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const t = input;
              setInput("");
              void send(t);
            }}
          >
            {notConfigured ? (
              <p className="mb-2 rounded-lg border border-warn/30 bg-warn/[0.08] px-3 py-2 text-xs text-warn">
                AI isn&apos;t configured on this deployment yet — add the AI_API_KEY server environment variable.
              </p>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const t = input;
                    setInput("");
                    void send(t);
                  }
                }}
                rows={Math.min(4, Math.ceil(input.length / 40) || 1)}
                placeholder="Ask anything…"
                aria-label="Message the AI assistant"
                disabled={perms?.assistant_enabled === false}
                className="max-h-28 min-h-11 w-full resize-none rounded-xl border border-hairline bg-surface-2/70 px-3.5 py-2.5 text-sm text-ink-high placeholder:text-ink-low focus:border-accent/50 focus:outline-none disabled:opacity-50"
              />
              {streaming ? (
                <Button type="button" variant="secondary" size="md" onClick={stopGeneration} aria-label="Stop generating">
                  ■
                </Button>
              ) : (
                <Button type="submit" variant="primary" size="md" disabled={!canSend} aria-label="Send message">
                  ↑
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { buttonClasses } from "@/components/ui";

/** Dispatches a topic-scoped ask to the global AI assistant (see AiAssistant's
 *  `cyberpath:ai-ask` bridge). Renders nothing AI-specific — just opens the
 *  panel pre-scoped to the topic. */
export function AskAiButton({ topicSlug, topicTitle }: { topicSlug: string; topicTitle: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("cyberpath:ai-ask", {
            detail: { topicSlug, topicTitle, message: `Explain the topic "${topicTitle}" and what I should focus on.` },
          }),
        )
      }
      className={buttonClasses({ variant: "secondary", size: "sm" })}
    >
      <span aria-hidden="true">🤖</span> Ask AI about this topic
    </button>
  );
}

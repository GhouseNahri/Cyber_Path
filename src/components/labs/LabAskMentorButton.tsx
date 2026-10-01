"use client";

import { buttonClasses } from "@/components/ui";

/**
 * Lab AI-mentor button: opens the global assistant pre-filled with the lab's
 * context and an open-ended nudge (never answers). Goes through the same
 * `cyberpath:ai-ask` bridge as every other page — no new endpoint.
 */
export function LabAskMentorButton({
  labTitle,
  objective,
  stuckOn = [],
}: {
  labTitle: string;
  objective: string;
  /** Descriptions of the goals the user hasn't hit yet (sims), if any. */
  stuckOn?: string[];
}) {
  const parts = [
    `I'm working on the lab "${labTitle}" (objective: ${objective}).`,
    stuckOn.length > 0 ? `I'm stuck on: ${stuckOn.join("; ")}.` : "I'm not sure how to approach the next step.",
    "Help me think it through without giving away the answer.",
  ];

  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("cyberpath:ai-ask", {
            detail: { topicSlug: null, message: parts.join(" ") },
          }),
        )
      }
      className={buttonClasses({ variant: "secondary", size: "sm" })}
    >
      <span aria-hidden="true">🤖</span> Stuck? Ask the AI mentor
    </button>
  );
}

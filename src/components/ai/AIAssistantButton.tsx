'use client';

import type { Ref } from 'react';
import SlingButton from '@/components/ui/SlingButton';

/**
 * AIAssistantButton — the Cyber_Path launcher for the global AI assistant.
 *
 * Deliberately thin. It owns three things and nothing else:
 *   1. the AI icon (a sparkle, not a "send message" arrow),
 *   2. the Cyber_Path colour tokens,
 *   3. the open/close trigger.
 *
 * All chat, conversation history, AI context, permissions and streaming live
 * in `AiAssistant` and are untouched by this component.
 *
 * Props are tuned away from the React Bits defaults for this placement:
 * `maxPull` is the largest the corner has room for, `armAt` is reachable with
 * a thumb, and `particles` is dialled back from 14 so the burst reads as a
 * deliberate flourish rather than a demo.
 */
export type AIAssistantButtonProps = {
  /** Whether the AI panel is currently open — swaps the icon and the label. */
  open: boolean;
  /** Existing AiAssistant open/close toggle. Never creates a second panel. */
  onToggle: () => void;
  /** Forwarded so AiAssistant can restore focus here when the panel closes. */
  buttonRef?: Ref<HTMLButtonElement>;
};

export function AIAssistantButton({ open, onToggle, buttonRef }: AIAssistantButtonProps) {
  return (
    // Positioning lives on the wrapper, not the sling root: the root sets
    // `position: relative` for its absolute children, and two competing
    // position utilities would resolve by stylesheet order, not class order.
    <div className="fixed bottom-5 right-5 z-40">
      <SlingButton
        ariaLabel={open ? 'Close the Cyber_Path AI Assistant' : 'Open the Cyber_Path AI Assistant'}
        ariaExpanded={open}
        ariaControls="ai-panel"
        onSend={onToggle}
        buttonRef={buttonRef}
        size={56}
        strokeWidth={2}
        armAt={44}
        maxPull={110}
        launchSpeed={2600}
        recoil={0.2}
        flight={120}
        particles={8}
        spread={60}
        axis="any"
        tapSends
        padColor="hsl(var(--color-accent))"
        iconColor="hsl(var(--color-accent-ink))"
        accentColor="hsl(var(--color-accent-2))"
        wellColor="hsl(var(--color-surface-2))"
        bandColor="hsl(var(--color-hairline-strong))"
      >
        {open ? <CloseIcon /> : <SparkleIcon />}
      </SlingButton>
    </div>
  );
}

/** The resting icon: an AI sparkle. Reads as "assistant", not "send". */
function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3C12.9 8.1 13.9 9.1 19 10C13.9 10.9 12.9 11.9 12 17C11.1 11.9 10.1 10.9 5 10C10.1 9.1 11.1 8.1 12 3Z" />
      <path d="M18 2.2C18.5 4.3 19.2 5 21.3 5.5C19.2 6 18.5 6.7 18 8.8C17.5 6.7 16.8 6 14.7 5.5C16.8 5 17.5 4.3 18 2.2Z" />
    </svg>
  );
}

/** Open state — matches the X the previous launcher showed. */
function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
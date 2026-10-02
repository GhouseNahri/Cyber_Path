'use client';

import type { Ref } from 'react';
import SlingButton from '@/components/ui/SlingButton';

/**
 * AIAssistantButton — the launcher for LEO, the Cyber_Path AI assistant.
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
 *
 * Colours follow the elastic metaphor in brand tones: the base band is a
 * translucent signal-teal (clearly visible on both canvases), the charged
 * band / power arc / particles take the violet accent, and the well sits one
 * surface step above the canvas with a faint band-coloured ring so it reads
 * as a recess without shouting.
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
    <div className="fixed bottom-8 right-5 z-40">
      <SlingButton
        ariaLabel={open ? 'Close LEO — Cyber_Path AI Assistant' : 'Open LEO — Cyber_Path AI Assistant'}
        ariaExpanded={open}
        ariaControls="ai-panel"
        onSend={onToggle}
        buttonRef={buttonRef}
        size={56}
        strokeWidth={2}
        armAt={44}
        maxPull={110}
        launchSpeed={2600}
        recoil={0.3}
        flight={120}
        particles={8}
        spread={60}
        axis="any"
        tapSends
        padColor="hsl(var(--color-accent))"
        iconColor="hsl(var(--color-accent-ink))"
        accentColor="hsl(var(--color-accent-2))"
        wellColor="hsl(var(--color-surface-3))"
        bandColor="hsl(var(--color-accent) / 0.55)"
      >
        {open ? <CloseIcon /> : <SparkleIcon />}
      </SlingButton>
    </div>
  );
}

/**
 * The resting icon: an AI sparkle.
 *
 * Geometry matters here. The first version centred each sparkle in the 24×24
 * box independently, which pushed the union off-centre (up and right) and made
 * the two shapes collide. These coordinates centre the *pair* optically inside
 * the pad and keep a clear gap between them.
 */
function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={26}
      height={26}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9.6 5.2C10.7 10.2 11.5 11 16.5 11.8 11.5 12.6 10.7 13.4 9.6 18.4 8.5 13.4 7.7 12.6 2.7 11.8 7.7 11 8.5 10.2 9.6 5.2Z" />
      <path d="M18.4 2.4C19 4.8 19.4 5.2 21.8 5.8 19.4 6.4 19 6.8 18.4 9.2 17.8 6.8 17.4 6.4 15 5.8 17.4 5.2 17.8 4.8 18.4 2.4Z" />
    </svg>
  );
}

/** Open state — matches the X the previous launcher showed. */
function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
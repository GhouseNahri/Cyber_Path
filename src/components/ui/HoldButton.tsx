"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * HoldButton — hold-to-confirm destructive action button (React Bits API).
 *
 * A pointer/keyboard hold fills the button over `holdTime`; releasing early
 * cancels and animates the fill back. Completing the hold fires `onHold`
 * exactly once, shows `doneLabel`, then resets. Zero dependencies: progress
 * is driven by one requestAnimationFrame loop. The label reveal uses a
 * clip-path overlay so the filled-state text never compresses.
 *
 * Accessibility: a real <button>; Space/Enter press-and-hold mirrors the
 * pointer contract; `prefers-reduced-motion` disables the wave/animation and
 * converts the hold into a single press (the surrounding dialog's staged
 * confirm remains the deliberate-action barrier). Announcements belong to the
 * calling dialog's live region — this button intentionally has none.
 */

export type HoldButtonProps = {
  children: React.ReactNode;
  /** Label swapped in while the completion state shows. */
  doneLabel?: string;
  /** Fired once when the hold completes. Guard against duplicates upstream. */
  onHold: () => void;
  /** Fill travel direction. */
  fillDirection?: "right" | "left";
  /** Total hold time in ms (default 2000). */
  holdTime?: number;
  /** Release-cancel animation tail in ms (default 200). */
  releaseTime?: number;
  /** Scale while actively holding. */
  pressScale?: number;
  /** Wave edge on the fill front. */
  wave?: boolean;
  waveAmplitude?: number;
  /** Glow under the fill while holding. */
  glow?: boolean;
  /** ms to keep the done state before reverting (default 1200). */
  resetAfter?: number;
  /** Disables interaction entirely (e.g. while the request is in flight). */
  disabled?: boolean;
  className?: string;
};

type Phase = "idle" | "holding" | "done";

export function HoldButton({
  children,
  doneLabel,
  onHold,
  fillDirection = "right",
  holdTime = 2000,
  releaseTime = 200,
  pressScale = 0.97,
  wave = false,
  waveAmplitude = 6,
  glow = false,
  resetAfter = 1200,
  disabled = false,
  className = "",
}: HoldButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0); // 0–100 fill
  const [reducedMotion, setReducedMotion] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const firedRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLButtonElement>(null);

  // prefers-reduced-motion: no wave, hold becomes a single deliberate press.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const complete = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    stopLoop();
    setProgress(100);
    setPhase("done");
    try {
      onHold();
    } finally {
      window.setTimeout(() => {
        firedRef.current = false;
        setProgress(0);
        setPhase("idle");
      }, resetAfter);
    }
  }, [onHold, resetAfter, stopLoop]);

  const cancelHold = useCallback(() => {
    if (phase !== "holding") return;
    stopLoop();
    activePointerRef.current = null;
    // Animate back over releaseTime.
    const started = performance.now();
    const from = progress;
    const step = (t: number) => {
      const k = Math.min(1, (t - started) / Math.max(1, releaseTime));
      const next = from * (1 - k);
      if (k < 1) {
        setProgress(next);
        rafRef.current = requestAnimationFrame(step);
      } else {
        setProgress(0);
        setPhase("idle");
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [phase, progress, releaseTime, stopLoop]);

  const beginHold = useCallback(() => {
    if (disabled || phase !== "idle" || reducedMotion) return;
    setPhase("holding");
    startRef.current = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - startRef.current) / holdTime);
      setProgress(k * 100);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        complete();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [complete, disabled, holdTime, phase, reducedMotion]);

  // Reduced motion: one deliberate click/Enter/Space press confirms. The
  // staged dialog around this button remains the deliberate-action barrier.
  useEffect(() => {
    if (!reducedMotion || phase !== "idle") return;
    const el = rootRef.current;
    if (!el) return;
    const onClick = () => {
      if (disabled) return;
      complete();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [complete, disabled, phase, reducedMotion]);

  useEffect(() => stopLoop, [stopLoop]);

  // ── Pointer handlers ────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || reducedMotion) return;
    if (e.button !== 0) return;
    activePointerRef.current = e.pointerId;
    // Capture so a drag off the button still ends here, not elsewhere.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    beginHold();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    cancelHold();
  };
  const onPointerCancel = () => {
    if (activePointerRef.current === null && phase !== "holding") return;
    activePointerRef.current = null;
    cancelHold();
  };

  // ── Keyboard hold (Space/Enter) mirrors the pointer contract ────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || reducedMotion) return;
    if ((e.key === " " || e.key === "Enter") && !e.repeat && phase === "idle") {
      e.preventDefault(); // stop native click; we drive the hold ourselves
      beginHold();
    }
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (reducedMotion) return;
    if (e.key === " " || e.key === "Enter") {
      cancelHold();
    }
  };

  const holding = phase === "holding";
  const label = phase === "done" && doneLabel ? doneLabel : children;
  // Reveal overlay: show the filled-state label only where the fill passed.
  const clip = `inset(0 ${fillDirection === "right" ? 100 - progress : progress}% 0 0)`;
  const waveStyle: React.CSSProperties =
    wave && holding
      ? {
          maskImage: `url("data:image/svg+xml,${encodeURIComponent(buildWaveMask(waveAmplitude))}")`,
          WebkitMaskImage: `url("data:image/svg+xml,${encodeURIComponent(buildWaveMask(waveAmplitude))}")`,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }
      : {};

  return (
    <button
      ref={rootRef}
      type="button"
      disabled={disabled || phase === "done"}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onContextMenu={(e) => e.preventDefault()}
      aria-disabled={disabled || phase === "done"}
      className={`relative inline-flex w-full select-none items-center justify-center overflow-hidden rounded-xl border font-medium tracking-tight transition-[transform,box-shadow] duration-150 ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:pointer-events-none disabled:opacity-60 sm:w-auto ${
        glow && holding ? "shadow-[0_0_24px_-4px_hsl(var(--color-danger)/0.55)]" : holding ? "" : "shadow-rest"
      } ${className}`}
      style={{
        transform: holding ? `scale(${pressScale})` : undefined,
        backgroundColor: "hsl(var(--color-danger) / 0.15)",
        borderColor: "hsl(var(--color-danger) / 0.3)",
        color: "hsl(var(--color-danger))",
      }}
    >
      {/* Layer 0 — idle label (danger ink on the tinted background) */}
      <span className="relative z-0 px-5 py-2.5">{label}</span>

      {/* Layer 1 — the fill itself */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 z-10"
        style={{
          [fillDirection === "right" ? "left" : "right"]: 0,
          width: `${progress}%`,
          backgroundColor: "hsl(var(--color-danger))",
          transition: phase === "idle" ? `width ${releaseTime}ms var(--ease-out-expo)` : undefined,
          ...waveStyle,
        }}
      />

      {/* Layer 2 — clipped copy of the label in on-danger ink */}
      <span
        aria-hidden="true"
        className="absolute inset-0 z-20 flex items-center justify-center whitespace-nowrap px-5"
        style={{ color: "hsl(var(--color-danger-ink))", clipPath: clip }}
      >
        {label}
      </span>
    </button>
  );
}

/** Small SVG wave used as the fill's trailing edge mask. */
function buildWaveMask(amplitude: number): string {
  const a = Math.max(2, amplitude);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" preserveAspectRatio="none"><path d="M0 0 H112 Q${120 - a / 2} 20 112 40 H0 Z" fill="black"/></svg>`;
}

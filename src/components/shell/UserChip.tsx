"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserChipProps = {
  email: string | null;
  displayName: string | null;
  fallbackInitial: string;
};

/** Avatar + menu in the app topbar: name, Settings link, Sign out. */
export function UserChip({ email, displayName, fallbackInitial }: UserChipProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.replace("/login");
  }

  const label = displayName || email || "Account";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${label}`}
        className="flex items-center gap-2.5 rounded-xl border border-hairline bg-surface-2 py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-hairline-strong"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-[12px] font-bold text-accent-ink">
          {fallbackInitial}
        </span>
        <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-ink-high sm:block">
          {label}
        </span>
        <svg viewBox="0 0 24 24" fill="none" className="size-3.5 text-ink-medium" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-xl border border-hairline bg-canvas-raised shadow-lift"
        >
          <div className="border-b border-hairline px-4 py-3">
            <p className="truncate text-[13px] font-medium text-ink-high">{displayName ?? "Account"}</p>
            {email ? <p className="mt-0.5 truncate text-xs text-ink-medium">{email}</p> : null}
          </div>
          <a
            role="menuitem"
            href="/settings"
            className="block px-4 py-2.5 text-[13px] text-ink-medium transition-colors hover:bg-surface-2 hover:text-ink-high"
          >
            Settings
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            className="block w-full px-4 py-2.5 text-left text-[13px] text-danger transition-colors hover:bg-danger/10"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

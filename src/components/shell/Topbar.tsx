"use client";

import { ThemeToggle } from "../ThemeToggle";
import { BrandMark } from "./Sidebar";

type TopbarProps = {
  onOpenMenu: () => void;
  children?: React.ReactNode;
};

/** Mobile topbar: brand + drawer trigger + theme toggle + user chip.
 *  Hidden ≥ lg where the desktop header row (rendered by the page layout)
 *  takes over. */
export function Topbar({ onOpenMenu, children }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-hairline bg-canvas/80 px-4 backdrop-blur-md lg:hidden">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          aria-expanded="false"
          className="inline-flex size-9 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-ink-medium transition-colors hover:text-ink-high"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
        <BrandMark />
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}

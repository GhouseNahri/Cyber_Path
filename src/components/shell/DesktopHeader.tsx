"use client";

import { ThemeToggle } from "../ThemeToggle";
import { UserChip } from "./UserChip";

type DesktopHeaderProps = {
  user: { email?: string | null; user_metadata?: Record<string, unknown> } | null;
};

/** Desktop-only header row (≥ lg): user chip + theme toggle, right-aligned. */
export function DesktopHeader({ user }: DesktopHeaderProps) {
  const meta = user?.user_metadata ?? {};
  const rawName = meta["display_name"];
  const name = typeof rawName === "string" && rawName.length > 0 ? rawName : null;
  const email = user?.email ?? null;
  const initial = (name ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="mb-6 flex items-center justify-end gap-2 max-lg:hidden">
      {user ? <UserChip email={email} displayName={name} fallbackInitial={initial} /> : null}
      <ThemeToggle />
    </div>
  );
}

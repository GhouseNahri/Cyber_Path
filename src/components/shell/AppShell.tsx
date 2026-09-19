"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { UserChip } from "./UserChip";

type AppShellProps = {
  children: React.ReactNode;
  user: { email?: string | null; user_metadata?: Record<string, unknown> } | null;
};

function displayNameOf(user: NonNullable<AppShellProps["user"]>): string | null {
  const meta = user.user_metadata ?? {};
  const name = meta["display_name"];
  return typeof name === "string" && name.length > 0 ? name : null;
}

/** Client wrapper holding mobile-drawer state; children stay server-rendered. */
export function AppShell({ children, user }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const name = user ? displayNameOf(user) : null;
  const email = user?.email ?? null;
  const initial = (name ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)}>
          {user ? <UserChip email={email} displayName={name} fallbackInitial={initial} /> : null}
        </Topbar>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
        <footer className="border-t border-hairline px-4 py-4 text-center text-[11px] text-ink-low sm:px-6 lg:px-10">
          Cyber_Path — built phase by phase. Learn → Practice → Test → Build → Review → Demonstrate.
        </footer>
      </div>
    </div>
  );
}

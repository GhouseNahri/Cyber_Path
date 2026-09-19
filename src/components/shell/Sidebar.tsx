"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { Badge } from "../ui/Badge";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Brand mark — shield + path motif, no external assets. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Cyber_Path home">
      <span className="relative flex size-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent to-accent-2 text-accent-ink shadow-rest">
        <svg viewBox="0 0 24 24" fill="none" className="size-[17px]" aria-hidden="true">
          <path d="M12 3.5 5 6.2v5.1c0 4.6 3 7.6 7 9.2 4-1.6 7-4.6 7-9.2V6.2L12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 11.8l2.1 2.1 4-4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[15px] font-semibold tracking-tight text-ink-high">
          Cyber<span className="text-accent">_</span>Path
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-hairline bg-canvas-raised lg:flex">
      <div className="flex h-16 items-center border-b border-hairline px-5">
        <BrandMark />
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const future = item.phase !== 1;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={item.description}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-surface-3 text-ink-high shadow-rest"
                  : "text-ink-medium hover:bg-surface-2 hover:text-ink-high"
              }`}
            >
              <span className={active ? "text-accent" : "text-ink-low group-hover:text-ink"} aria-hidden="true">
                {item.icon}
              </span>
              <span className="flex-1 truncate font-medium">{item.label}</span>
              {future && <Badge tone="neutral">P{item.phase}</Badge>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-hairline p-4">
        <p className="text-[11px] leading-relaxed text-ink-low">
          Phase 1 — foundation. Auth and data arrive with Supabase in Phases 2–3.
        </p>
      </div>
    </aside>
  );
}

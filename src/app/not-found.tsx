import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-ink-low">404 — nothing here</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-high">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-medium">
        The link may be old, mistyped, or the portfolio you&apos;re looking for is private.
        Portfolios only appear when their owner has made them public.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Back to Cyber_Path
      </Link>
    </main>
  );
}

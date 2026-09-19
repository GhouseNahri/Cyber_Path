import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui";

export const metadata: Metadata = { title: "Check your email" };

/** Shown when email confirmation is enabled in Supabase and no session
 *  exists yet after signup. Not reachable in the default dev configuration. */
export default function CheckEmailPage() {
  return (
    <div className="w-full max-w-md">
      <div className="surface-card surface-glow p-8 text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" className="size-5">
            <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="m4.5 7.5 7.5 5.5 7.5-5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="font-display text-xl font-semibold text-ink-high">Confirm your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-medium">
          We sent a confirmation link to your inbox. Click it to activate your account, then sign in.
        </p>
        <div className="mt-6">
          <Link href="/login" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

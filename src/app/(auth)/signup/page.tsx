import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="w-full max-w-md">
      <div className="surface-card surface-glow p-6 sm:p-8">
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink-high">Create your account</h1>
        <p className="mt-1.5 text-sm text-ink-medium">
          One account, your entire learning command center. No spam, minimal data.
        </p>
        <div className="mt-6">
          <SignupForm />
        </div>
      </div>
      <p className="mt-5 text-center text-[13px] text-ink-medium">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

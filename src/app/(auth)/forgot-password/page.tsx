import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="surface-card surface-glow p-6 sm:p-8">
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink-high">Reset your password</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-medium">
          Enter your account email and we&apos;ll send a reset link. The link opens the
          app and lands on a page where you choose a new password.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
      </div>
      <p className="mt-5 text-center text-[13px]">
        <Link href="/login" className="text-ink-medium hover:text-ink-high hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

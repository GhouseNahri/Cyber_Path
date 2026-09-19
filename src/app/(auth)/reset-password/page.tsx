import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="surface-card surface-glow p-6 sm:p-8">
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink-high">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-ink-medium">Pick something strong and unique.</p>
        <div className="mt-6">
          <ResetPasswordForm />
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

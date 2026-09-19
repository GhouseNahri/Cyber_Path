import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <div className="surface-card surface-glow p-6 sm:p-8">
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink-high">Welcome back</h1>
        <p className="mt-1.5 text-sm text-ink-medium">Sign in to continue your path.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
      <p className="mt-5 text-center text-[13px] text-ink-medium">
        New here?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
        {" · "}
        <Link href="/forgot-password" className="text-ink-medium hover:text-ink-high hover:underline">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}

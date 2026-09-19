import Link from "next/link";
import { buttonClasses } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="surface-card surface-glow mx-auto max-w-lg p-10 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-2 font-display text-xl font-semibold text-ink-high">Path not found</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-medium">
        This route doesn&apos;t exist — every good reconnaissance effort has its limits.
      </p>
      <div className="mt-6">
        <Link href="/" className={buttonClasses({ variant: "primary", size: "sm" })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

"use client";

import { ErrorState } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-10">
      <ErrorState
        title="Something went wrong"
        message="An unexpected error occurred. Your data is safe — try again in a moment."
        reset={reset}
      />
    </div>
  );
}

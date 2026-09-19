import type { Metadata } from "next";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Welcome to Cyber_Path</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Let&apos;s shape your <span className="text-gradient">learning path</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-medium">
            Four quick questions. They tune your daily missions, recommendations and roadmap
            emphasis — you can change everything later in Settings.
          </p>
        </div>
        <OnboardingWizard />
      </div>
    </main>
  );
}

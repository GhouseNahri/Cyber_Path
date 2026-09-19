import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Your app, your rules</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          Profile, timezone, daily goal, study schedule, theme, notifications, data export
          and account deletion. Account features arrive with authentication in Phase 2.
        </p>
      </section>
      <Card>
        <CardHeader title="Settings" subtitle="Profile · Goals · Appearance · Notifications · Data" action={<Badge tone="accent">Phase 2</Badge>} />
        <EmptyState
          title="Settings unlock with your account"
          body="Sign-up, login and password reset are built next with Supabase Auth. Theme preference already persists locally — the account-level version arrives with your profile."
          className="border-none bg-transparent"
        />
      </Card>
    </div>
  );
}

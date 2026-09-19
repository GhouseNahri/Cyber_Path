import type { Metadata } from "next";
import { Card, CardHeader, Badge } from "@/components/ui";
import { getProfile, getUser } from "@/lib/profile";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [user, profile] = await Promise.all([getUser(), getProfile()]);

  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Your app, your rules</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Profile & preferences"
              subtitle="Drives your dashboard, missions and recommendations"
            />
            {profile && user ? (
              <SettingsForm profile={profile} email={user.email ?? ""} />
            ) : (
              <p className="text-sm text-danger">Profile could not be loaded. Refresh the page.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Account" subtitle="Managed by Supabase Auth" />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-ink-medium">Email</dt>
                <dd className="mt-0.5 truncate font-mono text-[13px] text-ink-high">{user?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-ink-medium">User ID</dt>
                <dd className="mt-0.5 truncate font-mono text-[13px] text-ink-medium">{user?.id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-ink-medium">Member since</dt>
                <dd className="mt-0.5 text-[13px] text-ink-high">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                    : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 rounded-lg border border-hairline bg-surface-2/60 p-3 text-xs leading-relaxed text-ink-medium">
              Password changes and account deletion arrive with the Phase 16 security pass — they
              touch auth credentials and deserve careful handling.
            </p>
          </Card>

          <Card>
            <CardHeader title="Appearance" subtitle="Theme preference is saved on this device" />
            <p className="text-[13px] leading-relaxed text-ink-medium">
              Use the sun/moon toggle in the header. Your choice persists locally; account-level
              theme sync across devices arrives with the notification/preferences phase.
            </p>
            <div className="mt-3">
              <Badge tone="neutral">Dark & light supported</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

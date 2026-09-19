import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { DesktopHeader } from "@/components/shell/DesktopHeader";
import { getProfile, getUser } from "@/lib/profile";

/** Everything in the (app) group requires: a valid session AND completed
 *  onboarding. Onboarding lives in its own (onboarding) group with an
 *  auth-only layout, so this gate cannot loop. */
export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");

  return (
    <AppShell user={user}>
      <DesktopHeader user={user} />
      {children}
    </AppShell>
  );
}

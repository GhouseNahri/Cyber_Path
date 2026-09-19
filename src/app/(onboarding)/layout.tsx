import { redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/profile";

/** Auth-only group: signed-in users without completed onboarding land here.
 *  Users who already finished onboarding are bounced to the dashboard. */
export default async function OnboardingGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (profile?.onboarding_completed) redirect("/");

  return <>{children}</>;
}

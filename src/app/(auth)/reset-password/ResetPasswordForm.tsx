"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  // Supabase lands the user here with a recovery session established by the
  // URL fragment (#access_token=...). Give the client a moment to pick it up,
  // then decide what to render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setReady(Boolean(user));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.refresh();
      router.replace("/onboarding");
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  if (ready === null) {
    return <div className="skeleton h-40 w-full rounded-xl" aria-label="Loading" role="status" />;
  }

  if (!ready) {
    return (
      <div className="rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm leading-relaxed text-warn" role="alert">
        <p className="font-medium">This reset link is invalid or expired.</p>
        <p className="mt-1 text-[13px]">Request a fresh one from the “Forgot password?” page — links are single-use.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input
        label="New password"
        type="password"
        name="new-password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={busy}
        required
      />
      <Input
        label="Confirm new password"
        type="password"
        name="confirm-new-password"
        autoComplete="new-password"
        placeholder="Repeat your new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={busy}
        required
      />
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Updating…" : "Save new password"}
      </Button>
    </form>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): string | null {
    if (displayName.trim().length < 2) return "Enter your name (at least 2 characters).";
    if (!USERNAME_RE.test(username.trim()))
      return "Username must be 3–24 characters: letters, numbers or underscores.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords don't match.";
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim(), username: username.trim().toLowerCase() },
          emailRedirectTo: `${location.origin}/onboarding`,
        },
      });
      if (error) throw error;

      // Email confirmation OFF (our dev default): a session exists right away.
      // If confirmation is ON, data.session is null and we show the check-inbox step.
      if (!data.session) {
        router.push("/signup/check-email");
        return;
      }

      router.refresh();
      router.replace("/onboarding");
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input
        label="Name"
        name="name"
        autoComplete="name"
        placeholder="Ghouse"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        disabled={busy}
        required
      />
      <Input
        label="Username"
        name="username"
        autoComplete="username"
        placeholder="ghouse_n"
        hint="Letters, numbers, underscores. 3–24 characters."
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        disabled={busy}
        required
      />
      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={busy}
        required
      />
      <Input
        label="Password"
        type="password"
        name="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        hint="Use something unique — this is your learning vault."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={busy}
        required
      />
      <Input
        label="Confirm password"
        type="password"
        name="confirm-password"
        autoComplete="new-password"
        placeholder="Repeat your password"
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
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

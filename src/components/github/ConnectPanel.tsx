"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { disconnectGithub, saveGithubConnection, setPortfolioPublic } from "@/lib/github/actions";

type Props = {
  connection: { githubLogin: string; connectedAt: string; lastSyncedAt: string | null } | null;
  portfolioPublic: boolean;
  username: string | null;
};

export function ConnectPanel({ connection, portfolioPublic, username }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(portfolioPublic);

  // Surface OAuth errors Supabase appends to the redirect (?error=…).
  // Read once at first render (lazy state — no effect-setState), then the
  // effect only cleans the address bar. Without this the failed round-trip
  // looked like "Connect does nothing".
  const [oauthError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const e = params.get("error_description") ?? params.get("error");
    return e ? `GitHub authorization did not complete: ${e.slice(0, 200)}` : null;
  });

  useEffect(() => {
    if (oauthError && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [oauthError]);

  /** Step 1: open GitHub consent (Supabase OAuth). The page navigates away
   *  and returns with ?… ; the token is then captured server-side. */
  function connect() {
    setError(null);
    setNotice(null);
    const supabase = createClient();
    startTransition(async () => {
      const { error: err } = await supabase.auth.linkIdentity({
        provider: "github",
        options: { redirectTo: `${window.location.origin}/github` },
      });
      if (err) setError(err.message || "Could not start GitHub authorization.");
    });
  }

  /** Step 2 (on return): persist the provider_token from the session. */
  function capture() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await saveGithubConnection();
      if (res.ok) setNotice("GitHub connected.");
      else setError(res.error);
    });
  }

  function disconnect() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await disconnectGithub();
      if (!res.ok) setError(res.error);
    });
  }

  function togglePublic() {
    setError(null);
    setNotice(null);
    const next = !isPublic;
    setIsPublic(next);
    startTransition(async () => {
      const res = await setPortfolioPublic(next);
      if (!res.ok) {
        setIsPublic(!next); // roll back
        setError(res.error);
      } else {
        setNotice(next ? "Portfolio is now public." : "Portfolio is private again.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {!connection ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="md" disabled={pending} onClick={connect}>
            Connect GitHub
          </Button>
          <Button variant="secondary" size="md" disabled={pending} onClick={capture}>
            I just approved — finish connecting
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="ok">connected as {connection.githubLogin}</Badge>
          <Button variant="secondary" size="sm" disabled={pending} onClick={capture}>
            Refresh token
          </Button>
          <Button variant="danger" size="sm" disabled={pending} onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      )}

      {connection ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-2/40 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-ink-high">Public portfolio page</p>
            <p className="text-[12px] text-ink-low">
              {username
                ? `Shares only finished projects, career paths and skill evidence at /portfolio/${username}`
                : "Set a username in Settings first to get a portfolio URL"}
            </p>
          </div>
          <Button variant={isPublic ? "secondary" : "primary"} size="sm" disabled={pending || !username} onClick={togglePublic}>
            {isPublic ? "Make private" : "Make public"}
          </Button>
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-lg border border-ok/30 bg-ok/[0.07] px-3 py-2 text-[13px] text-ok">
          {notice}
        </p>
      ) : null}
      {(error ?? oauthError) ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/[0.07] px-3 py-2 text-[13px] text-danger">
          {error ?? oauthError}
        </p>
      ) : null}
    </div>
  );
}

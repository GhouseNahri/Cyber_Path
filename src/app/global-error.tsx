"use client";

/**
 * global-error is the last line of defense: it renders when the root layout
 * itself fails, so it must ship its own <html>/<body> and cannot rely on the
 * theme, fonts, or globals.css. Inline styles only — no Tailwind, no classes
 * from the design system.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0d14", color: "#e6e9f2", fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8a93a8" }}>
            Cyber_Path — unexpected error
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "12px 0 8px" }}>Something broke at the root</h1>
          <p style={{ maxWidth: 420, lineHeight: 1.6, fontSize: 14, color: "#aab2c5" }}>
            Your learning data is safe on the server — this is a rendering failure, not data loss. Reloading usually
            fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              background: "#5b8cff",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload Cyber_Path
          </button>
        </main>
      </body>
    </html>
  );
}

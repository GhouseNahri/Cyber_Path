import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "../styles/globals.css";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: {
    default: "Cyber_Path — Cybersecurity Learning Command Center",
    template: "%s · Cyber_Path",
  },
  description:
    "A personal cybersecurity learning roadmap: structured phases, real study sessions, streaks, labs, projects and career paths.",
  applicationName: "Cyber_Path",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0d14" },
    { media: "(prefers-color-scheme: light)", color: "#f1f3f9" },
  ],
};

/** Inline, before-paint theme init: dark default, stored choice wins.
 *  Removes the light class only (never adds inline styles) so SSR markup
 *  and the first client render always agree — no hydration mismatch. */
const themeInit = `(function(){try{var s=localStorage.getItem("cyberpath.theme");if(s==="light")document.documentElement.classList.remove("dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          Skip to main content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

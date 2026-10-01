/**
 * Built-in simulation scenarios. Each scenario is a self-contained teaching
 * environment: an initial filesystem, the user's identity, a goal condition
 * (checked server-side after every command) and a completion check.
 *
 * Pure — scenarios never touch the DB. The actions layer (sim.ts) persists
 * state per user and turns goal success into lab completion.
 */
import { runCommand, type SimState } from "./commands";
import { ANALYSIS_SCENARIOS } from "./analysis-scenarios";
import { dir, file, nodeAtPath, octalOf, resetIds, type FsNode } from "./vfs";

export type SimGoal = {
  id: string;
  /** Shown in the UI as the current objective. */
  description: string;
  /** Pure check against the state after each command. */
  check: (state: SimState) => boolean;
};

export type SimScenario = {
  key: string;
  title: string;
  /** One-line intro printed when the terminal starts. */
  brief: string;
  /** Teaching bullets the UI shows alongside the terminal. */
  notes: string[];
  initial: () => SimState;
  goals: SimGoal[];
};

// ── helpers ───────────────────────────────────────────────────────────────

function stateFor(root: FsNode, username: string, groups: string[], isRoot = false): SimState {
  const home = isRoot ? "/root" : `/home/${username}`;
  return { root, cwd: home, user: { username, groups, is_root: isRoot } };
}

function path(state: SimState, p: string): FsNode | null {
  return nodeAtPath(state.root, p);
}

// ── scenario 1: linux permissions ─────────────────────────────────────────

function permsInitial(): SimState {
  resetIds();
  const root = dir("/", "root", "root", "755", [
    dir("home", "root", "root", "755", [
      dir(
        "kai",
        "kai",
        "kai",
        "750",
        [
          // The mission files — badly permissioned on purpose.
          file("shared-notes.txt", "kai", "kai", "666", "Meeting notes: the staging box reboots nightly at 02:00.\n"),
          file("backup-credentials.txt", "kai", "backups", "604", "STAGING-BACKUP-TOKEN (sample, not real): rotate-me-please-42\n"),
          dir("scripts", "kai", "kai", "770", [
            file("rotate-backup.sh", "kai", "backups", "775", "#!/bin/bash\ntar -czf /var/backups/staging.tgz /srv/staging\n"),
          ]),
          file(".hidden-plan.txt", "kai", "kai", "600", "1. fix the shared-notes permissions\n2. lock the credentials file to owner+group\n3. keep scripts group-executable\n"),
        ],
      ),
      dir("sam", "sam", "sam", "750", [file("sam-readme.txt", "sam", "sam", "640", "Sam's private notes.\n")]),
    ]),
    dir("srv", "root", "backups", "750", [file("staging.list", "root", "backups", "640", "/srv/staging\n/etc/nginx\n")]),
    dir("root", "root", "root", "700", []),
  ]);
  return stateFor(root, "kai", ["kai", "backups"]);
}

const permsGoals: SimGoal[] = [
  {
    id: "no-world-write",
    description: "Make shared-notes.txt NOT writable by others (remove world-write).",
    check: (s) => {
      const n = path(s, "/home/kai/shared-notes.txt");
      return !!n && !n.other.includes("w");
    },
  },
  {
    id: "creds-locked",
    description: "Lock backup-credentials.txt so group backups can read it, others get nothing (640).",
    check: (s) => {
      const n = path(s, "/home/kai/backup-credentials.txt");
      if (!n) return false;
      return octalOf(n) === "640";
    },
  },
  {
    id: "script-not-world-exec",
    description: "scripts/rotate-backup.sh must stay executable by group backups but NOT by others (e.g. 750).",
    check: (s) => {
      const n = path(s, "/home/kai/scripts/rotate-backup.sh");
      if (!n) return false;
      return !n.other.includes("x") && n.group.includes("x");
    },
  },
  {
    id: "verify-sam-denied",
    description: "Prove sam cannot read your files: try to cd into sam's home and observe the denial.",
    check: (s) => (s as SimStateWithFlags).flags?.visitedDenial === true,
  },
  {
    id: "verify-sudo-denied",
    description: "Prove you are not root: run a command only root may run (chown) and observe the denial.",
    check: (s) => (s as SimStateWithFlags).flags?.sawChownDenial === true,
  },
];

// The scenario tracks denials on the state object (non-enumerable extras live
// in `flags` so JSON persistence stays clean).
type Flags = {
  visitedDenial?: boolean;
  sawChownDenial?: boolean;
  sawDotfile?: boolean;
  foundSvcFiles?: boolean;
  greppedToken?: boolean;
  readReport?: boolean;
};

// ── scenario 2: linux file hunt ───────────────────────────────────────────

function huntInitial(): SimState {
  resetIds();
  const root = dir("/", "root", "root", "755", [
    dir("home", "root", "root", "755", [
      dir("kai", "kai", "kai", "750", [
        file("todo.txt", "kai", "kai", "644", "1. find the misplaced token\n2. learn find -name and -size\n3. grep the content\n"),
        dir("downloads", "kai", "kai", "755", [
          file("report-v1.txt", "kai", "kai", "644", "Draft report. Nothing interesting here.\n"),
          file("report-v2.txt", "kai", "kai", "644", "Final report. The Token is stored in the vault file.\n"),
          file("notes-old.txt", "kai", "kai", "644", "old scratch notes\n"),
        ]),
        dir("incidents", "kai", "kai", "750", [
          file("2026-09-12-phishing.txt", "kai", "kai", "640", "Phish reported, link taken down, user coached.\n"),
          file("2026-09-28-laptop.md", "kai", "kai", "640", "Laptop lost; wiped remotely. MDM confirmed.\n"),
        ]),
      ]),
      dir("svc", "svc", "svc", "755", [
        file(".deploy-token.txt", "svc", "svc", "600", "Sample deploy token — rotate after the exercise (not a real secret).\n"),
        file("svc.log", "svc", "svc", "644", "service started\nservice ready\n"),
      ]),
    ]),
    dir("var", "root", "root", "755", [
      dir("log", "root", "root", "755", [file("boot.log", "root", "root", "644", "system boot ok\n")]),
    ]),
  ]);
  return stateFor(root, "kai", ["kai"]);
}

const huntGoals: SimGoal[] = [
  {
    id: "find-hidden",
    description: "Find the hidden file inside /home/svc using ls -a (its name starts with a dot).",
    check: (s) => s.flags?.sawDotfile === true,
  },
  {
    id: "find-by-user",
    description: "List every file owned by user svc under /home using find -user svc.",
    check: (s) => s.flags?.foundSvcFiles === true,
  },
  {
    id: "grep-token",
    description: "Use grep to locate which file mentions 'Token' under your own downloads.",
    check: (s) => s.flags?.greppedToken === true,
  },
  {
    id: "read-it",
    description: "Read the file you found with grep and confirm what it says (cat).",
    check: (s) => s.flags?.readReport === true,
  },
];

// ── scenario bookkeeping (flags + denials are tracked on the state) ───────

/**
 * Augment state with teaching flags. We keep them on a `flags` bag so the
 * state stays JSON-serializable for persistence in lab_sim_states.
 */
export type SimStateWithFlags = SimState & { flags?: Flags };

function flagCommandResult(state: SimStateWithFlags, res: ReturnType<typeof runCommand>, raw: string): void {
  const line = raw.trim().toLowerCase();
  const flags = state.flags ?? (state.flags = {});
  if (res.ok && (line.startsWith("ls -a") || line.startsWith("ls -la") || line.startsWith("ls -al")) && line.includes("/home/svc")) {
    flags.sawDotfile = true;
  }
  if (res.ok && line.startsWith("find") && line.includes("-user svc")) {
    flags.foundSvcFiles = true;
  }
  if (line.startsWith("grep") && line.includes("token")) {
    flags.greppedToken = res.ok;
  }
  if (res.ok && line.startsWith("cat") && (line.includes("report-v2") || line.includes("vault"))) {
    flags.readReport = true;
  }
  if (!res.ok && (line.startsWith("cd /home/sam") || line.startsWith("cd ~sam"))) {
    flags.visitedDenial = true;
  }
  if (!res.ok && line.startsWith("chown")) {
    flags.sawChownDenial = true;
  }
}

/**
 * L3 analysis-scenario flags (SOC / DNS / forensics). Kept here — next to
 * the dispatcher — rather than in analysis-scenarios.ts, so there is no
 * import cycle between the two modules.
 */
function analysisFlags(state: SimStateWithFlags, raw: string, res: ReturnType<typeof runCommand>): void {
  const line = raw.trim().toLowerCase();
  const flags = state.flags ?? (state.flags = {});
  // SOC: SSH brute-force triage
  if (res.ok && line.startsWith("grep -c") && line.includes("failed password")) flags.countedFailures = true;
  if (res.ok && line.startsWith("grep") && line.includes("198.51.100.77")) flags.identifiedAttacker = true;
  if (res.ok && line.startsWith("grep") && line.includes("accepted")) flags.spottedSuccess = true;
  if (res.ok && line.startsWith("cat") && line.includes("auth.log")) flags.readSudo = true;
  if (res.ok && line.startsWith("notes ")) flags.wroteVerdict = true;
  // DNS: exfiltration hunt
  if (res.ok && line.startsWith("grep") && line.includes("exfil") && !line.startsWith("grep -c")) flags.noticedBurst = true;
  if (res.ok && line.startsWith("grep -c") && line.includes("exfil")) flags.countedExfil = true;
  if (res.ok && line.startsWith("grep") && line.includes("10.0.2.99")) flags.identifiedClient = true;
  if (res.ok && line.startsWith("cat") && line.includes("dns.log")) flags.sawNormal = true;
  // Forensics: timeline reconstruction
  if (res.ok && line.startsWith("stat ")) flags.statedFiles = true;
  if (res.ok && line.startsWith("cat") && line.includes(".bash_history")) flags.readHistory = true;
  if (res.ok && line.startsWith("cat") && line.includes("invoice")) flags.firstAction = true;
  if (res.ok && (line.startsWith("grep") || line.startsWith("cat")) && line.includes("203.0.113.9")) flags.foundC2 = true;
}

/** Run one command in a scenario, updating flags + returning the result. */
export function scenarioCommand(
  scenario: SimScenario,
  state: SimStateWithFlags,
  raw: string,
): { output: string[]; ok: boolean; state: SimStateWithFlags; goalsDone: string[] } {
  const res = runCommand(state, raw);
  flagCommandResult(state, res, raw);
  analysisFlags(state, raw, res);
  const next: SimStateWithFlags = res.state ? { ...state, ...res.state } : state;
  const goalsDone = scenario.goals.filter((g) => safeCheck(g.check, next)).map((g) => g.id);
  return { output: res.output, ok: res.ok, state: next, goalsDone };
}

function safeCheck(check: (s: SimState) => boolean, s: SimStateWithFlags): boolean {
  try {
    return check(s as SimState);
  } catch {
    return false;
  }
}

// ── registry ──────────────────────────────────────────────────────────────

export const SIM_SCENARIOS: Record<string, SimScenario> = {
  ...ANALYSIS_SCENARIOS,
  "linux-permissions": {
    key: "linux-permissions",
    title: "Permission repair drill",
    brief:
      "You are kai. Your home directory has real permission problems. Fix them with chmod/chown/chgrp — and prove you understand denials.",
    notes: [
      "Start with ls -l to see current permissions.",
      "chmod takes an octal mode: 640 = rw- r-- ---.",
      "Only the file's owner (or root) may chmod it — you are not root, and that is the point.",
      "Denials are data: the goals require you to trigger and observe them.",
    ],
    initial: permsInitial,
    goals: permsGoals,
  },
  "linux-file-hunt": {
    key: "linux-file-hunt",
    title: "Hidden files and find",
    brief:
      "You are kai. Somewhere under /home there is a hidden token file and files owned by another user. Find them — without touching anything outside your lab.",
    notes: [
      "ls -a reveals dotfiles.",
      "find <path> -user <name> lists ownership; -name and -size filter further.",
      "grep <pattern> <file> searches inside a file once you find it.",
      "Everything here is simulated — no real system is touched.",
    ],
    initial: huntInitial,
    goals: huntGoals,
  },
};

export function getScenario(key: string): SimScenario | null {
  return SIM_SCENARIOS[key] ?? null;
}

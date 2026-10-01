/**
 * Simulated command set for built-in labs: ls, cd, pwd, cat, chmod, chown,
 * chgrp, find, grep, head, whoami, id, help. Pure — each command is a
 * function from (state, argv) to (output, next state). A real shell is
 * never involved; unknown or dangerous input is rejected explicitly.
 */
import {
  basename,
  can,
  canListPath,
  canReadPath,
  canTraverse,
  flatten,
  normalizePath,
  nodeAtPath,
  octalOf,
  parentPath,
  permClassOf,
  resolve,
  withOwnership,
  withPermissions,
  type FsNode,
  type SimUser,
} from "./vfs";

export type SimState = {
  root: FsNode;
  cwd: string;
  user: SimUser;
  /** Optional teaching-flags bag (populated by scenarios; ignored here). */
  flags?: Record<string, boolean | undefined>;
};

export type CommandResult = {
  ok: boolean;
  /** Lines to append to the terminal. */
  output: string[];
  /** Next state when the command mutated the filesystem or cwd. */
  state?: SimState;
  /** Non-zero-style failure note (teaching-honest). */
  error?: string;
};

export const SIM_COMMANDS = [
  "ls",
  "cd",
  "pwd",
  "cat",
  "chmod",
  "chown",
  "chgrp",
  "find",
  "grep",
  "head",
  "stat",
  "wc",
  "notes",
  "whoami",
  "id",
  "groups",
  "help",
  "clear",
] as const;

export type SimCommand = (typeof SIM_COMMANDS)[number];

// ── small helpers ─────────────────────────────────────────────────────────

function isDir(n: FsNode | null): n is FsNode & { kind: "directory" } {
  return n?.kind === "directory";
}

function modeString(n: FsNode): string {
  const t = (s: string) => `${s}${n.kind === "directory" ? "x" : "-"}`.replace(/^-/, "-");
  // ls-style: "drwxr-x---" for dirs, "-rw-r-----" for files
  return `${n.kind === "directory" ? "d" : "-"}${n.user}${n.group}${n.other}`.replace(/x(?![^-]*x-)/, (m) => m);
}

// ── ls ────────────────────────────────────────────────────────────────────

function runLs(state: SimState, argv: string[]): CommandResult {
  const long = argv.some((a) => a === "-l" || a === "-la" || a === "-al");
  const all = argv.some((a) => a === "-a" || a === "-la" || a === "-al");
  const targetArg = argv.find((a) => !a.startsWith("-"));
  const target = targetArg ? normalizePath(state.cwd, targetArg) : state.cwd;

  const dirNode = nodeAtPath(state.root, target);
  if (!dirNode) return { ok: false, output: [`ls: ${targetArg ?? ""}: No such file or directory`], error: "not found" };
  if (!isDir(dirNode)) {
    // ls on a file prints the file.
    return { ok: true, output: [targetArg ?? dirNode.name] };
  }
  const listCheck = canListPath(state.root, target, state.user);
  if (!listCheck.ok) {
    return { ok: false, output: [`ls: cannot open directory '${targetArg ?? "/"}': Permission denied`], error: listCheck.reason };
  }

  let children = dirNode.children ?? [];
  if (!all) children = children.filter((c) => !c.name.startsWith("."));

  const visible = children.sort((a, b) => a.name.localeCompare(b.name));

  if (!long) {
    return { ok: true, output: [visible.map((c) => c.name).join("  ") || "(empty)"] };
  }

  const lines = visible.map((c) => {
    const mode = `${c.kind === "directory" ? "d" : "-"}${c.user}${c.group}${c.other}`;
    const size = c.kind === "file" ? (c.content?.length ?? 0) : 4096;
    return `${mode} 1 ${c.owner.padEnd(10)} ${c.group_name.padEnd(10)} ${String(size).padStart(6)} ${c.name}${c.kind === "directory" ? "/" : ""}`;
  });
  return { ok: true, output: [`total ${visible.length}`, ...lines] };
}

// ── cd ────────────────────────────────────────────────────────────────────

function runCd(state: SimState, argv: string[]): CommandResult {
  const targetArg = argv[0] ?? `/${state.user.username === "root" ? "" : "home/" + state.user.username}`;
  const target = normalizePath(state.cwd, targetArg);
  const node = nodeAtPath(state.root, target);
  if (!node) return { ok: false, output: [`cd: ${targetArg}: No such file or directory`], error: "not found" };
  if (node.kind !== "directory") return { ok: false, output: [`cd: ${targetArg}: Not a directory`], error: "not a directory" };
  if (!canTraverse(state.root, target, state.user)) {
    return { ok: false, output: [`cd: ${targetArg}: Permission denied`], error: "permission denied" };
  }
  return { ok: true, output: [], state: { ...state, cwd: target } };
}

// ── cat ───────────────────────────────────────────────────────────────────

function runCat(state: SimState, argv: string[]): CommandResult {
  if (argv.length === 0) return { ok: false, output: ["cat: missing file operand"], error: "usage" };
  const out: string[] = [];
  let ok = true;
  let next = state;
  for (const arg of argv) {
    const target = normalizePath(state.cwd, arg);
    const check = canReadPath(state.root, target, state.user);
    const node = nodeAtPath(state.root, target);
    if (!node) {
      out.push(`cat: ${arg}: No such file or directory`);
      ok = false;
      continue;
    }
    if (node.kind === "directory") {
      out.push(`cat: ${arg}: Is a directory`);
      ok = false;
      continue;
    }
    if (!check.ok) {
      out.push(`cat: ${arg}: Permission denied`);
      ok = false;
      continue;
    }
    out.push(...(node.content ?? "").split("\n"));
  }
  return { ok, output: out, state: next };
}

// ── chmod ─────────────────────────────────────────────────────────────────

function runChmod(state: SimState, argv: string[]): CommandResult {
  const [mode, ...rest] = argv.filter((a) => !a.startsWith("-"));
  const targetArg = rest[0];
  if (!mode || !targetArg) {
    return { ok: false, output: ["chmod: missing operand — usage: chmod <octal> <path>"], error: "usage" };
  }
  if (!/^[0-7]{3}$/.test(mode) && !/^[0-7]{4}$/.test(mode)) {
    return { ok: false, output: [`chmod: invalid mode '${mode}' — use three octal digits, e.g. 640`], error: "usage" };
  }
  const target = normalizePath(state.cwd, targetArg);
  const node = nodeAtPath(state.root, target);
  if (!node) return { ok: false, output: [`chmod: cannot access '${targetArg}': No such file or directory`], error: "not found" };

  // Only the owner (or root) may chmod — mirrors real Unix.
  if (!state.user.is_root && node.owner !== state.user.username) {
    return { ok: false, output: [`chmod: changing permissions of '${targetArg}': Operation not permitted`], error: "not owner" };
  }
  if (!canTraverse(state.root, parentPath(target), state.user)) {
    return { ok: false, output: [`chmod: cannot access '${targetArg}': Permission denied`], error: "traversal" };
  }

  const nextRoot = withPermissions(state.root, target, mode.slice(-3));
  if (!nextRoot) return { ok: false, output: ["chmod: internal error"], error: "internal" };
  return { ok: true, output: [""], state: { ...state, root: nextRoot } };
}

// ── chown / chgrp ─────────────────────────────────────────────────────────

function runChown(state: SimState, argv: string[], groupOnly: boolean): CommandResult {
  const [spec, ...rest] = argv.filter((a) => !a.startsWith("-"));
  const targetArg = rest[0];
  if (!spec || !targetArg) {
    return { ok: false, output: [`${groupOnly ? "chgrp" : "chown"}: missing operand`], error: "usage" };
  }
  const target = normalizePath(state.cwd, targetArg);
  const node = nodeAtPath(state.root, target);
  if (!node) return { ok: false, output: [`${groupOnly ? "chgrp" : "chown"}: cannot access '${targetArg}': No such file or directory`], error: "not found" };

  if (!state.user.is_root) {
    if (groupOnly) {
      // chgrp: owner may switch to a group they belong to.
      if (node.owner !== state.user.username || !state.user.groups.includes(spec)) {
        return { ok: false, output: [`${groupOnly ? "chgrp" : "chown"}: changing group of '${targetArg}': Operation not permitted`], error: "not permitted" };
      }
    } else {
      return { ok: false, output: [`chown: changing ownership of '${targetArg}': Operation not permitted (only root)`], error: "not root" };
    }
  }

  const owner = groupOnly ? undefined : spec.split(":")[0];
  const group = groupOnly ? spec : (spec.split(":")[1] ?? undefined);
  const nextRoot = withOwnership(state.root, target, owner, group);
  if (!nextRoot) return { ok: false, output: [`${groupOnly ? "chgrp" : "chown"}: internal error`], error: "internal" };
  return { ok: true, output: [""], state: { ...state, root: nextRoot } };
}

// ── find ──────────────────────────────────────────────────────────────────

function runFind(state: SimState, argv: string[]): CommandResult {
  const startArg = argv.find((a) => !a.startsWith("-")) ?? ".";
  const nameFilterIdx = argv.indexOf("-name");
  const nameFilter = nameFilterIdx !== -1 ? argv[nameFilterIdx + 1] : null;
  const userFilterIdx = argv.indexOf("-user");
  const userFilter = userFilterIdx !== -1 ? argv[userFilterIdx + 1] : null;
  const sizeFilterIdx = argv.indexOf("-size");
  const sizeFilter = sizeFilterIdx !== -1 ? argv[sizeFilterIdx + 1] : null;

  const start = normalizePath(state.cwd, startArg);
  if (!canTraverse(state.root, start, state.user)) {
    return { ok: false, output: [`find: '${startArg}': Permission denied`], error: "permission denied" };
  }
  const startNode = nodeAtPath(state.root, start);
  if (!startNode) return { ok: false, output: [`find: '${startArg}': No such file or directory`], error: "not found" };

  const all = flatten(startNode, start);
  const out: string[] = [];
  for (const { node, path } of all) {
    // find only reports nodes in directories the user can traverse.
    if (path !== start && !canTraverse(state.root, parentPath(path), state.user)) continue;
    if (nameFilter && !matchGlob(node.name, nameFilter)) continue;
    if (userFilter && node.owner !== userFilter) continue;
    if (sizeFilter) {
      const m = /^\+?(\d+)c$/.exec(sizeFilter);
      if (!m) continue;
      const size = node.kind === "file" ? (node.content?.length ?? 0) : 4096;
      if (sizeFilter.startsWith("+")) {
        if (size <= Number(m[1])) continue;
      } else if (size !== Number(m[1])) continue;
    }
    out.push(path === "/" ? "/" : path);
  }
  return { ok: true, output: out.length > 0 ? out : ["(no matches)"] };
}

/** Tiny glob: * and ? only — enough for teaching. */
function matchGlob(name: string, pattern: string): boolean {
  const rx = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
  );
  return rx.test(name);
}

// ── grep ──────────────────────────────────────────────────────────────────

function runGrep(state: SimState, argv: string[]): CommandResult {
  const patternIdx = argv.findIndex((a) => !a.startsWith("-"));
  if (patternIdx === -1) return { ok: false, output: ["grep: missing pattern"], error: "usage" };
  const pattern = argv[patternIdx];
  const fileArg = argv[patternIdx + 1];
  if (typeof pattern !== "string" || typeof fileArg !== "string") {
    return { ok: false, output: ["grep: usage: grep <pattern> <file>"], error: "usage" };
  }

  const target = normalizePath(state.cwd, fileArg);
  const check = canReadPath(state.root, target, state.user);
  const node = nodeAtPath(state.root, target);
  if (!node || node.kind !== "file") return { ok: false, output: [`grep: ${fileArg}: No such file`], error: "not found" };
  if (!check.ok) return { ok: false, output: [`grep: ${fileArg}: Permission denied`], error: "permission denied" };

  let rx: RegExp;
  try {
    rx = new RegExp(pattern, "i");
  } catch {
    return { ok: false, output: [`grep: invalid pattern '${pattern}'`], error: "usage" };
  }
  const lines = (node.content ?? "").split("\n").filter((l) => l.length > 0);
  const hits = lines.filter((l) => rx.test(l));
  if (argv.includes("-c")) return { ok: hits.length > 0, output: [String(hits.length)] };
  return { ok: hits.length > 0, output: hits.length > 0 ? hits : ["(no matches)"] };
}

// ── head ──────────────────────────────────────────────────────────────────

function runHead(state: SimState, argv: string[]): CommandResult {
  const nIdx = argv.indexOf("-n");
  const n = nIdx !== -1 ? Number(argv[nIdx + 1]) || 10 : 10;
  const fileArg = argv.find((a, i) => !a.startsWith("-") && i !== nIdx && i !== nIdx + 1);
  if (!fileArg) return { ok: false, output: ["head: missing file operand"], error: "usage" };
  const target = normalizePath(state.cwd, fileArg);
  const check = canReadPath(state.root, target, state.user);
  const node = nodeAtPath(state.root, target);
  if (!node || node.kind !== "file") return { ok: false, output: [`head: ${fileArg}: No such file`], error: "not found" };
  if (!check.ok) return { ok: false, output: [`head: ${fileArg}: Permission denied`], error: "permission denied" };
  return { ok: true, output: (node.content ?? "").split("\n").slice(0, n) };
}

// ── identity commands ─────────────────────────────────────────────────────

function runWhoami(state: SimState): CommandResult {
  return { ok: true, output: [state.user.username] };
}

// ── stat + wc (analysis helpers for SOC/forensics scenarios) ──────────────

function runStat(state: SimState, argv: string[]): CommandResult {
  const targetArg = argv[0];
  if (!targetArg) return { ok: false, output: ["stat: missing file operand"], error: "usage" };
  const target = normalizePath(state.cwd, targetArg);
  const node = nodeAtPath(state.root, target);
  if (!node) return { ok: false, output: [`stat: cannot statx '${targetArg}': No such file or directory`], error: "not found" };
  if (!canTraverse(state.root, parentPath(target), state.user) || !can(node, state.user, "read")) {
    return { ok: false, output: [`stat: cannot statx '${targetArg}': Permission denied`], error: "permission denied" };
  }
  const size = node.kind === "file" ? (node.content?.length ?? 0) : 4096;
  const mode = `${node.kind === "directory" ? "d" : "-"}${node.user}${node.group}${node.other}`;
  const mtime = node.mtime ?? "1970-01-01T00:00:00Z";
  return {
    ok: true,
    output: [
      `  File: ${target}`,
      `  Size: ${size}\tType: ${node.kind === "directory" ? "directory" : "regular file"}`,
      `Access: (${octalOf(node)}/${mode})  Uid: ( ${node.owner} )  Gid: ( ${node.group_name} )`,
      `Modify: ${mtime}`,
    ],
  };
}

function runWc(state: SimState, argv: string[]): CommandResult {
  const linesOnly = argv.includes("-l");
  const fileArg = argv.find((a) => !a.startsWith("-"));
  if (!fileArg) return { ok: false, output: ["wc: missing file operand"], error: "usage" };
  const target = normalizePath(state.cwd, fileArg);
  const node = nodeAtPath(state.root, target);
  if (!node || node.kind !== "file") return { ok: false, output: [`wc: ${fileArg}: No such file`], error: "not found" };
  if (!canReadPath(state.root, target, state.user).ok) {
    return { ok: false, output: [`wc: ${fileArg}: Permission denied`], error: "permission denied" };
  }
  const content = node.content ?? "";
  const lineCount = content.split("\n").filter((l) => l.length > 0).length;
  return { ok: true, output: [linesOnly ? String(lineCount) : `${lineCount} ${content.length} ${fileArg}`] };
}

function runId(state: SimState): CommandResult {
  return {
    ok: true,
    output: [
      `uid=(${state.user.username}) groups=${state.user.groups.map((g) => `(${g})`).join(" ")}${state.user.is_root ? " (root)" : ""}`,
    ],
  };
}

function runGroups(state: SimState): CommandResult {
  return { ok: true, output: [state.user.groups.join(" ")] };
}

function runHelp(): CommandResult {
  return {
    ok: true,
    output: [
      "Available commands:",
      "  ls [-l|-a] [path]     list directory contents",
      "  cd <path>             change directory",
      "  pwd                   print working directory",
      "  cat <file>            print file contents",
      "  head [-n N] <file>    first N lines",
      "  stat <path>           file metadata (size, owner, timestamps)",
      "  wc [-l] <file>        count lines in a file",
      "  chmod <octal> <path>  change permissions (owner/root only)",
      "  chown <user>[:g] <p>  change ownership (root only)",
      "  chgrp <group> <path>  change group (owner, target group only)",
      "  find [path] -name X   search by name; also -user, -size +Nc",
      "  grep [-c] <pat> <f>   search inside a file (-c = count only)",
      "  notes <text>          record an analyst note for the case",
      "  whoami / id / groups  identity",
      "  clear                 clear the screen",
    ],
  };
}

/** Record an analyst note (simulated case log entry). */
function runNotes(state: SimState, argv: string[]): CommandResult {
  void state;
  const text = argv.join(" ").trim();
  if (!text) return { ok: false, output: ["notes: record what? usage: notes <your analysis>"], error: "usage" };
  return { ok: true, output: [`[case note recorded] ${text}`] };
}

// ── dispatcher ────────────────────────────────────────────────────────────

/** Split a command line into tokens, honoring double-quoted arguments. */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  const rx = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(line)) !== null) {
    tokens.push(m[1] ?? m[2] ?? "");
  }
  return tokens;
}

export function runCommand(state: SimState, raw: string): CommandResult {
  const line = raw.trim().replace(/\s+/g, " ");
  if (line === "") return { ok: true, output: [] };
  const [cmd, ...argv] = tokenize(line);

  switch (cmd) {
    case "ls":
      return runLs(state, argv);
    case "cd":
      return runCd(state, argv);
    case "pwd":
      return { ok: true, output: [state.cwd] };
    case "cat":
      return runCat(state, argv);
    case "chmod":
      return runChmod(state, argv);
    case "chown":
      return runChown(state, argv, false);
    case "chgrp":
      return runChown(state, argv, true);
    case "find":
      return runFind(state, argv);
    case "grep":
      return runGrep(state, argv);
    case "head":
      return runHead(state, argv);
    case "stat":
      return runStat(state, argv);
    case "wc":
      return runWc(state, argv);
    case "notes":
      return runNotes(state, argv);
    case "whoami":
      return runWhoami(state);
    case "id":
      return runId(state);
    case "groups":
      return runGroups(state);
    case "help":
      return runHelp();
    case "clear":
      return { ok: true, output: [], state };
    default:
      return {
        ok: false,
        output: [`${cmd}: command not found — type 'help' for the available commands`],
        error: "not found",
      };
  }
}



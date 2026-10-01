/**
 * Virtual filesystem for built-in Linux simulations. Pure data + functions:
 * no DB, no React, no I/O. "Execution" means evaluating a parsed command
 * against this tree — a real shell is never involved (see actions.ts).
 *
 * Permission model mirrors real Unix closely enough to teach it honestly:
 *  - 9 bits: user(owner) rwx, group rwx, other rwx
 *  - crossing a directory requires x on every ancestor (root's ancestor is itself)
 *  - reading a directory listing requires r on the directory itself
 *  - creating/deleting inside a directory requires w (+x) on that directory
 *
 * Node ids are stable strings so goal checks and UI keys stay deterministic.
 * File contents are short teaching strings, never real secrets.
 */

export type FileKind = "file" | "directory";

export type FsNode = {
  id: string;
  name: string;
  kind: FileKind;
  /** rwx triple per class, e.g. "rw-" (files) or "rwx" (dirs). */
  user: string;
  group: string;
  other: string;
  owner: string;
  group_name: string;
  /** Modification timestamp (ISO) — used by forensics timelines. */
  mtime?: string;
  /** Files only. */
  content?: string;
  /** Directories only. */
  children?: FsNode[];
};

export type SimUser = {
  username: string;
  /** All groups this user belongs to (primary first by convention). */
  groups: string[];
  is_root?: boolean;
};

// ── Constructors ──────────────────────────────────────────────────────────

let nextId = 1;

export function resetIds(): void {
  nextId = 1;
}

/** "640" → ["rw-", "r--", "---"] — constructors take octal, like chmod does. */
function octalToTriples(perms: string): [string, string, string] {
  const clean = perms.replace(/[^0-7]/g, "").padEnd(3, "0").slice(0, 3);
  const triple = (d: string): string => {
    const n = Number(d);
    return `${n & 4 ? "r" : "-"}${n & 2 ? "w" : "-"}${n & 1 ? "x" : "-"}`;
  };
  return [triple(clean[0] ?? "0"), triple(clean[1] ?? "0"), triple(clean[2] ?? "0")];
}

export function dir(
  name: string,
  owner: string,
  group: string,
  /** Octal mode, e.g. "750". */
  perms: string,
  children: FsNode[] = [],
  mtime?: string,
): FsNode {
  const id = `n${nextId++}`;
  const [user, groupP, other] = octalToTriples(perms);
  return { id, name, kind: "directory", user, group: groupP, other, owner, group_name: group, children, mtime };
}

export function file(
  name: string,
  owner: string,
  group: string,
  /** Octal mode, e.g. "640". */
  perms: string,
  content = "",
  mtime?: string,
): FsNode {
  const id = `n${nextId++}`;
  const [user, groupP, other] = octalToTriples(perms);
  return { id, name, kind: "file", user, group: groupP, other, owner, group_name: group, content, mtime };
}

// ── Path resolution ───────────────────────────────────────────────────────

export function splitPath(path: string): string[] {
  return path.split("/").filter((p) => p.length > 0 && p !== ".");
}

/** Resolve ".." and "." against an absolute cwd; returns a clean absolute path. */
export function normalizePath(cwd: string, target: string): string {
  const base = target.startsWith("/") ? [] : splitPath(cwd);
  const parts = [...base, ...splitPath(target)];
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else out.push(part);
  }
  return `/${out.join("/")}`;
}

export function pathParts(path: string): string[] {
  return splitPath(path);
}

interface NodeWithPath {
  node: FsNode;
  /** Absolute path of the node. */
  path: string;
  parent: FsNode | null;
}

function findNode(root: FsNode, parts: string[]): NodeWithPath | null {
  let node = root;
  let parent: FsNode | null = null;
  let path = "";
  for (const part of parts) {
    if (node.kind !== "directory" || !node.children) return null;
    const next = node.children.find((c) => c.name === part);
    if (!next) return null;
    parent = node;
    node = next;
    path += `/${part}`;
  }
  return { node, path: path || "/", parent };
}

export function resolve(root: FsNode, path: string): NodeWithPath | null {
  return findNode(root, pathParts(path));
}

export function nodeAtPath(root: FsNode, path: string): FsNode | null {
  return resolve(root, path)?.node ?? null;
}

export function parentPath(path: string): string {
  const parts = pathParts(path);
  parts.pop();
  return `/${parts.join("/")}`;
}

export function basename(path: string): string {
  const parts = pathParts(path);
  return parts[parts.length - 1] ?? "/";
}

// ── Permission checks ─────────────────────────────────────────────────────

export type PermClass = "user" | "group" | "other";

export function permClassOf(node: FsNode, user: SimUser): PermClass {
  if (user.is_root) return "user";
  if (node.owner === user.username) return "user";
  if (user.groups.includes(node.group_name)) return "group";
  return "other";
}

export function permBits(node: FsNode, cls: PermClass): string {
  return cls === "user" ? node.user : cls === "group" ? node.group : node.other;
}

/** Octal string of the node's permissions, e.g. "640". */
export function octalOf(node: FsNode): string {
  const triple = (t: string) =>
    ((t.includes("r") ? 4 : 0) + (t.includes("w") ? 2 : 0) + (t.includes("x") ? 1 : 0)).toString();
  return `${triple(node.user)}${triple(node.group)}${triple(node.other)}`;
}

export type PermAction = "read" | "write" | "execute";

export function can(node: FsNode, user: SimUser, action: PermAction): boolean {
  if (user.is_root) return true;
  const bits = permBits(node, permClassOf(node, user));
  const letter = action === "read" ? "r" : action === "write" ? "w" : "x";
  return bits.includes(letter);
}

/**
 * Whether `user` can reach `path` (every ancestor directory needs x).
 * The root path "/" is always traversable.
 */
export function canTraverse(root: FsNode, path: string, user: SimUser): boolean {
  const parts = pathParts(path);
  let node = root;
  // The root directory itself must be executable to cross into children.
  if (parts.length > 0 && !can(node, user, "execute")) return false;
  for (const part of parts) {
    if (node.kind !== "directory" || !node.children) return false;
    const next = node.children.find((c) => c.name === part);
    if (!next) return false;
    node = next;
    if (!can(node, user, "execute")) return false;
  }
  return true;
}

/** All checks needed to read a file: traverse ancestors, then r on the file. */
export function canReadPath(root: FsNode, path: string, user: SimUser): { ok: boolean; reason?: string } {
  const target = nodeAtPath(root, path);
  if (!target) return { ok: false, reason: "not found" };
  if (!canTraverse(root, parentPath(path), user)) {
    return { ok: false, reason: "permission denied (directory)" };
  }
  if (!can(target, user, "read")) return { ok: false, reason: "permission denied" };
  return { ok: true };
}

/** All checks needed to list a directory: traverse ancestors, then r on it. */
export function canListPath(root: FsNode, path: string, user: SimUser): { ok: boolean; reason?: string } {
  const target = nodeAtPath(root, path);
  if (!target) return { ok: false, reason: "not found" };
  if (target.kind !== "directory") return { ok: false, reason: "not a directory" };
  if (!canTraverse(root, parentPath(path), user)) {
    return { ok: false, reason: "permission denied (directory)" };
  }
  if (!can(target, user, "read")) return { ok: false, reason: "permission denied" };
  return { ok: true };
}

// ── Mutation (returns a new tree; simulations stay immutable per command) ─

function cloneNode(node: FsNode): FsNode {
  if (node.kind === "directory") {
    return { ...node, children: (node.children ?? []).map(cloneNode) };
  }
  return { ...node };
}

export function withPermissions(root: FsNode, path: string, octal: string): FsNode | null {
  const found = resolve(root, path);
  if (!found) return null;
  if (!/^[0-7]{3}$/.test(octal)) return null;
  const triple = (d: string): string => {
    const n = Number(d);
    return `${n & 4 ? "r" : "-"}${n & 2 ? "w" : "-"}${n & 1 ? "x" : "-"}`;
  };
  const next = cloneNode(root);
  const target = nodeAtPath(next, path);
  if (!target) return null;
  target.user = triple(octal[0] ?? "0");
  target.group = triple(octal[1] ?? "0");
  target.other = triple(octal[2] ?? "0");
  return next;
}

export function withOwnership(root: FsNode, path: string, owner?: string, group?: string): FsNode | null {
  const found = resolve(root, path);
  if (!found) return null;
  const next = cloneNode(root);
  const target = nodeAtPath(next, path);
  if (!target) return null;
  if (owner) target.owner = owner;
  if (group) target.group_name = group;
  return next;
}

/** Recursively collect every node with its absolute path (pre-order). */
export function walk(root: FsNode, path = ""): { node: FsNode; path: string }[] {
  const p = `${path}/${root.name}`.replace(/^\/\/$/, "/");
  const out: { node: FsNode; path: string }[] = [{ node: root, path: root.name === "/" ? "/" : p }];
  if (root.kind === "directory") {
    for (const child of root.children ?? []) {
      const childPath = root.name === "/" ? `/${child.name}` : `${p}/${child.name}`;
      out.push(...walk(child, childPath.slice(0, childPath.lastIndexOf("/")) || "/"));
    }
  }
  return out;
}

/** Flatten all nodes under root (including root) with absolute paths — simple, correct. */
export function flatten(root: FsNode, prefix = ""): { node: FsNode; path: string }[] {
  const here = prefix === "" ? "/" : prefix;
  const out: { node: FsNode; path: string }[] = [{ node: root, path: here }];
  if (root.kind === "directory") {
    for (const child of root.children ?? []) {
      const childPrefix = here === "/" ? `/${child.name}` : `${here}/${child.name}`;
      out.push(...flatten(child, childPrefix));
    }
  }
  return out;
}

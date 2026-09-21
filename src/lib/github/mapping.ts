/**
 * Pure GitHub mapping logic — no network, no React. Repo rows from
 * api.github.com are reduced to a safe display shape, and a transparent
 * keyword heuristic flags security-relevant repositories. The heuristic is
 * intentionally simple and inspectable, not "AI".
 */

export type GithubRepoRaw = {
  id: number;
  name: string;
  full_name?: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count?: number;
  fork?: boolean;
  topics?: string[];
  updated_at?: string;
  pushed_at?: string;
};

export type GithubRepoLite = {
  id: number;
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  isFork: boolean;
  isSecurity: boolean;
  topics: string[];
  pushedAt: string | null;
};

/** Transparent security-relevance heuristic: match against the repo name,
 *  GitHub topics and description. Bounded words, case-insensitive. */
export const SECURITY_KEYWORDS = [
  "security",
  "malware",
  "ctf",
  "pentest",
  "penetration",
  "honeypot",
  "vulnerab",
  "vuln",
  "exploit",
  "siem",
  "forensic",
  "crypto",
  "encryption",
  "osint",
  "phishing",
  "scanner",
  "firewall",
  "intrusion",
  "redteam",
  "blueteam",
  "soc",
  "dfir",
  "wireshark",
  "nmap",
  "burp",
  "owasp",
] as const;

export function isSecurityRepo(
  repo: Pick<GithubRepoRaw, "name" | "description" | "topics">,
): boolean {
  const name = repo.name.toLowerCase();
  const desc = (repo.description ?? "").toLowerCase();
  const topics = (repo.topics ?? []).map((t) => t.toLowerCase());
  return SECURITY_KEYWORDS.some((kw) => {
    const k = kw.toLowerCase();
    if (name.includes(k) || desc.includes(k)) return true;
    return topics.some((t) => t.includes(k));
  });
}

/** Reduce a raw API row to the display shape. Unknown rows are tolerated —
 *  the API shape is treated as untrusted input. */
export function toRepoLite(raw: GithubRepoRaw): GithubRepoLite | null {
  if (typeof raw?.id !== "number" || typeof raw?.name !== "string" || typeof raw?.html_url !== "string") {
    return null;
  }
  return {
    id: raw.id,
    name: raw.name.slice(0, 120),
    url: raw.html_url,
    description: typeof raw.description === "string" ? raw.description.slice(0, 300) : null,
    language: typeof raw.language === "string" ? raw.language.slice(0, 40) : null,
    stars: Number.isFinite(raw.stargazers_count) ? (raw.stargazers_count as number) : 0,
    isFork: raw.fork === true,
    isSecurity: isSecurityRepo(raw),
    topics: Array.isArray(raw.topics) ? raw.topics.filter((t) => typeof t === "string").slice(0, 10) : [],
    pushedAt: typeof raw.pushed_at === "string" ? raw.pushed_at : null,
  };
}

/** Sort: security repos first, then by most recently pushed. */
export function sortRepos(repos: GithubRepoLite[]): GithubRepoLite[] {
  return [...repos].sort((a, b) => {
    if (a.isSecurity !== b.isSecurity) return a.isSecurity ? -1 : 1;
    return (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "");
  });
}

/** Parse the GitHub user row returned by the provider during OAuth. */
export function parseGithubUser(
  raw: Record<string, unknown> | null | undefined,
): { id: number; login: string } | null {
  const id = raw?.id;
  const login = raw?.login;
  if (typeof id !== "number" || typeof login !== "string" || login.length === 0) return null;
  return { id, login: login.slice(0, 100) };
}

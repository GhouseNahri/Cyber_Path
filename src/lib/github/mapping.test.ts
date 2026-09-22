import { describe, expect, it } from "vitest";
import { isSecurityRepo, toRepoLite, sortRepos, parseGithubUser } from "./mapping";

describe("isSecurityRepo", () => {
  it("flags by name", () => {
    expect(isSecurityRepo({ name: "port-scanner", description: null, topics: [] })).toBe(true);
    expect(isSecurityRepo({ name: "my-siem-dashboard", description: null, topics: [] })).toBe(true);
  });

  it("flags by topic", () => {
    expect(isSecurityRepo({ name: "toolkit", description: null, topics: ["pentest"] })).toBe(true);
  });

  it("flags by description", () => {
    expect(isSecurityRepo({ name: "analyzer", description: "parses malware samples", topics: [] })).toBe(true);
  });

  it("does not flag normal repos", () => {
    expect(isSecurityRepo({ name: "portfolio-site", description: "my personal website", topics: [] })).toBe(false);
    expect(isSecurityRepo({ name: "todo-app", description: "a todo list", topics: ["react"] })).toBe(false);
  });

  it("matches partial stems (vulnerab)", () => {
    expect(isSecurityRepo({ name: "vuln-dashboard", description: null, topics: [] })).toBe(true);
  });
});

describe("toRepoLite", () => {
  it("reduces a full row to the safe display shape", () => {
    const r = toRepoLite({
      id: 1,
      name: "log-analyzer",
      html_url: "https://github.com/me/log-analyzer",
      description: "Security log analysis",
      language: "Python",
      stargazers_count: 3,
      fork: false,
      topics: ["security"],
      pushed_at: "2026-09-20T00:00:00Z",
    });
    expect(r).toEqual({
      id: 1,
      name: "log-analyzer",
      url: "https://github.com/me/log-analyzer",
      description: "Security log analysis",
      language: "Python",
      stars: 3,
      isFork: false,
      isSecurity: true,
      topics: ["security"],
      pushedAt: "2026-09-20T00:00:00Z",
    });
  });

  it("returns null for malformed rows", () => {
    expect(toRepoLite({ id: "x" } as never)).toBeNull();
    expect(toRepoLite(null as never)).toBeNull();
  });
});

describe("sortRepos", () => {
  it("puts security repos first, then by push date", () => {
    const sorted = sortRepos([
      { id: 1, name: "a", url: "", description: null, language: null, stars: 0, isFork: false, isSecurity: false, topics: [], pushedAt: "2026-09-21" },
      { id: 2, name: "b", url: "", description: null, language: null, stars: 0, isFork: false, isSecurity: true, topics: [], pushedAt: "2026-01-01" },
      { id: 3, name: "c", url: "", description: null, language: null, stars: 0, isFork: false, isSecurity: false, topics: [], pushedAt: "2026-09-01" },
    ]);
    expect(sorted.map((r) => r.name)).toEqual(["b", "a", "c"]);
  });
});

describe("parseGithubUser", () => {
  it("parses a valid user row", () => {
    expect(parseGithubUser({ id: 42, login: "ghouse" })).toEqual({ id: 42, login: "ghouse" });
  });
  it("parses Supabase identity_data shape (sub + user_name)", () => {
    expect(parseGithubUser({ sub: "5054711", user_name: "GhouseNahri" })).toEqual({
      id: 5054711,
      login: "GhouseNahri",
    });
  });
  it("parses provider_id / preferred_username variants", () => {
    expect(parseGithubUser({ provider_id: "99", preferred_username: "octo" })).toEqual({
      id: 99,
      login: "octo",
    });
  });
  it("rejects malformed rows", () => {
    expect(parseGithubUser(null)).toBeNull();
    expect(parseGithubUser({ id: "x", login: "y" })).toBeNull();
    expect(parseGithubUser({ id: 1, login: "" })).toBeNull();
    expect(parseGithubUser({ sub: "not-a-number", user_name: "x" })).toBeNull();
    expect(parseGithubUser({ sub: "-5", user_name: "x" })).toBeNull();
  });
});

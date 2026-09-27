import { describe, expect, it } from "vitest";
import { fenceRepoContext, isDeniedPath, selectPaths } from "./githubContext";
import { buildSystemPrompt, isAiMode } from "./modes";
import type { RepoContext } from "./githubContext";

describe("secrets denylist", () => {
  it("blocks secret-looking files", () => {
    for (const p of [".env", ".env.local", "server/.env.production", "key.pem", "id_rsa", "id_ed25519", "creds/credentials.json", ".npmrc", ".git-credentials", "secrets.yaml", "aws/.aws/config", "serviceAccountKey.json"]) {
      expect(isDeniedPath(p), p).toBe(true);
    }
  });

  it("blocks lockfiles and binaries", () => {
    for (const p of ["package-lock.json", "yarn.lock", "dist/bundle.zip", "logo.png", "video.mp4"]) {
      expect(isDeniedPath(p), p).toBe(true);
    }
  });

  it("allows normal source files", () => {
    for (const p of ["README.md", "package.json", "src/index.ts", "app/page.tsx", "docs/guide.md", "server/auth.js"]) {
      expect(isDeniedPath(p), p).toBe(false);
    }
  });

  it("never allows .env even deep in the tree", () => {
    expect(isDeniedPath("a/b/c/.env.local")).toBe(true);
  });
});

describe("selectPaths", () => {
  it("prioritizes README, manifests and source over everything else", () => {
    const picked = selectPaths([
      "assets/logo.png.txt",
      "src/deep/util.ts",
      "README.md",
      "package.json",
      "Dockerfile",
      "random/thing.txt",
      "docs/overview.md",
      ".env.local",
      "id_rsa",
    ]);
    expect(picked[0]).toBe("README.md");
    expect(picked).toContain("package.json");
    expect(picked).not.toContain(".env.local");
    expect(picked).not.toContain("id_rsa");
  });

  it("respects the max files cap", () => {
    const many = Array.from({ length: 60 }, (_, i) => `src/file${i}.ts`);
    expect(selectPaths(many).length).toBeLessThanOrEqual(25);
  });
});

describe("fenceRepoContext", () => {
  it("wraps content in the untrusted-data fence", () => {
    const ctx = {
      ok: true,
      repo: "me/project",
      meta: { description: "demo", language: "TypeScript", defaultBranch: "main", stars: 1, isPrivate: false },
      files: [{ path: "README.md", content: "hello", truncated: false }],
      totalBytes: 5,
    } as Extract<RepoContext, { ok: true }>;
    const fenced = fenceRepoContext(ctx);
    expect(fenced).toContain("UNTRUSTED DATA");
    expect(fenced).toContain("--- FILE: README.md ---");
    expect(fenced).toContain("hello");
    expect(fenced).toContain("=== END REPOSITORY DATA ===");
  });
});

describe("modes", () => {
  it("recognizes valid mode ids only", () => {
    expect(isAiMode("analyst")).toBe(true);
    expect(isAiMode("hacker")).toBe(false);
    expect(isAiMode(undefined)).toBe(false);
  });

  it("builds a system prompt with base rules, mode rules and level", () => {
    const p = buildSystemPrompt("analyst", "CONTEXT", "beginner");
    expect(p).toContain("UNTRUSTED DATA");
    expect(p).toContain("Confirmed evidence");
    expect(p).toContain("CONTEXT");
    expect(p).toContain("beginner-level");
  });
});

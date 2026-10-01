import { describe, expect, it } from "vitest";
import { runCommand } from "./commands";
import { getScenario, scenarioCommand, type SimStateWithFlags } from "./scenarios";
import { nodeAtPath, octalOf } from "./vfs";

describe("vfs permission math", () => {
  const scenario = getScenario("linux-permissions");
  it("scenario exists and starts clean", () => {
    expect(scenario).not.toBeNull();
    const s = scenario!.initial();
    expect(s.cwd).toBe("/home/kai");
    expect(s.user.username).toBe("kai");
    expect(s.user.is_root).toBeFalsy();
  });

  it("shared-notes starts world-writable (666) and creds are 604", () => {
    const s = scenario!.initial();
    expect(octalOf(nodeAtPath(s.root, "/home/kai/shared-notes.txt")!)).toBe("666");
    expect(octalOf(nodeAtPath(s.root, "/home/kai/backup-credentials.txt")!)).toBe("604");
  });
});

describe("linux-permissions walkthrough", () => {
  const scenario = getScenario("linux-permissions")!;

  it("owner chmod fixes each file and the goal checks flip", () => {
    let s: SimStateWithFlags = scenario.initial();
    const run = (cmd: string) => {
      const r = scenarioCommand(scenario, s, cmd);
      s = r.state;
      return r;
    };

    run("chmod 664 /home/kai/shared-notes.txt");
    run("chmod 640 /home/kai/backup-credentials.txt");
    run("chmod 750 /home/kai/scripts/rotate-backup.sh");

    const done = scenario.goals.filter((g) => g.check(s)).map((g) => g.id);
    expect(done).toContain("no-world-write");
    expect(done).toContain("creds-locked");
    expect(done).toContain("script-not-world-exec");
  });

  it("chown by non-root is denied and registers the teaching flag", () => {
    let s: SimStateWithFlags = scenario.initial();
    const r = scenarioCommand(scenario, s, "chown root /home/kai/shared-notes.txt");
    s = r.state;
    expect(r.ok).toBe(false);
    expect(s.flags?.sawChownDenial).toBe(true);
  });

  it("cd into sam's home is denied and registers the teaching flag", () => {
    let s: SimStateWithFlags = scenario.initial();
    const r = scenarioCommand(scenario, s, "cd /home/sam");
    s = r.state;
    expect(r.ok).toBe(false);
    expect(s.flags?.visitedDenial).toBe(true);
  });

  it("cannot chmod someone else's file even with a valid mode", () => {
    let s: SimStateWithFlags = scenario.initial();
    const r = scenarioCommand(scenario, s, "chmod 777 /home/sam/sam-readme.txt");
    expect(r.ok).toBe(false);
    // and it really did not change
    expect(octalOf(nodeAtPath(s.root, "/home/sam/sam-readme.txt")!)).toBe("640");
  });

  it("full walkthrough completes every goal", () => {
    let s: SimStateWithFlags = scenario.initial();
    for (const cmd of [
      "chmod 664 /home/kai/shared-notes.txt",
      "chmod 640 /home/kai/backup-credentials.txt",
      "chmod 750 /home/kai/scripts/rotate-backup.sh",
      "cd /home/sam",
      "chown root /home/kai/shared-notes.txt",
    ]) {
      const r = scenarioCommand(scenario, s, cmd);
      s = r.state;
    }
    const done = scenario.goals.filter((g) => g.check(s)).map((g) => g.id);
    expect(done).toEqual(expect.arrayContaining(scenario.goals.map((g) => g.id)));
  });
});

describe("linux-file-hunt walkthrough", () => {
  const scenario = getScenario("linux-file-hunt")!;

  it("ls -a on /home/svc reveals the dotfile", () => {
    let s: SimStateWithFlags = scenario.initial();
    const r = scenarioCommand(scenario, s, "ls -a /home/svc");
    s = r.state;
    expect(r.output.join("\n")).toContain(".deploy-token.txt");
    expect(s.flags?.sawDotfile).toBe(true);
  });

  it("find -user svc lists svc's files", () => {
    let s: SimStateWithFlags = scenario.initial();
    const r = scenarioCommand(scenario, s, "find /home -user svc");
    s = r.state;
    expect(r.output.join("\n")).toContain(".deploy-token.txt");
    expect(s.flags?.foundSvcFiles).toBe(true);
  });

  it("grep locates the Token mention in report-v2", () => {
    let s: SimStateWithFlags = scenario.initial();
    const r = scenarioCommand(scenario, s, "grep Token /home/kai/downloads/report-v2.txt");
    s = r.state;
    expect(r.ok).toBe(true);
    expect(s.flags?.greppedToken).toBe(true);
  });

  it("cat on the report registers the read flag", () => {
    let s: SimStateWithFlags = scenario.initial();
    const r = scenarioCommand(scenario, s, "cat /home/kai/downloads/report-v2.txt");
    s = r.state;
    expect(s.flags?.readReport).toBe(true);
  });

  it("kai cannot read svc's 600 token file", () => {
    let s: SimStateWithFlags = scenario.initial();
    const r = scenarioCommand(scenario, s, "cat /home/svc/.deploy-token.txt");
    expect(r.ok).toBe(false);
    expect(r.output.join(" ")).toMatch(/Permission denied/i);
  });

  it("unknown commands are rejected safely", () => {
    let s: SimStateWithFlags = scenario.initial();
    const r = scenarioCommand(scenario, s, "sudo rm -rf /");
    expect(r.ok).toBe(false);
    expect(r.output.join(" ")).toMatch(/command not found/i);
  });
});

describe("command engine edge cases", () => {
  it("pwd reflects cd", () => {
    const scenario = getScenario("linux-file-hunt")!;
    let s: SimStateWithFlags = scenario.initial();
    const cd = scenarioCommand(scenario, s, "cd downloads");
    s = cd.state;
    const pwd = runCommand(s, "pwd");
    expect(pwd.output[0]).toBe("/home/kai/downloads");
  });

  it("cat requires traversal + read on the file", () => {
    const scenario = getScenario("linux-permissions")!;
    const s = scenario.initial();
    const r = runCommand(s, "cat /home/sam/sam-readme.txt");
    expect(r.ok).toBe(false);
    expect(r.output.join(" ")).toMatch(/Permission denied/i);
  });

  it("chmod validates the octal mode", () => {
    const scenario = getScenario("linux-permissions")!;
    const s = scenario.initial();
    const r = runCommand(s, "chmod 999 /home/kai/shared-notes.txt");
    expect(r.ok).toBe(false);
    expect(r.output.join(" ")).toMatch(/invalid mode/i);
  });
});

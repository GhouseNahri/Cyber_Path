import { describe, expect, it } from "vitest";
import { getScenario, scenarioCommand, type SimStateWithFlags } from "./scenarios";
import { SIM_SCENARIOS } from "./scenarios";

describe("analysis scenarios registered", () => {
  it("exposes all five scenarios through the central registry", () => {
    for (const key of ["linux-permissions", "linux-file-hunt", "soc-auth-triage", "dns-exfil-hunt", "forensic-timeline"]) {
      expect(getScenario(key), key).not.toBeNull();
    }
    expect(Object.keys(SIM_SCENARIOS)).toHaveLength(5);
  });
});

describe("soc-auth-triage walkthrough", () => {
  const scenario = getScenario("soc-auth-triage")!;

  it("full triage completes every goal", () => {
    let s: SimStateWithFlags = scenario.initial();
    for (const cmd of [
      "cat /home/analyst/case-2026-09-28/auth.log",
      "grep -c \"Failed password\" /home/analyst/case-2026-09-28/auth.log",
      "grep \"198.51.100.77\" /home/analyst/case-2026-09-28/auth.log",
      "grep \"Accepted\" /home/analyst/case-2026-09-28/auth.log",
      "notes attacker from 198.51.100.77 brute-forced admin, got in at 02:03",
    ]) {
      const r = scenarioCommand(scenario, s, cmd);
      s = r.state;
    }
    const done = scenario.goals.filter((g) => g.check(s)).map((g) => g.id);
    expect(done).toEqual(expect.arrayContaining(scenario.goals.map((g) => g.id)));
  });

  it("auth log contains the sudo failure after the success", () => {
    const s = scenario.initial();
    const r = scenarioCommand(scenario, s, "grep sudo /home/analyst/case-2026-09-28/auth.log");
    expect(r.output.join("\n")).toContain("incorrect password attempts");
  });
});

describe("dns-exfil-hunt walkthrough", () => {
  const scenario = getScenario("dns-exfil-hunt")!;

  it("full hunt completes every goal", () => {
    let s: SimStateWithFlags = scenario.initial();
    for (const cmd of [
      "cat /home/netanalyst/dns.log",
      "grep exfil /home/netanalyst/dns.log",
      "grep -c exfil /home/netanalyst/dns.log",
      "grep \"10.0.2.99\" /home/netanalyst/dns.log",
    ]) {
      const r = scenarioCommand(scenario, s, cmd);
      s = r.state;
    }
    const done = scenario.goals.filter((g) => g.check(s)).map((g) => g.id);
    expect(done).toEqual(expect.arrayContaining(scenario.goals.map((g) => g.id)));
  });

  it("counts exactly 8 exfil queries", () => {
    const s = scenario.initial();
    const r = scenarioCommand(scenario, s, "grep -c exfil /home/netanalyst/dns.log");
    expect(r.output[0]).toBe("8");
  });
});

describe("forensic-timeline walkthrough", () => {
  const scenario = getScenario("forensic-timeline")!;

  it("full reconstruction completes every goal", () => {
    let s: SimStateWithFlags = scenario.initial();
    for (const cmd of [
      "stat /home/forensics/evidence/invoice-2026-Q3.pdf",
      "cat /home/forensics/evidence/.bash_history_readonly",
      "cat /home/forensics/evidence/invoice-2026-Q3.pdf",
      "grep \"203.0.113.9\" /home/forensics/evidence/wget-script.sh",
    ]) {
      const r = scenarioCommand(scenario, s, cmd);
      s = r.state;
    }
    const done = scenario.goals.filter((g) => g.check(s)).map((g) => g.id);
    expect(done).toEqual(expect.arrayContaining(scenario.goals.map((g) => g.id)));
  });

  it("history shows the kill chain including the persist step", () => {
    const s = scenario.initial();
    const r = scenarioCommand(scenario, s, "cat /home/forensics/evidence/.bash_history_readonly");
    const out = r.output.join("\n");
    expect(out).toContain("./payload --persist");
    expect(out).toContain("203.0.113.9");
  });
});

describe("new analysis commands", () => {
  it("stat prints owner, mode and mtime", () => {
    const scenario = getScenario("forensic-timeline")!;
    const s = scenario.initial();
    const r = scenarioCommand(scenario, s, "stat /home/forensics/evidence/invoice-2026-Q3.pdf");
    const out = r.output.join("\n");
    expect(out).toContain("2026-09-28T09:14:03Z");
    expect(out).toContain("root");
  });

  it("wc -l counts log lines", () => {
    const scenario = getScenario("soc-auth-triage")!;
    const s = scenario.initial();
    const r = scenarioCommand(scenario, s, "wc -l /home/analyst/case-2026-09-28/auth.log");
    expect(Number(r.output[0])).toBeGreaterThan(10);
  });
});

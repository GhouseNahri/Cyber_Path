import { describe, expect, it } from "vitest";
import { matchesTargetRole, pathCoverage, type PathContent } from "./engine";

const path: Pick<
  PathContent,
  "slug" | "name" | "tagline" | "foundational_skills" | "recommended_topics" | "project_ideas"
> = {
  slug: "soc-analyst",
  name: "SOC / Blue Team Analyst",
  tagline: "Defend networks by detecting and responding to attacks in real time.",
  foundational_skills: ["linux", "networking", "python", "windows"],
  recommended_topics: ["linux-fundamentals", "networking-models", "packet-analysis"],
  project_ideas: ["log-analyzer", "siem-style-log-dashboard"],
};

const lv = (slug: string, level: "not_started" | "learning" | "practicing" | "competent" | "demonstrated") => ({
  slug,
  level,
});

describe("pathCoverage", () => {
  it("is all zeros and exploring tier for a new user", () => {
    const c = pathCoverage(path, [], [], []);
    expect(c).toMatchObject({
      skillsStarted: 0,
      skillsTotal: 4,
      skillsCompetent: 0,
      topicsDone: 0,
      topicsTotal: 3,
      projectsDone: 0,
      projectsTotal: 2,
      readinessPct: 0,
      tier: "exploring",
    });
  });

  it("counts skill touch as half credit", () => {
    const c = pathCoverage(path, [lv("linux", "learning"), lv("networking", "practicing")], [], []);
    expect(c.skillsStarted).toBe(2);
    expect(c.skillsCompetent).toBe(0);
    // 2 started of 4 skills → skillPct 0.25 → readiness 13%.
    expect(c.readinessPct).toBe(13);
  });

  it("counts competent and demonstrated as full skill credit", () => {
    const c = pathCoverage(
      path,
      [lv("linux", "competent"), lv("networking", "demonstrated")],
      [],
      [],
    );
    expect(c.skillsCompetent).toBe(2);
    expect(c.skillsStarted).toBe(2);
    // 2 full of 4 → 0.5 → 25%.
    expect(c.readinessPct).toBe(25);
  });

  it("combines topics and project evidence into the tier", () => {
    const c = pathCoverage(
      path,
      [lv("linux", "competent"), lv("networking", "competent"), lv("python", "competent")],
      [
        { topic_slug: "linux-fundamentals", status: "completed" },
        { topic_slug: "networking-models", status: "completed" },
        { topic_slug: "packet-analysis", status: "in_progress" },
      ],
      [{ idea_slug: "log-analyzer", status: "published" }],
    );
    expect(c.topicsDone).toBe(2);
    expect(c.projectsDone).toBe(1);
    expect(c.tier).toBe("strong_evidence");
  });

  it("ignores non-completed topics and non-finished projects", () => {
    const c = pathCoverage(
      path,
      [],
      [{ topic_slug: "linux-fundamentals", status: "in_progress" }],
      [{ idea_slug: "log-analyzer", status: "building" }],
    );
    expect(c.topicsDone).toBe(0);
    expect(c.projectsDone).toBe(0);
  });

  it("stays exploring until real evidence exists", () => {
    // 3 topics done but nothing else → building, not strong.
    const c = pathCoverage(
      path,
      [],
      path.recommended_topics.map((t) => ({ topic_slug: t, status: "completed" })),
      [],
    );
    expect(c.tier).toBe("building");
  });
});

describe("matchesTargetRole", () => {
  const soc = { slug: "soc-analyst", name: "SOC / Blue Team Analyst", tagline: "Defend networks by detecting and responding to attacks in real time." };
  const pentest = { slug: "penetration-tester", name: "Penetration Tester", tagline: "Find and prove exploitable weaknesses — legally, with written permission." };

  it("matches direct text", () => {
    expect(matchesTargetRole(soc, ["SOC analyst"])).toBe(true);
    expect(matchesTargetRole(pentest, ["penetration tester"])).toBe(true);
  });

  it("matches synonyms", () => {
    expect(matchesTargetRole(soc, ["blue team"])).toBe(true);
    expect(matchesTargetRole(pentest, ["red teaming"])).toBe(true);
  });

  it("does not cross-match unrelated roles", () => {
    expect(matchesTargetRole(soc, ["forensics"])).toBe(false);
    expect(matchesTargetRole(pentest, ["cloud security"])).toBe(false);
  });

  it("is false with no targets or tiny strings", () => {
    expect(matchesTargetRole(soc, [])).toBe(false);
    expect(matchesTargetRole(soc, ["SO"])).toBe(false);
  });
});

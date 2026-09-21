/**
 * Pure career-path coverage math — no database, no React. Compares a path's
 * required skills/topics/projects against the user's REAL evidence (skill
 * states, topic progress, project statuses) and returns an honest readiness
 * picture. "Job-ready" here means "job-ready evidence exists", never a promise.
 */

export type SkillStateLite = {
  slug: string;
  /** Theory+practice level derived on the Skills page. */
  level: "not_started" | "learning" | "practicing" | "competent" | "demonstrated";
};

export type TopicProgressLite = {
  topic_slug: string;
  status: "not_started" | "in_progress" | "completed" | string;
};

export type ProjectStatusLite = {
  idea_slug: string | null;
  status: string;
};

export type PathContent = {
  slug: string;
  name: string;
  nice_category: string | null;
  tagline: string;
  description: string;
  responsibilities: string[];
  foundational_skills: string[];
  recommended_topics: string[];
  project_ideas: string[];
  certifications: { name: string; note: string }[];
  entry_guidance: string;
};

export type SkillCoverage = {
  slug: string;
  state: "not_started" | "started" | "competent" | "demonstrated";
};

export type PathCoverage = {
  /** Required skills the user has at least touched (learning+). */
  skillsStarted: number;
  skillsTotal: number;
  /** Required skills at competent/demonstrated. */
  skillsCompetent: number;
  /** Recommended topics completed. */
  topicsDone: number;
  topicsTotal: number;
  /** Path projects completed or published. */
  projectsDone: number;
  projectsTotal: number;
  /** 0–100: skill touch weighted by depth, topics and projects. */
  readinessPct: number;
  tier: "exploring" | "building" | "strong_evidence";
  perSkill: SkillCoverage[];
};

export function skillCoverageOf(
  skillSlug: string,
  bySlug: Map<string, SkillStateLite["level"]>,
): SkillCoverage["state"] {
  const level = bySlug.get(skillSlug);
  if (level === "demonstrated") return "demonstrated";
  if (level === "competent") return "competent";
  if (level && level !== "not_started") return "started";
  return "not_started";
}

/** Honest readiness: touching a skill counts little, depth counts more. */
export function pathCoverage(
  path: Pick<PathContent, "foundational_skills" | "recommended_topics" | "project_ideas">,
  skills: SkillStateLite[],
  topics: TopicProgressLite[],
  projects: ProjectStatusLite[],
): PathCoverage {
  const levelBySlug = new Map(skills.map((s) => [s.slug, s.level]));
  const perSkill = path.foundational_skills.map((slug) => ({
    slug,
    state: skillCoverageOf(slug, levelBySlug),
  }));

  const completedTopics = new Set(
    topics.filter((t) => t.status === "completed").map((t) => t.topic_slug),
  );
  const topicsTotal = path.recommended_topics.length;
  const topicsDone = path.recommended_topics.filter((t) => completedTopics.has(t)).length;

  const projectsTotal = path.project_ideas.length;
  const projectsDone = path.project_ideas.filter((idea) =>
    projects.some((p) => p.idea_slug === idea && (p.status === "completed" || p.status === "published")),
  ).length;

  const skillsTotal = perSkill.length;
  const skillsStarted = perSkill.filter((s) => s.state !== "not_started").length;
  const skillsCompetent = perSkill.filter(
    (s) => s.state === "competent" || s.state === "demonstrated",
  ).length;

  // Weights: skill depth (50%) — touch=0.5, competent=1; topics (30%); projects (20%).
  const skillPoints = perSkill.reduce((acc, s) => {
    if (s.state === "demonstrated") return acc + 1;
    if (s.state === "competent") return acc + 1;
    if (s.state === "started") return acc + 0.5;
    return acc;
  }, 0);
  const skillPct = skillsTotal ? skillPoints / skillsTotal : 0;
  const topicPct = topicsTotal ? topicsDone / topicsTotal : 0;
  const projectPct = projectsTotal ? projectsDone / projectsTotal : 0;
  const readinessPct = Math.round((skillPct * 0.5 + topicPct * 0.3 + projectPct * 0.2) * 100);

  const tier: PathCoverage["tier"] =
    projectsDone >= 1 && readinessPct >= 60
      ? "strong_evidence"
      : readinessPct >= 20 || topicsDone >= 3
        ? "building"
        : "exploring";

  return {
    skillsStarted,
    skillsTotal,
    skillsCompetent,
    topicsDone,
    topicsTotal,
    projectsDone,
    projectsTotal,
    readinessPct,
    tier,
    perSkill,
  };
}

/** Which seeded paths match the user's onboarding target_roles free text. */
export function matchesTargetRole(
  path: Pick<PathContent, "slug" | "name" | "tagline">,
  targetRoles: string[],
): boolean {
  if (targetRoles.length === 0) return false;
  const haystack = `${path.slug} ${path.name} ${path.tagline}`.toLowerCase();
  return targetRoles.some((role) => {
    const r = role.toLowerCase().trim();
    if (r.length < 3) return false;
    if (haystack.includes(r)) return true;
    // A few common synonyms.
    const synonyms: Record<string, string[]> = {
      soc: ["soc", "blue team", "analyst", "defens"],
      pentest: ["pentest", "pen test", "red team", "offensive", "ethical hack", "penetration"],
      appsec: ["appsec", "web", "application security", "owasp"],
      dfir: ["forensic", "dfir", "incident"],
      cloud: ["cloud", "aws", "azure", "gcp"],
      engineer: ["engineer", "devsecops", "engineering"],
    };
    for (const keys of Object.values(synonyms)) {
      if (keys.some((k) => r.includes(k)) && keys.some((k) => haystack.includes(k))) return true;
    }
    return false;
  });
}

export const TIER_LABEL: Record<PathCoverage["tier"], string> = {
  exploring: "Exploring",
  building: "Building",
  strong_evidence: "Strong evidence",
};

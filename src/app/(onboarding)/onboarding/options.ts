/** Onboarding wizard option data (kept out of the component for clarity). */

export const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "New to cybersecurity", hint: "Starting from fundamentals" },
  { value: "some_experience", label: "Some experience", hint: "I know basics, want structure" },
  { value: "experienced", label: "Experienced", hint: "Filling gaps, specializing" },
] as const;

export const TIME_OPTIONS = [
  { value: 15, label: "15 minutes", hint: "Light but consistent" },
  { value: 30, label: "30 minutes", hint: "Steady daily progress" },
  { value: 45, label: "45 minutes", hint: "Recommended for real momentum" },
  { value: 90, label: "90 minutes", hint: "Deep daily commitment" },
] as const;

export const ROLE_OPTIONS = [
  "SOC / Blue Team",
  "Penetration Testing",
  "Web Application Security",
  "Bug Bounty",
  "Digital Forensics / DFIR",
  "Malware Analysis",
  "Cloud Security",
  "Security Engineering",
  "Application Security",
  "DevSecOps",
  "Threat Intelligence",
  "AI Security",
  "Exploring — not sure yet",
] as const;

export const STYLE_OPTIONS = [
  { value: "practical", label: "Hands-on first", hint: "Labs and practice, theory as needed" },
  { value: "balanced", label: "Balanced", hint: "Mix of reading and doing" },
  { value: "theory", label: "Theory first", hint: "Understand deeply, then apply" },
] as const;

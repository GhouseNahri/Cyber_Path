/** Single source of truth for app navigation. `phase` marks when a section
 *  becomes functional — honest about what exists today. */
export type NavItem = {
  label: string;
  href: string;
  /** Which build phase activates this section. */
  phase: number | "later";
  description: string;
  icon: React.ReactNode;
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    phase: 1,
    description: "Today's mission, streak and progress overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13" y="3.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <rect x="3.5" y="13" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13" y="13" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    label: "Roadmap",
    href: "/roadmap",
    phase: 1,
    description: "Phases, topics and prerequisites",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <path d="M4 5.5h5.5a2 2 0 0 1 2 2v9a2 2 0 0 0 2 2H19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="4" cy="5.5" r="1.4" fill="currentColor" />
        <circle cx="19.5" cy="18.5" r="1.4" fill="currentColor" />
        <path d="M15.5 3.5l3 2-3 2M15.5 16.5l3 2-3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Library",
    href: "/library",
    phase: 1,
    description: "Curated resources, filterable and trackable",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <path d="M5 4.5h3.2a2 2 0 0 1 1.9 1.4L13 15.4a1.5 1.5 0 0 1-1.4 2H8.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M19 4.5h-3.2a2 2 0 0 0-1.9 1.4L11 15.4a1.5 1.5 0 0 0 1.4 2h3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M4 20.5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Skills",
    href: "/skills",
    phase: 1,
    description: "Skill graph with theory vs practice",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="5" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="19" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="5" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="19" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6.6 7.1 10.2 10.4M17.4 7.1 13.8 10.4M6.6 16.9 10.2 13.6M17.4 16.9 13.8 13.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Labs",
    href: "/labs",
    phase: 8,
    description: "Hands-on lab tracker",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <path d="M9.5 3.5h5M10.5 3.5v5.2a5.5 5.5 0 0 1-.6 2.5l-3.7 7.1A2 2 0 0 0 8 21.5h8a2 2 0 0 0 1.8-3.2l-3.7-7.1a5.5 5.5 0 0 1-.6-2.5V3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 15.5h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Projects",
    href: "/projects",
    phase: 11,
    description: "Build and track security projects",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M3.5 11h17" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    label: "Career",
    href: "/career",
    phase: 13,
    description: "Explore cybersecurity career paths",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <rect x="3.5" y="7.5" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "/github",
    phase: 14,
    description: "Connect GitHub, link repos, publish portfolio",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <rect x="3.5" y="7.5" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Analytics",
    href: "/analytics",
    phase: 12,
    description: "Study time, velocity and patterns",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "History",
    href: "/history",
    phase: 1,
    description: "Past sessions and study calendar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    phase: 2,
    description: "Profile, goals and preferences",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

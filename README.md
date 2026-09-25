# Cyber_Path

Personal cybersecurity learning command center — an interactive roadmap that
turns "watching tutorials" into structured learning: phases, topics,
prerequisites, real study sessions, streaks, labs, projects and career paths.

> **Status:** Shipped — all 18 build phases complete. Real auth, roadmap,
> daily sessions, streaks, quizzes, revision, projects, career paths, GitHub
> portfolio, analytics and a full security audit. See [PRODUCT_REVIEW.md](PRODUCT_REVIEW.md).
> Nothing here is simulated.

**Live:** https://cyber-path-phi.vercel.app

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js (App Router) + React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 + semantic design tokens |
| Fonts | Space Grotesk (display) · Inter (body) · JetBrains Mono (technical) — self-hosted via Fontsource |
| Data & auth | Supabase (Postgres + Auth + Row Level Security) — wired in Phases 2–3 |
| Deployment | Vercel |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Project structure

```
src/
├── app/            # App Router pages, layouts, loading/error states
├── components/
│   ├── shell/      # App shell: sidebar, topbar, navigation
│   └── ui/         # Design-system building blocks
├── lib/            # Shared logic (phases in later stages)
└── styles/         # Design tokens + global styles
```

## Phase plan

0. ✅ Discovery — audit, stack decisions
1. ✅ Product foundation — design system, shell, dashboard shell
2. Authentication + user profile (Supabase)
3. Database + data model (Postgres, RLS)
4. Roadmap engine — phases, topics, prerequisites, progress
5. Resource engine — curated links with metadata
6. Daily learning system — missions, sessions, timer
7. Streak + accountability engine
8. Skills + practice tracking
9. Quiz + revision engine
10. Project system
11. Career path explorer
12. Analytics
13. GitHub integration (with explicit approval)
14. Smart recommendation engine ("What should I do now?")
15. Polish · 16. Security audit · 17. Final QA · 18. Review

## License

Private, personal project.

# Cyber_Path — Final Product Review

**Phase 18 deliverable · September 2026 · Status: all 18 phases complete**

A personal cybersecurity learning command center: a structured, evidence-based
roadmap with real study sessions, honest streaks, spaced revision, quizzes,
projects, career paths and analytics. Built phase-by-phase with a real
database, real authentication and zero fabricated data.

**Live repo:** https://github.com/GhouseNahri/Cyber_Path
**Stack:** Next.js 16 (App Router, React 19, Turbopack) · TypeScript strict ·
Tailwind CSS 4 · Supabase (Postgres + Auth) · Vitest

---

## 1. What was built

| Phase | Deliverable | State |
|---|---|---|
| 0 | Discovery & architecture audit | ✅ |
| 1 | Next.js + Supabase foundation, design system | ✅ |
| 2 | Real auth (email/password, reset, session middleware, RLS) | ✅ |
| 3 | Roadmap: 5 phases / 27 topics / prerequisites / 4-stage loop | ✅ |
| 4 | Daily learning system: missions, sessions, timer, tasks | ✅ |
| 5 | Streak engine + accountability (missed days, varied messages) | ✅ |
| 6 | Skill system deep-dive (theory/practice split, evidence) | ✅ |
| 7 | Notes, bookmarks, settings, data export | ✅ |
| 8 | Labs placeholder (honest empty state) | ⏸ deferred by design |
| 9 | Revision queue (spaced repetition, configurable ladder) | ✅ |
| 10 | Quiz engine (scenario-first, server-side scoring) | ✅ |
| 11 | Project tracker (ideas → milestones → portfolio evidence) | ✅ |
| 12 | Analytics (signals, not vanity metrics) | ✅ |
| 13 | Career path system (6 paths, coverage from real evidence) | ✅ |
| 14 | GitHub integration (OAuth link, repo grid, public portfolio) | ✅ |
| 15 | Smart recommendation engine (explainable, deterministic) | ✅ |
| 16 | Polish (proxy convention, favicon, robots/sitemap, boundaries) | ✅ |
| 17 | Security audit (RLS sweep, CSP/headers, 0 dep vulns) | ✅ |
| 18 | Final QA (full live E2E, 3 fixes) + this review | ✅ |

Core learning loop: **Learn → Practice → Test → Build → Review → Demonstrate.**
A topic is never "complete" from checkboxes alone — completion requires all
four stages, quizzes prove the Test stage, projects prove skills.

## 2. Architecture

- **Next.js App Router**, server components by default; client JS only where
  interaction demands it (session runner, quiz, forms, theme).
- **Server Actions** for all mutations (`src/lib/<domain>/actions.ts`), each
  re-checking auth and deriving `user_id` server-side — never from the client.
- **Pure engines + unit tests** for every domain computation (streak,
  revision, quiz scoring, skills, career coverage, recommendations, session
  generator, analytics): deterministic rules, documented weights, no "AI".
- **`src/lib/supabase/`** holds the only Supabase clients (server, browser,
  proxy). RLS is the security boundary; queries are additionally owner-scoped.
- **proxy.ts** (Next 16 convention) refreshes sessions and gates routes;
  `/portfolio/*` is the only public surface besides auth pages.

## 3. Database

**22 tables**, all with RLS enabled (verified by policy sweep in Phase 17):

- **Content (authenticated-read, write-via-migration only):** `roadmap_phases`,
  `topics`, `topic_prerequisites`, `skills`, `topic_skills`, `resources`,
  `quiz_questions`, `project_ideas`, `career_paths`
- **Per-user (strict owner-only policies, `WITH CHECK` on updates):**
  `profiles`, `user_topic_progress`, `user_topic_bookmarks`, `topic_notes`,
  `daily_tasks`, `study_sessions`, `missed_days`, `topic_reviews`,
  `quiz_attempts`, `user_projects`, `user_resource_status`,
  `user_career_paths`, `github_connections`
- **Migrations 0001–0018** in `supabase/migrations/`, applied via connector.

## 4. Authentication

Supabase Auth, email + password: signup (with username/profile row creation),
login, logout, password reset via emailed link, persistent sessions validated
with `getUser()` (never trusting cookie payloads), OAuth **account linking**
for GitHub (manual linking, token stored server-side only). Route protection
runs in `proxy.ts`; auth pages bounce signed-in users to the dashboard.

## 5. Roadmap structure

Phases 0–4 seeded (27 topics): Orientation → Computer Fundamentals →
Operating Systems → Networking → Programming & Scripting. Each topic carries
summary, why-it-matters, difficulty, estimated minutes, per-stage hints,
prerequisite edges (locking with explicit "complete X first" reasons),
curated resources (official/free-first, honest `last_verified` or an explicit
"unverified — treat as a lead" flag) and scenario-based quiz questions.
Later phases (Security Fundamentals, Crypto, Web, Web Security…) are planned
content drops — the schema and UI already support them.

## 6. Daily learning & sessions

Deterministic mission generator (due revisions → in-progress → next unlocked;
career/weakness tie-breakers; anti-repeat vs yesterday; max 3 tasks sized to
the daily goal). Focused session runner: server-authoritative timer
(start/pause/resume/end with banked pause time, clamp guards, no
double-counting), per-task complete (optional difficulty + note) and skip
(stored reason categories for later pattern analysis), session notes, summary
screen, history with calendar. Timezone-safe day keys (`Asia/Calcutta` etc.)
for missions, streaks and revisions.

## 7. Streak & accountability

Streaks count **real work** (completed sessions/tasks), never opens. Current
/ longest / total active days / at-risk states, milestone messages, and a
missed-day flow: playful-but-kind prompts (varied, deterministic per day,
empathetic for serious reasons), reason categories stored for the analytics
pattern card (which can honestly suggest lowering the daily target).

## 8. Skills, quizzes, projects, careers

- **Skills:** theory% vs practice% kept separate; levels from conservative
  evidence thresholds; project evidence feeds `demonstrated`.
- **Quizzes:** scenario-first questions; the answer key never leaves the
  server; scoring server-side; a pass sets the Test stage via the real
  roadmap path.
- **Projects:** catalog with milestones and authorized-use framing; statuses
  Idea → Planned → Building → Completed → Published; GitHub repo linking;
  completed projects become skill evidence.
- **Careers:** 6 role paths (SOC, Pentesting, Web AppSec, DFIR, Cloud,
  Security Engineer/DevSecOps) with honest framing — coverage is computed
  from the user's actual topics/skills/projects; certifications labeled
  optional; no employment guarantees anywhere.

## 9. GitHub integration & portfolio

OAuth account linking; server-side token persistence (owner-only RLS,
permission-denied to anon); repo grid with a transparent security-relevance
heuristic; project↔repo linking; opt-in public portfolio page
(`/portfolio/[username]`) backed by a security-definer function exposing
only whitelisted data (finished projects, path names, skill levels) — private
and 404 for everyone else by default.

## 10. Analytics

30-day study time, per-day buckets with honest zero days, weekly totals,
velocity vs goal, quiz performance (weakest topics first), missed-day reason
distribution with a lower-your-target suggestion when evidence supports it,
revision queue health, low-confidence list. No vanity metrics.

## 11. Security posture (Phase 17 audit)

- RLS everywhere; owner-only policies with `WITH CHECK`; content tables
  read-only to authenticated users; anon REST probes verified.
- All 33 server actions re-derive identity server-side; no client-supplied
  `user_id` anywhere; quiz scoring authoritative server-side.
- Security headers on every route: CSP (no `unsafe-eval` in prod,
  `frame-ancestors 'none'`), X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy.
- Secrets: only `.env.example` tracked; git history clean; GitHub token
  never rendered to any client.
- `npm audit`: **0 vulnerabilities** (prod and dev trees).
- Data export is owner-only and re-checks auth.

## 12. Testing

- **117 unit tests** (Vitest) across 12 files: streak, revision, session
  generator, elapsed/timezone, quiz engine, skills, career coverage,
  recommendation engine, analytics engine, GitHub mapping.
- **Phase 18 live E2E** (real throwaway account, real DB): auth gate →
  signup → onboarding → dashboard → roadmap/locked reasons → topic detail →
  session lifecycle (pause/resume/complete/skip/notes/summary) → quiz pass
  auto-setting the Test stage → career selection flipping recommendations →
  streak day-one message → history → analytics → projects → skills →
  library → GitHub → settings → JSON export (200).
- **Mobile pass (375×812):** dashboard/session/roadmap clean; Settings
  overflow found and fixed.
- tsc strict, eslint, production build all green.

## 13. Bugs found & fixed during final QA

1. Missed-day accountability prompt nagged brand-new users (no history) —
   now requires prior activity.
2. Session summary "% of mission" counted skipped tasks as progress — now
   completed-only.
3. Settings page overflowed 375px viewports (segmented controls + unbroken
   email string) — grid wrapping + truncation.

## 14. Known limitations

- **Phases 0–4 only:** 27 of the envisioned topics; later phases are future
  content drops.
- **Labs tracker** is an honest placeholder (Phase 8 deferred).
- **Quiz answer key** is readable by an authenticated user querying the
  table directly — acceptable for a self-learning tool (it only cheats the
  cheater); a view/RPC hardening would close it.
- **No rate limiting** on server actions (Supabase Auth throttles auth
  endpoints; app-level limits matter more with a public deployment).
- **Achievements engine** (from the original brief) was intentionally not
  built — streaks/milestones cover the intent without trophy inflation.
- Resource `last_verified` dates are seed-time snapshots; freshness decays.
- Portfolio/sitemap use `localhost:3000` as the base URL until a production
  domain exists.
- The QA E2E account (`qa_e2e_bot`) and the `streak7` test account remain in
  the database; delete them from Supabase Auth if you want a clean slate.

## 15. Future improvements

1. Content drops for phases 5–17 (the schema needs no changes).
2. Lab tracker implementation (Phase 8 scope).
3. Quiz answer hardening via a answers-stripped view + RPC submit.
4. Rate limiting middleware once deployed publicly.
5. Achievements/milestones expansion if wanted.
6. Production deployment: Vercel + custom domain (then sitemap/robots base
   URL update) and CI (lint/typecheck/test on PR).
7. Email digests / reminder notifications (configurable, non-spammy).
8. Smarter rescheduling of skipped tasks (data already captured).

---

*Built phase-by-phase with verification gates between every phase. Every
number in this document reflects the database and code as of the final
commit: `ce0a20e`.*

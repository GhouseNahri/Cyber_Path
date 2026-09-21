-- ===========================================================================
-- Cyber_Path migration 0017 — career path system
--
-- career_paths     : seeded role-path content (public read, writes only via
--                    migrations — same pattern as topics/resources). Every
--                    reference (skill/topic/idea slug) must exist in its seed.
-- user_career_paths: the paths the user selected. Owner-only RLS, one row
--                    per (user, path). Selection is preference data — it
--                    feeds recommendations later, it grants nothing.
--
-- Honest framing lives in the content itself: entry_guidance states that no
-- roadmap guarantees employment and certifications are optional unless a
-- specific employer requires them.
-- ===========================================================================

create table if not exists public.career_paths (
  slug text primary key,
  name text not null,
  nice_category text,
  tagline text not null,
  description text not null,
  responsibilities text[] not null default '{}',
  foundational_skills text[] not null default '{}',
  recommended_topics text[] not null default '{}',
  project_ideas text[] not null default '{}',
  certifications jsonb not null default '[]'::jsonb,
  entry_guidance text not null default '',
  order_index int not null default 0
);

alter table public.career_paths enable row level security;

drop policy if exists "cp_read_all" on public.career_paths;
create policy "cp_read_all" on public.career_paths
  for select to authenticated using (true);

create table if not exists public.user_career_paths (
  user_id uuid not null references auth.users (id) on delete cascade,
  path_slug text not null references public.career_paths (slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, path_slug)
);

alter table public.user_career_paths enable row level security;

drop policy if exists "ucp_select_own" on public.user_career_paths;
create policy "ucp_select_own" on public.user_career_paths
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "ucp_insert_own" on public.user_career_paths;
create policy "ucp_insert_own" on public.user_career_paths
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "ucp_delete_own" on public.user_career_paths;
create policy "ucp_delete_own" on public.user_career_paths
  for delete to authenticated using (auth.uid() = user_id);

-- ── Seed: six role paths. Slugs reference 0004 (topics/skills) and 0016
--    (project ideas) seeds — verified against those files. ─────────────────

insert into public.career_paths (
  slug, name, nice_category, tagline, description, responsibilities,
  foundational_skills, recommended_topics, project_ideas, certifications,
  entry_guidance, order_index
) values
(
  'soc-analyst',
  'SOC / Blue Team Analyst',
  'Securely Provision (SP) / Operate & Maintain (OM) — per NICE, Protective Technology & Analysis family',
  'Defend networks by detecting and responding to attacks in real time.',
  'SOC analysts watch telemetry, triage alerts, investigate suspicious activity and escalate real incidents. This is the most common entry point into defensive security and builds judgment that transfers to forensics, threat hunting and detection engineering.',
  array(select jsonb_array_elements_text('["Triage alerts and decide: benign, suspicious, or incident","Investigate suspicious activity across endpoint, network and identity telemetry","Correlate events across sources to build the full story","Escalate confirmed incidents with clear, complete documentation","Track recurring patterns and suggest detection improvements"]'::jsonb)),
  '{"linux","windows","networking","packet-analysis","security-literacy","python","legal-ethics"}',
  '{"linux-fundamentals","linux-services-logs","windows-fundamentals","networking-models","tcp-udp-ports","dns-fundamentals","packet-analysis","what-is-cybersecurity","security-domains"}',
  '{"log-analyzer","siem-style-log-dashboard","detection-pipeline","file-integrity-monitor"}',
  '[{"name":"CompTIA Security+","note":"Common HR filter for entry SOC roles; optional but widely recognized"},{"name":"TryHackMe SOC Level 1 path","note":"Practical prep; optional"},{"name":"BTLO / Blue Team Labs","note":"Free-form practice; optional"}]'::jsonb,
  'Entry SOC roles typically expect strong fundamentals (networking, Linux, Windows) plus demonstrated curiosity — home labs and log-analysis projects count. No roadmap guarantees employment; job outcomes depend on market, location and interview performance. Certifications listed are optional unless a specific employer requires them.',
  1
),
(
  'penetration-tester',
  'Penetration Tester',
  'Exploit Analysis / Vulnerability Assessment family (NICE: TGT/AVA analogues)',
  'Find and prove exploitable weaknesses — legally, with written permission.',
  'Pentesters simulate real attacks against systems they are contracted to test, then report findings so owners can fix them. The work is reporting-heavy: finding the bug is half the job, communicating it clearly is the other half. Ethics and authorization are non-negotiable.',
  array(select jsonb_array_elements_text('["Scope and plan authorized tests with clear rules of engagement","Reconnaissance and enumeration of in-scope systems","Identify, verify and safely demonstrate exploitable issues","Write findings with business impact and actionable remediation","Retest fixes and maintain professional documentation"]'::jsonb)),
  '{"networking","linux","python","shell","packet-analysis","legal-ethics","security-literacy","windows"}',
  '{"networking-models","ip-addressing","tcp-udp-ports","dns-fundamentals","http-https-tls","linux-fundamentals","linux-permissions","python-basics","python-automation","bash-scripting","ethics-and-law","home-lab-safety"}',
  '{"port-scanner-local","packet-analysis-toolkit","honeypot-controlled"}',
  '[{"name":"CompTIA PenTest+","note":"Optional; maps well to junior pentest roles"},{"name":"OSCP","note":"Respected hands-on cert; a serious investment, not an entry step"},{"name":"eJPT","note":"Optional beginner-friendly practical cert"}]'::jsonb,
  'Almost all professional pentest work requires explicit written authorization — that is what separates the job from crime. Build fundamentals first, practice only on legal targets (labs, CTFs, your own machines), and expect junior roles to value report writing as much as exploitation. No roadmap guarantees employment. Certifications are optional unless a specific employer requires them.',
  2
),
(
  'web-appsec',
  'Web Application Security',
  'Software Assurance / Vulnerability Assessment family (NICE analogue)',
  'Break and secure web applications — the OWASP discipline.',
  'AppSec specialists review web apps and APIs for injection, broken access control, auth flaws and logic bugs, then guide fixes. Positions span offensive (testing), defensive (secure code review) and platform (building security controls) work.',
  array(select jsonb_array_elements_text('["Test web applications for the OWASP Top 10 classes of vulnerability","Review code and architecture for security weaknesses","Guide developers on secure patterns and verify fixes","Assess APIs, authentication flows and session handling","Document findings with reproduction steps and remediation"]'::jsonb)),
  '{"javascript","networking","tls","python","security-literacy","legal-ethics"}',
  '{"http-https-tls","javascript-basics","dns-fundamentals","tcp-udp-ports","python-basics","ethics-and-law","security-domains"}',
  '{"secure-notes-app","secure-api","vuln-management-dashboard"}',
  '[{"name":"PortSwigger Web Security Academy","note":"Free, authoritative practical training; strongly recommended content, not a cert"},{"name":"Burp Suite Certified Practitioner (BSCP)","note":"Optional advanced practical cert"},{"name":"OWASP WSTG","note":"Reference methodology, free"}]'::jsonb,
  'Web security skills are built on real HTTP understanding and hours in deliberately vulnerable labs (PortSwigger Academy, DVWA, juice-shop) — never against systems you lack permission to test. Portfolio value comes from write-ups of lab findings and your own secure-code projects. No roadmap guarantees employment. Certifications are optional unless a specific employer requires them.',
  3
),
(
  'dfir',
  'Digital Forensics / DFIR',
  'Investigation family (NICE: Digital Forensics analogue)',
  'Reconstruct what happened on a system from artifacts and evidence.',
  'DFIR specialists collect and analyze evidence from disks, memory and networks to reconstruct incidents: what ran, who did it, when, and how. Legal handling (chain of custody) matters as much as technical skill.',
  array(select jsonb_array_elements_text('["Acquire forensic images correctly and preserve chain of custody","Analyze disk, memory and log artifacts to build timelines","Identify persistence mechanisms and attacker tooling","Write clear findings suitable for both technical and legal audiences","Support incident response with evidence-driven conclusions"]'::jsonb)),
  '{"linux","windows","networking","packet-analysis","compute-concepts","python","legal-ethics"}',
  '{"how-computers-work","files-filesystems","linux-fundamentals","linux-services-logs","windows-fundamentals","windows-administration","packet-analysis","virtualization","ethics-and-law"}',
  '{"file-integrity-monitor","log-analyzer","packet-analysis-toolkit"}',
  '[{"name":"GCFA (SANS)","note":"Well-regarded; expensive — employer-funded is common; optional"},{"name":"BTL1 (Blue Team Level 1)","note":"Optional practical intro"},{"name":"13Cubed / DFIR-focused content","note":"Free learning references"}]'::jsonb,
  'DFIR rewards patience and documentation discipline more than flash. Practice on your own lab machines and public evidence sets (e.g. NIST CFReDS); never touch real evidence without training and authority. Windows internals and log fluency matter more than tools. No roadmap guarantees employment. Certifications are optional unless a specific employer requires them.',
  4
),
(
  'cloud-security',
  'Cloud Security',
  'Securely Provision / Operate & Maintain family (NICE analogue)',
  'Secure cloud infrastructure: identity, network and configuration at scale.',
  'Cloud security engineers harden AWS/Azure/GCP environments: identity design, network segmentation, encryption, logging and misconfiguration prevention. The roadmap currently covers foundations; deeper cloud content lands in a later phase.',
  array(select jsonb_array_elements_text('["Design identity and access controls following least privilege","Harden cloud network topology (segments, security groups, private endpoints)","Enable and monitor audit logging across services","Detect and prevent common misconfigurations","Guide teams on shared-responsibility boundaries"]'::jsonb)),
  '{"linux","networking","tls","virtualization","compute-concepts","python","security-literacy"}',
  '{"virtualization","linux-fundamentals","networking-models","ip-addressing","http-https-tls","python-basics","security-domains"}',
  '{"secure-api","siem-style-log-dashboard"}',
  '[{"name":"AWS Cloud Practitioner → Security Specialty","note":"Optional; vendor-specific path"},{"name":"Microsoft SC-900/AZ-500","note":"Optional Azure path"},{"name":"Cloud-lab projects","note":"Free-tier hands-on practice in your own account"}]'::jsonb,
  'Learn networking and Linux deeply first — cloud skills layer on top of them, not replace them. Practice only in accounts you own (free tiers, isolated lab projects) and always with billing alarms configured. The roadmap''s cloud phase will expand this path. No roadmap guarantees employment. Certifications are optional unless a specific employer requires them.',
  5
),
(
  'security-engineer',
  'Security Engineer / DevSecOps',
  'Securely Provision family (NICE: Systems Security Analyst analogue)',
  'Build security into systems and pipelines rather than bolting it on.',
  'Security engineers and DevSecOps practitioners embed security across the SDLC: threat modeling, secure defaults, automated scanning in CI/CD, secrets management and container hardening. Heavy overlap with software engineering.',
  array(select jsonb_array_elements_text('["Threat-model new features and systems before they ship","Define secure defaults, standards and review gates","Integrate SAST/DAST/dependency scanning into CI/CD","Manage secrets, key rotation and identity for services","Harden containers and infrastructure-as-code"]'::jsonb)),
  '{"python","bash","javascript","linux","tls","networking","security-literacy"}',
  '{"python-basics","python-automation","bash-scripting","javascript-basics","linux-fundamentals","http-https-tls","virtualization","ethics-and-law"}',
  '{"secure-api","secure-notes-app","vuln-management-dashboard","password-strength-analyzer"}',
  '[{"name":"GitHub Advanced Security / dependency-scanning fluency","note":"Practical skill, free on public repos"},{"name":"CompTIA Security+","note":"Optional baseline"},{"name":"CSSLP","note":"Optional; advanced secure-SDLC cert"}]'::jsonb,
  'This path suits people who already enjoy building software. Strongest candidates can code competently in at least one language and understand CI/CD pain firsthand. Security-plus-engineering beats security-only. No roadmap guarantees employment. Certifications are optional unless a specific employer requires them.',
  6
)
on conflict (slug) do update set
  name = excluded.name,
  nice_category = excluded.nice_category,
  tagline = excluded.tagline,
  description = excluded.description,
  responsibilities = excluded.responsibilities,
  foundational_skills = excluded.foundational_skills,
  recommended_topics = excluded.recommended_topics,
  project_ideas = excluded.project_ideas,
  certifications = excluded.certifications,
  entry_guidance = excluded.entry_guidance,
  order_index = excluded.order_index;

-- ==========================================================================
-- Cyber_Path migration 0005 — seed resources for Phases 0–4
--
-- Every row with last_verified set was fetched successfully on that date
-- during seeding. Rows with last_verified NULL are curated but NOT yet
-- verified — treat them as leads until checked. Sources that 404'd during
-- verification were excluded entirely.
--
-- Idempotent: keyed on (topic_slug, url).
-- ==========================================================================

create extension if not exists pgcrypto;

-- Unique key so the seed can be re-run safely.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'resources_topic_url_key'
  ) then
    alter table public.resources
      add constraint resources_topic_url_key unique (topic_slug, url);
  end if;
end $$;

insert into public.resources
  (topic_slug, title, provider, url, type, difficulty, estimated_minutes, is_free, is_official, priority, last_verified, notes)
values
  -- ── Orientation ───────────────────────────────────────────────────────
  ('what-is-cybersecurity', 'An Introduction to Information Security (SP 800-12 Rev. 1)', 'NIST CSRC',
   'https://csrc.nist.gov/pubs/sp/800/12/r1/final', 'documentation', 'beginner', 120, true, true, 1,
   DATE '2026-09-19', 'Official US government introduction to information security principles.'),
  ('what-is-cybersecurity', 'TryHackMe — Pre-Security learning path', 'TryHackMe',
   'https://tryhackme.com/path/outline/presecurity', 'course', 'beginner', 600, true, false, 2,
   null, 'Curated but NOT verified at seed time (host unreachable from seed tool). Broad beginner grounding across basics; account required.'),

  -- ── Computer Fundamentals ─────────────────────────────────────────────
  ('how-computers-work', 'CS50x: Introduction to Computer Science', 'Harvard / edX',
   'https://cs50.harvard.edu/x/', 'course', 'beginner', 1800, true, true, 2,
   null, 'Curated but NOT verified at seed time (host unreachable from seed tool). Weeks 0–4 cover exactly this topic; free certificate path.'),
  ('files-filesystems', 'Filesystem Hierarchy Standard 3.0', 'Linux Foundation',
   'https://refspecs.linuxfoundation.org/FHS_3.0/fhs/index.html', 'documentation', 'beginner', 60, true, true, 1,
   DATE '2026-09-19', 'The standard defining where everything lives on a UNIX-like filesystem.'),
  ('home-lab-safety', 'VirtualBox User Guide', 'Oracle',
   'https://www.virtualbox.org/manual/', 'documentation', 'beginner', 90, true, true, 1,
   DATE '2026-09-19', 'Official manual: VMs, snapshots and virtual networking — the core of a safe home lab.'),

  -- ── Operating Systems ─────────────────────────────────────────────────
  ('linux-fundamentals', 'OverTheWire: Bandit wargame', 'OverTheWire',
   'https://overthewire.org/wargames/bandit/', 'interactive_lab', 'beginner', 480, true, false, 1,
   DATE '2026-09-19', 'Levels 0–15 map directly to this topic; SSH-based, legal by design.'),
  ('linux-fundamentals', 'GNU Coreutils manual', 'GNU Project',
   'https://www.gnu.org/software/coreutils/manual/', 'documentation', 'beginner', 90, true, true, 2,
   DATE '2026-09-19', 'Reference for ls, chmod, chown, and every core file utility.'),
  ('linux-services-logs', 'OpenSSH manual pages', 'OpenBSD',
   'https://www.openssh.com/manual.html', 'documentation', 'intermediate', 60, true, true, 1,
   DATE '2026-09-19', 'Authoritative reference for ssh, sshd and sshd_config (key auth, hardening).'),
  ('windows-fundamentals', 'Windows security documentation', 'Microsoft Learn',
   'https://learn.microsoft.com/en-us/windows/security/', 'documentation', 'beginner', 90, true, true, 1,
   DATE '2026-09-19', 'Official Windows security docs: accounts, BitLocker, baselines, Defender.'),
  ('windows-administration', 'PowerShell 101', 'Microsoft Learn',
   'https://learn.microsoft.com/en-us/powershell/scripting/learn/ps101/00-introduction', 'book', 'beginner', 300, true, true, 1,
   DATE '2026-09-19', 'Free, no-nonsense PowerShell book hosted by Microsoft for IT pros.'),

  -- ── Networking ────────────────────────────────────────────────────────
  ('networking-models', 'What is the OSI model?', 'Cloudflare Learning',
   'https://www.cloudflare.com/learning/ddos/glossary/open-systems-interconnection-model-osi/', 'article', 'beginner', 20, true, false, 1,
   DATE '2026-09-19', 'Clear plain-language walkthrough of the seven layers.'),
  ('networking-models', 'How does the Internet work?', 'MDN Web Docs',
   'https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/How_does_the_Internet_work', 'article', 'beginner', 20, true, true, 2,
   DATE '2026-09-19', 'Short authoritative primer; pairs well with the OSI article.'),
  ('ip-addressing', 'What is a subnet?', 'Cloudflare Learning',
   'https://www.cloudflare.com/learning/network-layer/what-is-a-subnet/', 'article', 'beginner', 25, true, false, 1,
   DATE '2026-09-19', 'Subnets, masks and CIDR explained with diagrams.'),
  ('tcp-udp-ports', 'What is TCP/IP?', 'Cloudflare Learning',
   'https://www.cloudflare.com/learning/ddos/glossary/tcp-ip/', 'article', 'beginner', 25, true, false, 1,
   DATE '2026-09-19', 'IP addressing and TCP delivery in plain language.'),
  ('dns-fundamentals', 'What is DNS?', 'Cloudflare Learning',
   'https://www.cloudflare.com/learning/dns/what-is-dns/', 'article', 'beginner', 25, true, false, 1,
   DATE '2026-09-19', 'Resolution process, record types and recursive vs authoritative servers.'),
  ('http-https-tls', 'HTTP: Hypertext Transfer Protocol', 'MDN Web Docs',
   'https://developer.mozilla.org/en-US/docs/Web/HTTP', 'documentation', 'beginner', 90, true, true, 1,
   DATE '2026-09-19', 'The canonical HTTP reference: methods, headers, cookies, state.'),
  ('http-https-tls', 'What is TLS?', 'Cloudflare Learning',
   'https://www.cloudflare.com/learning/ssl/transport-layer-security-tls/', 'article', 'beginner', 25, true, false, 2,
   DATE '2026-09-19', 'TLS handshake and certificates in accessible language.'),
  ('packet-analysis', 'Wireshark documentation', 'Wireshark Foundation',
   'https://www.wireshark.org/docs/', 'documentation', 'intermediate', 60, true, true, 1,
   DATE '2026-09-19', 'Official user''s guide — filters, stream following, capture options.'),

  -- ── Programming & Scripting ───────────────────────────────────────────
  ('python-basics', 'The Python Tutorial (official)', 'Python Software Foundation',
   'https://docs.python.org/3/tutorial/', 'documentation', 'beginner', 240, true, true, 1,
   DATE '2026-09-19', 'Chapters 1–7 cover this topic; written by the language authors.'),
  ('python-automation', 'Requests: HTTP for Humans', 'Requests project',
   'https://requests.readthedocs.io/en/latest/', 'documentation', 'intermediate', 60, true, true, 1,
   DATE '2026-09-19', 'The HTTP library used in most security scripting; quickstart is the meat.'),
  ('bash-scripting', 'GNU Bash manual', 'GNU Project / FSF',
   'https://www.gnu.org/software/bash/manual/', 'documentation', 'beginner', 120, true, true, 1,
   DATE '2026-09-19', 'The definitive Bash reference: expansion, redirection, scripting.'),
  ('javascript-basics', 'Dynamic scripting with JavaScript', 'MDN Web Docs',
   'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting', 'course', 'beginner', 180, true, true, 1,
   DATE '2026-09-19', 'MDN''s structured core-JavaScript module — the essentials that web security assumes.')
on conflict (topic_slug, url) do update
  set title = excluded.title,
      provider = excluded.provider,
      type = excluded.type,
      difficulty = excluded.difficulty,
      estimated_minutes = excluded.estimated_minutes,
      is_free = excluded.is_free,
      is_official = excluded.is_official,
      priority = excluded.priority,
      last_verified = excluded.last_verified,
      notes = excluded.notes;

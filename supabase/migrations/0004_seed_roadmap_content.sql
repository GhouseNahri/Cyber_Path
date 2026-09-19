-- ==========================================================================
-- Cyber_Path migration 0004 — seed roadmap content: Phases 0–4
--
-- Orientation, Computer Fundamentals, Operating Systems, Networking,
-- Programming & Scripting. Later phases are seeded in their own build
-- phases. Idempotent: safe to re-run (ON CONFLICT DO NOTHING / UPDATE).
-- ==========================================================================

-- ── Phases ───────────────────────────────────────────────────────────────
insert into public.roadmap_phases (slug, order_index, title, tagline, description, estimated_hours) values
  ('orientation', 0, 'Orientation', 'Why security, and how to learn it safely',
   'What cybersecurity actually is, the domains you can specialize in, the ethics and legal lines you must never cross, and how to set up a lab where it is legal to experiment.', 4),
  ('computer-fundamentals', 1, 'Computer Fundamentals', 'How machines actually work',
   'Processors, memory, storage, processes, files and virtualization. Every security skill rests on understanding the machine underneath.', 6),
  ('operating-systems', 2, 'Operating Systems', 'Windows and Linux from the inside',
   'Users, permissions, processes, services and logs on the two operating systems that dominate security work. Linux first, Windows close behind.', 16),
  ('networking', 3, 'Networking', 'The language computers speak',
   'From the OSI model down to packets: IP addressing, TCP/UDP, DNS, HTTP and TLS. Then learn to actually watch the traffic with Wireshark.', 18),
  ('programming-scripting', 4, 'Programming & Scripting', 'Automate everything',
   'Practical programming for security work: Python for tooling and automation, Bash for the terminal, JavaScript to understand the web, and a taste of C to understand memory.', 20)
on conflict (slug) do update
  set order_index = excluded.order_index,
      title = excluded.title,
      tagline = excluded.tagline,
      description = excluded.description,
      estimated_hours = excluded.estimated_hours;

-- ── Skills ───────────────────────────────────────────────────────────────
insert into public.skills (slug, name, category) values
  ('security-literacy', 'Security Literacy', 'Foundations'),
  ('legal-ethics', 'Ethics & Legal', 'Foundations'),
  ('compute-concepts', 'Computing Concepts', 'Systems'),
  ('virtualization', 'Virtualization', 'Systems'),
  ('linux', 'Linux', 'Systems'),
  ('windows', 'Windows', 'Systems'),
  ('shell', 'Shell Proficiency', 'Systems'),
  ('networking', 'Networking', 'Networking'),
  ('packet-analysis', 'Packet Analysis', 'Networking'),
  ('tls', 'TLS & Encryption in Transit', 'Security'),
  ('python', 'Python', 'Programming'),
  ('bash', 'Bash', 'Programming'),
  ('javascript', 'JavaScript', 'Programming'),
  ('memory-safety', 'Memory & Low-Level Concepts', 'Programming')
on conflict (slug) do update
  set name = excluded.name, category = excluded.category;

-- ── Topics: Phase 0 — Orientation ────────────────────────────────────────
insert into public.topics (slug, phase_slug, order_index, title, summary, why_it_matters, difficulty, estimated_minutes, stage_hints) values
  ('what-is-cybersecurity', 'orientation', 1, 'What is cybersecurity?',
   'The field, its goals (confidentiality, integrity, availability) and the difference between security, safety and compliance.',
   'You cannot navigate a field you cannot describe. This frames every later topic and keeps you oriented when the path branches.',
   'beginner', 45,
   '{"practice": "Explain the CIA triad out loud using three real-world examples you did not read somewhere.", "test": "Write a one-paragraph answer to: what does a security control actually protect?", "build": "Start a learning journal you will keep for the whole roadmap."}'),
  ('security-domains', 'orientation', 2, 'Security domains',
   'The major areas of the field — offensive, defensive, forensics, governance, cloud — and what daily work in each looks like.',
   'Domains have different skills, tools and personalities. Knowing them early stops you from grinding months toward a career you would not enjoy.',
   'beginner', 45,
   '{"practice": "For each domain, name one tool and one job title that belongs to it, from memory.", "test": "Match five job postings you find online to their domains.", "build": "Shortlist two domains that genuinely interest you — this drives your personalization."}'),
  ('ethics-and-law', 'orientation', 3, 'Ethics and legal boundaries',
   'Authorization, responsible disclosure, computer misuse laws, and why "it was just a test" is not a legal defense.',
   'Everything practical you will do lives inside legal boundaries. Internalizing this now protects you and marks you as a professional.',
   'beginner', 60,
   '{"practice": "Write down, in your own words, what you must have before touching any system that is not yours.", "test": "Read a bug bounty program scope and identify what is explicitly out of bounds.", "build": "Save a personal authorization checklist you will reuse before every lab."}'),
  ('career-overview', 'orientation', 4, 'Career paths overview',
   'Entry roles (SOC analyst, junior pentester), what they actually require, and realistic hiring expectations.',
   'You are not just learning — you are aiming. Seeing the roles early lets you pick labs and projects with intent.',
   'beginner', 45,
   '{"practice": "Read five real job postings and list the skills that appear most.", "test": "Answer: what is the difference between what a SOC analyst and a pentester do daily?", "build": "Pick a provisional target role. It can change — pick anyway."}'),
  ('home-lab-safety', 'orientation', 5, 'Building a safe home lab',
   'Isolating lab machines from your real devices and network, snapshots, and safe habits for deliberately vulnerable software.',
   'Hands-on practice is where skills form — but only in an environment where mistakes cannot hurt you or others.',
   'beginner', 60,
   '{"practice": "Install a hypervisor and create your first isolated virtual machine.", "test": "Verify from the VM that it cannot reach your host network shares.", "build": "Document your lab layout — network diagram plus snapshot strategy."}')
on conflict (slug) do update
  set summary = excluded.summary, why_it_matters = excluded.why_it_matters,
      difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
      stage_hints = excluded.stage_hints;

-- ── Topics: Phase 1 — Computer Fundamentals ──────────────────────────────
insert into public.topics (slug, phase_slug, order_index, title, summary, why_it_matters, difficulty, estimated_minutes, stage_hints) values
  ('how-computers-work', 'computer-fundamentals', 1, 'How computers work',
   'CPU, RAM, storage, processes and threads — what happens between power-on and an open application.',
   'Attackers and defenders both operate at the seams of these components. You cannot understand malware, performance or memory bugs without this map.',
   'beginner', 60,
   '{"practice": "On your own machine, find the top five processes by memory and explain what each does.", "test": "Explain to a rubber duck what happens when you open a file, from keyboard to disk.", "build": "Sketch the boot-to-login sequence for your machine."}'),
  ('files-filesystems', 'computer-fundamentals', 2, 'Files and filesystems',
   'Filesystems, paths, metadata, and how permissions are modeled conceptually before any OS-specific details.',
   'Evidence, logs, malware and configurations all live in files. Filesystem fluency is a prerequisite for both OS phases.',
   'beginner', 45,
   '{"practice": "Hide, unhide and hash a file using built-in tools on your OS.", "test": "Explain the difference between a file''s path, name and inode-level identity.", "build": "Create a folder tree for your learning notes and stick to it."}'),
  ('virtualization', 'computer-fundamentals', 3, 'Virtualization basics',
   'Hypervisors, VMs, snapshots and virtual networks — the sandbox layer every security learner lives on.',
   'Labs, malware analysis, network simulation: all of it runs in VMs. You set your first one up in Orientation; now understand what you used.',
   'beginner', 45,
   '{"practice": "Create, snapshot, revert and clone a VM deliberately.", "test": "Explain what a snapshot does and does not protect against.", "build": "Set up a two-VM isolated network you will use for later networking labs."}'),
  ('troubleshooting-basics', 'computer-fundamentals', 4, 'Systematic troubleshooting',
   'A repeatable method: observe, hypothesize, test, narrow. Applied to a machine that will not connect or boot.',
   'Security work is 80% investigation. Troubleshooting is the everyday form of that skill — train the habit early.',
   'beginner', 45,
   '{"practice": "Break something deliberately in a VM (disable networking) and restore it without undo history.", "test": "Write your troubleshooting steps as a checklist you could hand to someone else.", "build": "Keep a ''fixed it'' log for every problem you solve from now on."}')
on conflict (slug) do update
  set summary = excluded.summary, why_it_matters = excluded.why_it_matters,
      difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
      stage_hints = excluded.stage_hints;

-- ── Topics: Phase 2 — Operating Systems ──────────────────────────────────
insert into public.topics (slug, phase_slug, order_index, title, summary, why_it_matters, difficulty, estimated_minutes, stage_hints) values
  ('linux-fundamentals', 'operating-systems', 1, 'Linux fundamentals',
   'The filesystem hierarchy, the shell, users, processes and packages — enough Linux to live in it daily.',
   'Most servers, containers and security tooling run on Linux. Every later phase assumes you are comfortable here.',
   'beginner', 90,
   '{"practice": "Complete a beginner Linux room on TryHackMe or OverTheWire Bandit levels 0–5.", "test": "Find, without searching: where logs, configs and user homes live, and what is running.", "build": "Customize your shell prompt and write your first .bashrc addition."}'),
  ('linux-permissions', 'operating-systems', 2, 'Linux permissions and users',
   'Read/write/execute bits, ownership, sudo, and how privilege separation actually works.',
   'Privilege escalation — both attacking and hardening — is applied permissions. This is one of the most examinable skills in the field.',
   'beginner', 60,
   '{"practice": "Create users and groups, then build a shared directory only they can enter.", "test": "Given an ls -l output, predict who can do what and prove it.", "build": "Audit your own home directory for files that are too permissive."}'),
  ('linux-services-logs', 'operating-systems', 3, 'Linux services, logs and SSH',
   'systemd services, journalctl, SSH keys and remote access — the operational half of Linux.',
   'Defenders read services and logs; attackers abuse them. SSH with keys is also how you will reach every lab machine you ever build.',
   'intermediate', 75,
   '{"practice": "SSH into a VM using key authentication only, then disable password login.", "test": "Trace a service failure from systemctl status to journalctl evidence.", "build": "Write a checklist that audits a Linux box: services, listening ports, sudoers, SSH config."}'),
  ('windows-fundamentals', 'operating-systems', 4, 'Windows fundamentals',
   'The registry, users and groups, NTFS permissions, processes and services in Windows.',
   'Enterprise endpoints are Windows. Active Directory, ransomware, endpoint detection — all of it starts here.',
   'beginner', 90,
   '{"practice": "Complete the TryHackMe Windows Fundamentals rooms.", "test": "Locate event logs, the registry and Task Manager security-relevant details without a guide.", "build": "Map which Windows services on your machine have network access."}'),
  ('windows-administration', 'operating-systems', 5, 'Windows administration and PowerShell',
   'PowerShell essentials for administration: cmdlets, the pipeline, services and scheduled tasks.',
   'PowerShell is the Windows defender''s and attacker''s shared language. Reading it is mandatory; writing it is a superpower.',
   'intermediate', 75,
   '{"practice": "List running services and listening ports with PowerShell one-liners.", "test": "Read a short PowerShell script and explain every line before running it.", "build": "Write a script that inventories installed software into a CSV."}')
on conflict (slug) do update
  set summary = excluded.summary, why_it_matters = excluded.why_it_matters,
      difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
      stage_hints = excluded.stage_hints;

-- ── Topics: Phase 3 — Networking ─────────────────────────────────────────
insert into public.topics (slug, phase_slug, order_index, title, summary, why_it_matters, difficulty, estimated_minutes, stage_hints) values
  ('networking-models', 'networking', 1, 'Network models: OSI and TCP/IP',
   'Layers, encapsulation, and why splitting the problem into layers explains almost everything about networking.',
   'The layer model is the shared vocabulary of every network conversation — tickets, attacks and tools are all described in layers.',
   'beginner', 60,
   '{"practice": "Take a real packet capture and label which layer each part of a frame belongs to.", "test": "Given five symptoms, say which layer each one lives at.", "build": "Draw the journey of one web request through all layers from memory."}'),
  ('ip-addressing', 'networking', 2, 'IP addressing and subnetting',
   'IPv4 addresses, subnet masks, CIDR, private ranges and routing basics.',
   'Subnetting fluency separates people who use networks from people who understand them. It also appears in nearly every technical interview.',
   'beginner', 90,
   '{"practice": "Subnet a /24 into eight networks on paper, then verify in your VM lab.", "test": "Given a weird IP and mask, say which hosts can talk directly.", "build": "Design the addressing plan for your two-VM lab network."}'),
  ('tcp-udp-ports', 'networking', 3, 'TCP, UDP and ports',
   'Handshakes, state, reliability versus speed, and how ports multiplex connections.',
   'Scanning, firewalling and exploitation all reason in ports and protocol states. TCP behavior explains half of what Wireshark shows you.',
   'beginner', 60,
   '{"practice": "Capture a TCP three-way handshake and a UDP exchange; compare them.", "test": "Explain why a SYN scan shows open ports without completing connections.", "build": "Table the ten ports you meet most and what each service does."}'),
  ('dns-fundamentals', 'networking', 4, 'DNS fundamentals',
   'Resolution, record types, caches and recursive vs authoritative servers.',
   'Almost everything on a network starts with a name lookup. DNS is also a classic source of both misconfigurations and attack techniques.',
   'beginner', 60,
   '{"practice": "Use dig and nslookup to trace a real domain from root to answer.", "test": "Predict what a failed lookup looks like on the wire before you capture it.", "build": "Document the full resolution path for a domain of your choice."}'),
  ('dhcp-arp', 'networking', 5, 'DHCP, ARP and the link layer',
   'How machines get addresses, how they find each other on a LAN, and where MAC addresses fit.',
   'Local network attacks — spoofing, starvation, rogue servers — live entirely in this layer. It also explains the bottom of every packet capture.',
   'beginner', 45,
   '{"practice": "Capture a DHCP lease renewal and an ARP exchange in your lab.", "test": "Explain what happens, packet by packet, when a laptop joins a network.", "build": "Map your lab network: IPs, MACs and who learned whom via ARP."}'),
  ('http-https-tls', 'networking', 6, 'HTTP, HTTPS and TLS',
   'Requests, responses, headers, cookies; then TLS handshakes and certificates protecting them.',
   'The web runs on this trio, and so do Phases 7 and 8. TLS literacy also underpins the cryptography phase.',
   'beginner', 75,
   '{"practice": "Read a full TLS handshake in Wireshark and locate the certificate.", "test": "Explain to a non-technical friend why HTTPS padlocks are not a guarantee of safety.", "build": "Compare headers of two real sites and annotate what each is doing."}'),
  ('packet-analysis', 'networking', 7, 'Packet analysis with Wireshark',
   'Filters, following streams, and extracting evidence from captures — the defender''s microscope.',
   'When logs disagree, packets do not lie. This is the single most reusable defensive analysis skill in the roadmap.',
   'intermediate', 90,
   '{"practice": "Complete a TryHackMe Wireshark room; solve at least one capture-the-flag question.", "test": "Given a mystery capture, narrate the story it tells.", "build": "Save three annotated captures showing: handshake, DNS failure, TLS negotiation."}'),
  ('network-devices', 'networking', 8, 'Routers, firewalls, NAT and VPNs',
   'The boxes between you and the internet: routing, NAT, firewall rules and tunneling.',
   'You will configure, bypass and defend these devices for the rest of your career. Segmentation questions in interviews come from here.',
   'beginner', 75,
   '{"practice": "Inspect your own router''s NAT table and firewall rules; explain each line.", "test": "Given a diagram, state where a firewall rule should live and why.", "build": "Draft firewall rules for your lab that block the internet but allow VM-to-VM."}')
on conflict (slug) do update
  set summary = excluded.summary, why_it_matters = excluded.why_it_matters,
      difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
      stage_hints = excluded.stage_hints;

-- ── Topics: Phase 4 — Programming & Scripting ────────────────────────────
insert into public.topics (slug, phase_slug, order_index, title, summary, why_it_matters, difficulty, estimated_minutes, is_optional, stage_hints) values
  ('python-basics', 'programming-scripting', 1, 'Python basics',
   'Variables, control flow, functions, files and errors — enough Python to automate your first tasks.',
   'Python is the lingua franca of security tooling. Scripts you write yourself beat tools you do not understand.',
   'beginner', 120,
   false,
   '{"practice": "Solve five small exercises: file parsing, string manipulation, a loop over logs.", "test": "Read a 30-line script and predict its output before running it.", "build": "Write a script that renames or sorts your notes files automatically."}'),
  ('python-automation', 'programming-scripting', 2, 'Python for automation and APIs',
   'Modules, virtual environments, HTTP requests, JSON and parsing — scripting against the real world.',
   'This is where Python stops being homework: requesting APIs, parsing logs, gluing tools together.',
   'intermediate', 90,
   false,
   '{"practice": "Fetch and parse a public JSON API; print three useful fields.", "test": "Handle a timeout and a malformed response without crashing.", "build": "Build a small log summarizer: reads a file, outputs counts per type."}'),
  ('bash-scripting', 'programming-scripting', 3, 'Bash scripting',
   'Variables, pipes, redirection, grep/sed/awk and writing maintainable shell scripts.',
   'Every Linux box you ever touch speaks shell. One-liners save hours; scripts codify procedures.',
   'beginner', 75,
   false,
   '{"practice": "Write a one-liner that finds the largest five files under a directory.", "test": "Explain what a pipe-heavy command does before executing it.", "build": "Turn your Phase 2 Linux audit checklist into a script."}'),
  ('javascript-basics', 'programming-scripting', 4, 'JavaScript and the browser',
   'The DOM, events, fetch and how client-side code actually executes.',
   'You cannot understand XSS, or half of web security, without knowing what scripts can do in a browser.',
   'beginner', 75,
   false,
   '{"practice": "Change a page''s DOM from the console, then write a script that does it.", "test": "Explain where JavaScript runs and what it can and cannot reach.", "build": "Build a tiny page that calls an API and renders the result."}'),
  ('c-memory-basics', 'programming-scripting', 5, 'C and memory concepts',
   'Compilation, pointers, the stack and heap, and what a buffer overflow actually is at the memory level.',
   'Memory safety failures powered decades of exploitation. Even a conceptual grip of C makes you dangerous in the good way.',
   'advanced', 120,
   true,
   '{"practice": "Compile and run a small C program; deliberately read past an array bound in a debugger.", "test": "Explain stack vs heap to a peer using drawings.", "build": "Annotate a vulnerable C snippet with where and why it breaks."}')
on conflict (slug) do update
  set summary = excluded.summary, why_it_matters = excluded.why_it_matters,
      difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
      is_optional = excluded.is_optional, stage_hints = excluded.stage_hints;

-- ── Prerequisites ────────────────────────────────────────────────────────
insert into public.topic_prerequisites (topic_slug, requires_topic_slug) values
  -- Orientation
  ('security-domains', 'what-is-cybersecurity'),
  ('ethics-and-law', 'what-is-cybersecurity'),
  ('career-overview', 'security-domains'),
  ('home-lab-safety', 'ethics-and-law'),
  -- Computer fundamentals
  ('files-filesystems', 'how-computers-work'),
  ('virtualization', 'how-computers-work'),
  ('troubleshooting-basics', 'how-computers-work'),
  -- Operating systems
  ('linux-fundamentals', 'files-filesystems'),
  ('linux-permissions', 'linux-fundamentals'),
  ('linux-services-logs', 'linux-permissions'),
  ('windows-fundamentals', 'how-computers-work'),
  ('windows-administration', 'windows-fundamentals'),
  -- Networking
  ('networking-models', 'linux-fundamentals'),
  ('ip-addressing', 'networking-models'),
  ('tcp-udp-ports', 'ip-addressing'),
  ('dns-fundamentals', 'tcp-udp-ports'),
  ('dhcp-arp', 'ip-addressing'),
  ('http-https-tls', 'tcp-udp-ports'),
  ('packet-analysis', 'tcp-udp-ports'),
  ('packet-analysis', 'dns-fundamentals'),
  ('network-devices', 'ip-addressing'),
  -- Programming
  ('python-basics', 'linux-fundamentals'),
  ('python-automation', 'python-basics'),
  ('python-automation', 'http-https-tls'),
  ('bash-scripting', 'linux-fundamentals'),
  ('javascript-basics', 'http-https-tls'),
  ('c-memory-basics', 'python-basics'),
  ('c-memory-basics', 'how-computers-work')
on conflict (topic_slug, requires_topic_slug) do nothing;

-- ── Topic ↔ skill mapping ────────────────────────────────────────────────
insert into public.topic_skills (topic_slug, skill_slug, weight) values
  ('what-is-cybersecurity', 'security-literacy', 2.0),
  ('security-domains', 'security-literacy', 2.0),
  ('ethics-and-law', 'legal-ethics', 3.0),
  ('home-lab-safety', 'virtualization', 1.0),
  ('how-computers-work', 'compute-concepts', 3.0),
  ('files-filesystems', 'compute-concepts', 2.0),
  ('virtualization', 'virtualization', 3.0),
  ('troubleshooting-basics', 'compute-concepts', 1.0),
  ('linux-fundamentals', 'linux', 2.0),
  ('linux-fundamentals', 'shell', 2.0),
  ('linux-permissions', 'linux', 2.0),
  ('linux-services-logs', 'linux', 2.0),
  ('linux-services-logs', 'shell', 1.0),
  ('windows-fundamentals', 'windows', 2.0),
  ('windows-administration', 'windows', 2.0),
  ('networking-models', 'networking', 2.0),
  ('ip-addressing', 'networking', 3.0),
  ('tcp-udp-ports', 'networking', 3.0),
  ('dns-fundamentals', 'networking', 2.0),
  ('dhcp-arp', 'networking', 1.0),
  ('http-https-tls', 'networking', 2.0),
  ('http-https-tls', 'tls', 2.0),
  ('packet-analysis', 'packet-analysis', 3.0),
  ('network-devices', 'networking', 2.0),
  ('python-basics', 'python', 3.0),
  ('python-automation', 'python', 3.0),
  ('bash-scripting', 'bash', 3.0),
  ('javascript-basics', 'javascript', 3.0),
  ('c-memory-basics', 'memory-safety', 3.0)
on conflict (topic_slug, skill_slug) do update
  set weight = excluded.weight;

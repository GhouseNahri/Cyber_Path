-- ===========================================================================
-- Cyber_Path migration 0027 — built-in simulations (L3: analysis scenarios)
--
-- Seeds the SOC / networking / forensics simulations. Same mechanics as 0026:
-- completion_criteria.mode "sim" — validated server-side after every command
-- by the sim engine, state persisted per user in lab_sim_states.
-- ===========================================================================

insert into public.labs
  (slug, title, summary, objective, category_slug, lab_type, difficulty,
   estimated_minutes, provider, external_url, instructions, learning_objectives,
   completion_criteria, hints, ticks_practice_stage, is_published)
values
  ('sim-soc-auth-triage',
   'Sim: SOC — SSH brute-force triage',
   'A built-in terminal with a synthetic auth log: a brute-force burst, one success after it, and post-compromise noise. Triage it end to end.',
   'Count the failed attempts, identify the attacker IP, find the successful login that followed, read the sudo fallout, and record a verdict note.',
   'soc-blue-team', 'simulation', 'intermediate', 30,
   '', null,
   'Work in the simulated shell. Start by reading auth.log, then use grep -c "Failed password" to size the burst, grep for the attacker IP, grep Accepted for the compromise moment, and finish with notes <verdict>. All log data is synthetic.',
   array['Size a brute-force burst with grep -c', 'Correlate failure bursts with subsequent successes', 'Recognize post-compromise sudo activity', 'Write a concise evidence-based verdict'],
   '{"mode": "sim", "sim_key": "soc-auth-triage"}'::jsonb,
   '[{"tier": 1, "text": "The success that matters comes AFTER the failure burst stops — grep Accepted and compare timestamps."}, {"tier": 2, "text": "The sudo line right after the success shows the attacker guessing for privilege escalation."}]'::jsonb,
   false, true),
  ('sim-dns-exfil-hunt',
   'Sim: networking — DNS exfiltration hunt',
   'A built-in terminal with a synthetic DNS query log: normal traffic hiding an encoded TXT-record tunnel to one suspicious subdomain.',
   'Spot the exfil pattern, count the tunneled queries, identify the internal client, and contrast it with the normal traffic.',
   'networking', 'simulation', 'intermediate', 25,
   '', null,
   'Work in the simulated shell. Read dns.log, grep for the exfil subdomain, count the burst with grep -c, and identify the client IP sending it. The playbook file in your home folder has the method.',
   array['Recognize DNS tunneling signatures (TXT bursts, encoded labels)', 'Quantify the behavior with grep -c', 'Attribute activity to an internal client', 'Differentiate anomaly from baseline traffic'],
   '{"mode": "sim", "sim_key": "dns-exfil-hunt"}'::jsonb,
   '[{"tier": 1, "text": "grep exfil dns.log — every hit shares one subdomain and one source IP."}, {"tier": 2, "text": "Normal queries are A/AAAA to varied domains; the tunnel is TXT to one host, 8 of them."}]'::jsonb,
   false, true),
  ('sim-forensic-timeline',
   'Sim: forensics — timeline reconstruction',
   'A built-in terminal with staged evidence: file timestamps, a wget script and the actor''s own shell history. Rebuild the kill chain.',
   'Collect timestamps with stat, read the shell history, establish the first compromise action, and name the C2 host from the artifacts.',
   'digital-forensics', 'simulation', 'intermediate', 30,
   '', null,
   'Work in the simulated shell. stat every file in evidence/, read .bash_history_readonly (the actor''s own record), and correlate: first action, download, execution, persistence. Name the C2 host from the wget/curl artifacts.',
   array['Build a timeline from file mtimes', 'Use shell history as actor attribution', 'Order a kill chain: access → download → execute → persist', 'Extract IOC: the C2 host'],
   '{"mode": "sim", "sim_key": "forensic-timeline"}'::jsonb,
   '[{"tier": 1, "text": "stat each file and sort the Modify times — the earliest suspicious event starts the chain."}, {"tier": 2, "text": "The history file ends with ./payload --persist — that is the persistence step; the C2 IP appears twice."}]'::jsonb,
   false, true)
on conflict (slug) do update
  set title = excluded.title, summary = excluded.summary, objective = excluded.objective,
      category_slug = excluded.category_slug, lab_type = excluded.lab_type,
      difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
      provider = excluded.provider, external_url = excluded.external_url,
      instructions = excluded.instructions, learning_objectives = excluded.learning_objectives,
      completion_criteria = excluded.completion_criteria, hints = excluded.hints,
      ticks_practice_stage = excluded.ticks_practice_stage, is_published = excluded.is_published,
      updated_at = now();

insert into public.lab_topics (lab_slug, topic_slug) values
  ('sim-soc-auth-triage', 'linux-services-logs'),
  ('sim-dns-exfil-hunt', 'dns-fundamentals'),
  ('sim-dns-exfil-hunt', 'packet-analysis'),
  ('sim-forensic-timeline', 'files-filesystems')
on conflict (lab_slug, topic_slug) do nothing;

insert into public.lab_skills (lab_slug, skill_slug, weight) values
  ('sim-soc-auth-triage', 'linux', 1.5),
  ('sim-soc-auth-triage', 'packet-analysis', 1.5),
  ('sim-dns-exfil-hunt', 'networking', 2.0),
  ('sim-dns-exfil-hunt', 'packet-analysis', 2.0),
  ('sim-forensic-timeline', 'compute-concepts', 1.5),
  ('sim-forensic-timeline', 'linux', 1.0)
on conflict (lab_slug, skill_slug) do update
  set weight = excluded.weight;

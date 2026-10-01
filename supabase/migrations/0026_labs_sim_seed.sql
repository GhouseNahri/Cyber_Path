-- ===========================================================================
-- Cyber_Path migration 0026 — built-in simulations (L2)
--
-- Seeds the first two built-in simulation labs. completion_criteria.mode is
-- "sim": the objective is validated server-side by the sim engine
-- (src/lib/labs/sims/) after every command — the client cannot self-complete.
-- lab_sim_states (0023) persists each user's virtual filesystem per lab.
--
-- These are the first labs where Cyber_Path itself provides the environment:
-- nothing executes outside a pure TypeScript evaluation against simulated
-- state. A real shell is never involved.
-- ===========================================================================

insert into public.labs
  (slug, title, summary, objective, category_slug, lab_type, difficulty,
   estimated_minutes, provider, external_url, instructions, learning_objectives,
   completion_criteria, hints, ticks_practice_stage, is_published)
values
  ('sim-permission-repair',
   'Sim: permission repair drill',
   'A built-in terminal with a deliberately mis-permissioned home directory — fix it with chmod and prove you understand denials.',
   'Repair the world-writable notes file, lock the credentials file to 640, keep the script group-executable, and demonstrate the two denials every professional should recognize.',
   'linux', 'simulation', 'beginner', 30,
   '', null,
   'Work directly in the simulated shell below. Start with ls -l to see the damage, then chmod each file to its target mode. Two objectives require you to trigger and observe denials — sam''s home and a chown you are not allowed to run. Nothing here touches a real system.',
   array['Read ls -l output fluently (rwx triples, owner, group)', 'Choose correct octal modes for least privilege', 'Recognize traversal and ownership denials as data, not frustration'],
   '{"mode": "sim", "sim_key": "linux-permissions"}'::jsonb,
   '[{"tier": 1, "text": "640 = rw- r-- --- : owner writes, group reads, others nothing."}, {"tier": 2, "text": "chmod only works on files you own — the chown denial is itself an objective."}]'::jsonb,
   true,
   true),
  ('sim-file-hunt',
   'Sim: hidden files and find',
   'A built-in terminal: find a hidden token file and files owned by another user using ls -a, find and grep.',
   'Locate the hidden dotfile in /home/svc, list svc''s files with find -user, grep for the Token mention, and read what it says.',
   'linux', 'simulation', 'easy', 25,
   '', null,
   'Work directly in the simulated shell below. ls -a exposes dotfiles; find <path> -user <name> lists ownership; grep <pattern> <file> confirms content. You cannot read svc''s private file — and discovering that is part of the lesson. Nothing here touches a real system.',
   array['Reveal hidden files with ls -a', 'Search by ownership with find -user', 'Search inside files with grep', 'Respect permission boundaries in practice, not just theory'],
   '{"mode": "sim", "sim_key": "linux-file-hunt"}'::jsonb,
   '[{"tier": 1, "text": "find /home -user svc — then try cat on the token file and read the denial carefully."}, {"tier": 2, "text": "The Token mention lives in your own downloads folder, not in svc''s files."}]'::jsonb,
   false,
   true)
on conflict (slug) do update
  set title = excluded.title, summary = excluded.summary, objective = excluded.objective,
      category_slug = excluded.category_slug, lab_type = excluded.lab_type,
      difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
      provider = excluded.provider, external_url = excluded.external_url,
      instructions = excluded.instructions, learning_objectives = excluded.learning_objectives,
      completion_criteria = excluded.completion_criteria, hints = excluded.hints,
      ticks_practice_stage = excluded.ticks_practice_stage, is_published = excluded.is_published,
      updated_at = now();

-- Both sims map to the Linux topics they exercise.
insert into public.lab_topics (lab_slug, topic_slug) values
  ('sim-permission-repair', 'linux-permissions'),
  ('sim-permission-repair', 'files-filesystems'),
  ('sim-file-hunt', 'linux-fundamentals'),
  ('sim-file-hunt', 'files-filesystems')
on conflict (lab_slug, topic_slug) do nothing;

insert into public.lab_skills (lab_slug, skill_slug, weight) values
  ('sim-permission-repair', 'linux', 2.0),
  ('sim-permission-repair', 'shell', 1.5),
  ('sim-file-hunt', 'linux', 1.5),
  ('sim-file-hunt', 'shell', 2.0)
on conflict (lab_slug, skill_slug) do update
  set weight = excluded.weight;

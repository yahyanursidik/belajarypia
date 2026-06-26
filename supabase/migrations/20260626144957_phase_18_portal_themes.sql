alter table public.system_settings
add column if not exists portal_themes jsonb default '{"admin": "indigo", "learner": "emerald", "teacher": "rose", "public": "amber"}'::jsonb;

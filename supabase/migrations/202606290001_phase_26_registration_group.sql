alter table public.registration_forms
add column if not exists group_settings jsonb default '{"platform": "none", "separated_gender": false, "ikhwan_groups": [], "akhwat_groups": [], "general_groups": []}'::jsonb;

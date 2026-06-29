alter table public.system_settings
add column if not exists transcript_header_text text,
add column if not exists transcript_place_date_text text,
add column if not exists transcript_official_name text,
add column if not exists transcript_official_title text,
add column if not exists transcript_signature_url text;

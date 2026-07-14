alter table public.donor_commitments
  add column if not exists reminder_day_of_month integer
    check (reminder_day_of_month is null or (reminder_day_of_month between 1 and 28)),
  add column if not exists wakaf_asset text,
  add column if not exists wakaf_asset_value numeric(12, 2),
  add column if not exists wakaf_purpose text,
  add column if not exists wakaf_external_url text,
  add column if not exists wakaf_contact_admin boolean not null default true;

update public.donor_commitments
set reminder_day_of_month = extract(day from next_reminder_at)::integer
where reminder_day_of_month is null
  and next_reminder_at is not null
  and extract(day from next_reminder_at)::integer between 1 and 28;

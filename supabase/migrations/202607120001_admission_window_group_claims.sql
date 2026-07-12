alter table public.registration_forms
add column if not exists registration_open_at timestamptz,
add column if not exists registration_close_at timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'registration_form_fields_field_type_check'
      and conrelid = 'public.registration_form_fields'::regclass
  ) then
    alter table public.registration_form_fields
    drop constraint registration_form_fields_field_type_check;
  end if;

  alter table public.registration_form_fields
  add constraint registration_form_fields_field_type_check
  check (field_type in ('text', 'textarea', 'email', 'phone', 'select', 'file'));
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registration_forms_window_order_check'
      and conrelid = 'public.registration_forms'::regclass
  ) then
    alter table public.registration_forms
    add constraint registration_forms_window_order_check
    check (
      registration_open_at is null
      or registration_close_at is null
      or registration_open_at < registration_close_at
    );
  end if;
end $$;

create table if not exists public.registration_group_link_claims (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.registration_forms(id) on delete cascade,
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  group_bucket text not null check (group_bucket in ('general_groups', 'ikhwan_groups', 'akhwat_groups')),
  group_index int not null default 0,
  group_name text not null,
  group_link text not null,
  claimed_at timestamptz not null default now(),
  unique (form_id, applicant_id)
);

create index if not exists registration_group_link_claims_form_group_idx
on public.registration_group_link_claims(form_id, group_bucket, group_index);

alter table public.registration_group_link_claims enable row level security;

drop policy if exists "registration_group_link_claims_admin_select_scoped" on public.registration_group_link_claims;
create policy "registration_group_link_claims_admin_select_scoped"
on public.registration_group_link_claims
for select
to authenticated
using (
  exists (
    select 1
    from public.registration_forms rf
    where rf.id = registration_group_link_claims.form_id
      and (
        public.is_super_admin()
        or public.has_role('admin')
        or (rf.program_id is not null and public.can_access_program(rf.program_id))
      )
  )
);

create or replace function public.claim_registration_group_link(
  p_form_id uuid,
  p_applicant_id uuid,
  p_gender text default null
)
returns table (
  group_name text,
  group_link text,
  group_bucket text,
  group_index int,
  click_limit int,
  click_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.registration_forms%rowtype;
  v_settings jsonb;
  v_bucket text;
  v_groups jsonb;
  v_group jsonb;
  v_index int;
  v_limit int;
  v_count int;
  v_gender text := lower(coalesce(p_gender, ''));
  v_existing public.registration_group_link_claims%rowtype;
begin
  select *
  into v_existing
  from public.registration_group_link_claims claims
  where claims.form_id = p_form_id
    and claims.applicant_id = p_applicant_id
  limit 1;

  if found then
    select count(*)::int
    into v_count
    from public.registration_group_link_claims claims
    where claims.form_id = v_existing.form_id
      and claims.group_bucket = v_existing.group_bucket
      and claims.group_index = v_existing.group_index;

    group_name := v_existing.group_name;
    group_link := v_existing.group_link;
    group_bucket := v_existing.group_bucket;
    group_index := v_existing.group_index;
    click_limit := null;
    click_count := v_count;
    return next;
    return;
  end if;

  select *
  into v_form
  from public.registration_forms rf
  where rf.id = p_form_id
    and rf.status = 'active'
    and (rf.registration_open_at is null or now() >= rf.registration_open_at)
    and (rf.registration_close_at is null or now() <= rf.registration_close_at)
  for update;

  if not found then
    raise exception 'Pendaftaran belum dibuka atau sudah ditutup.';
  end if;

  v_settings := coalesce(
    v_form.group_settings,
    '{"platform": "none", "separated_gender": false, "ikhwan_groups": [], "akhwat_groups": [], "general_groups": []}'::jsonb
  );

  if coalesce(v_settings->>'platform', 'none') = 'none' then
    raise exception 'Tautan grup tidak diaktifkan untuk form ini.';
  end if;

  if coalesce((v_settings->>'separated_gender')::boolean, false) then
    if v_gender in ('laki-laki', 'laki laki', 'male', 'ikhwan', 'm') then
      v_bucket := 'ikhwan_groups';
    elsif v_gender in ('perempuan', 'female', 'akhwat', 'f') then
      v_bucket := 'akhwat_groups';
    else
      v_bucket := 'general_groups';
    end if;
  else
    v_bucket := 'general_groups';
  end if;

  v_groups := coalesce(v_settings -> v_bucket, '[]'::jsonb);

  if jsonb_array_length(v_groups) = 0 and v_bucket <> 'general_groups' then
    v_bucket := 'general_groups';
    v_groups := coalesce(v_settings -> v_bucket, '[]'::jsonb);
  end if;

  if jsonb_array_length(v_groups) = 0 then
    raise exception 'Tautan grup belum tersedia.';
  end if;

  for v_group, v_index in
    select value, (ordinality::int - 1)
    from jsonb_array_elements(v_groups) with ordinality
  loop
    if coalesce(v_group->>'link', '') = '' then
      continue;
    end if;

    v_limit := case
      when coalesce(v_group->>'click_limit', '') ~ '^[0-9]+$' then (v_group->>'click_limit')::int
      else 500
    end;

    select count(*)::int
    into v_count
    from public.registration_group_link_claims claims
    where claims.form_id = p_form_id
      and claims.group_bucket = v_bucket
      and claims.group_index = v_index;

    if v_limit <= 0 or v_count < v_limit then
      insert into public.registration_group_link_claims (
        form_id,
        applicant_id,
        group_bucket,
        group_index,
        group_name,
        group_link
      )
      values (
        p_form_id,
        p_applicant_id,
        v_bucket,
        v_index,
        coalesce(nullif(v_group->>'name', ''), 'Grup ' || (v_index + 1)::text),
        v_group->>'link'
      )
      returning registration_group_link_claims.group_name,
        registration_group_link_claims.group_link,
        registration_group_link_claims.group_bucket,
        registration_group_link_claims.group_index
      into group_name, group_link, group_bucket, group_index;

      click_limit := v_limit;
      click_count := v_count + 1;
      return next;
      return;
    end if;
  end loop;

  raise exception 'Semua tautan grup sudah mencapai batas klik.';
end;
$$;

grant execute on function public.claim_registration_group_link(uuid, uuid, text) to anon, authenticated;

drop policy if exists "applicant_program_choices_public_insert" on public.applicant_program_choices;
create policy "applicant_program_choices_public_insert"
on public.applicant_program_choices
for insert
to anon, authenticated
with check (
  public.can_access_program(program_id)
  or exists (
    select 1
    from public.registration_forms rf
    where (rf.program_id = applicant_program_choices.program_id or rf.program_id is null)
      and rf.status = 'active'
      and (rf.registration_open_at is null or now() >= rf.registration_open_at)
      and (rf.registration_close_at is null or now() <= rf.registration_close_at)
  )
);

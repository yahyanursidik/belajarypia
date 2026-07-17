create or replace function public.can_mentor_halaqah(target_halaqah_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.has_role('admin')
    or exists (
      select 1
      from public.halaqahs h
      where h.id = target_halaqah_id
        and h.mentor_user_id = auth.uid()
        and h.status = 'active'
    );
$$;

drop policy if exists "halaqahs_select_assigned_mentor" on public.halaqahs;
create policy "halaqahs_select_assigned_mentor"
on public.halaqahs for select to authenticated
using (public.can_mentor_halaqah(id));

drop policy if exists "classes_select_assigned_mentor" on public.classes;
create policy "classes_select_assigned_mentor"
on public.classes for select to authenticated
using (
  exists (
    select 1 from public.halaqahs h
    where h.class_id = classes.id
      and public.can_mentor_halaqah(h.id)
  )
);

drop policy if exists "enrollments_select_assigned_mentor" on public.enrollments;
create policy "enrollments_select_assigned_mentor"
on public.enrollments for select to authenticated
using (halaqah_id is not null and public.can_mentor_halaqah(halaqah_id));

drop policy if exists "participants_select_assigned_mentor" on public.participants;
create policy "participants_select_assigned_mentor"
on public.participants for select to authenticated
using (
  exists (
    select 1 from public.enrollments e
    where e.participant_id = participants.id
      and e.halaqah_id is not null
      and public.can_mentor_halaqah(e.halaqah_id)
  )
);

create table if not exists public.quran_submissions (
  id uuid primary key default gen_random_uuid(),
  halaqah_id uuid not null references public.halaqahs(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  assessment_date date not null default current_date,
  submission_type text not null default 'hafalan' check (submission_type in ('hafalan', 'murajaah', 'tilawah')),
  surah_name text not null,
  ayah_from int check (ayah_from is null or ayah_from > 0),
  ayah_to int check (ayah_to is null or ayah_to > 0),
  fluency_score int check (fluency_score between 0 and 100),
  tajwid_score int check (tajwid_score between 0 and 100),
  memorization_score int check (memorization_score between 0 and 100),
  notes text,
  next_target text,
  recorded_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ayah_to is null or ayah_from is null or ayah_to >= ayah_from)
);

create index if not exists quran_submissions_halaqah_date_idx
on public.quran_submissions(halaqah_id, assessment_date desc);

create index if not exists quran_submissions_enrollment_date_idx
on public.quran_submissions(enrollment_id, assessment_date desc);

drop trigger if exists quran_submissions_set_updated_at on public.quran_submissions;
create trigger quran_submissions_set_updated_at
before update on public.quran_submissions
for each row execute function public.set_updated_at();

alter table public.quran_submissions enable row level security;

drop policy if exists "quran_submissions_select_accessible" on public.quran_submissions;
create policy "quran_submissions_select_accessible"
on public.quran_submissions for select to authenticated
using (
  public.can_mentor_halaqah(halaqah_id)
  or exists (
    select 1
    from public.enrollments e
    join public.participants p on p.id = e.participant_id
    where e.id = quran_submissions.enrollment_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "quran_submissions_insert_mentor" on public.quran_submissions;
create policy "quran_submissions_insert_mentor"
on public.quran_submissions for insert to authenticated
with check (
  public.has_role('mentor')
  and public.can_mentor_halaqah(halaqah_id)
  and recorded_by = auth.uid()
  and exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id
      and e.halaqah_id = quran_submissions.halaqah_id
  )
);

drop policy if exists "quran_submissions_update_mentor" on public.quran_submissions;
create policy "quran_submissions_update_mentor"
on public.quran_submissions for update to authenticated
using (recorded_by = auth.uid() and public.can_mentor_halaqah(halaqah_id))
with check (recorded_by = auth.uid() and public.can_mentor_halaqah(halaqah_id));

drop policy if exists "quran_submissions_delete_mentor" on public.quran_submissions;
create policy "quran_submissions_delete_mentor"
on public.quran_submissions for delete to authenticated
using (recorded_by = auth.uid() and public.can_mentor_halaqah(halaqah_id));

grant select, insert, update, delete on public.quran_submissions to authenticated;

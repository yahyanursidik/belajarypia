-- Participant engagement: protected login activity for staff and automatic learning updates.

create or replace function public.get_participant_login_activity(p_participant_ids uuid[] default null)
returns table (
  participant_id uuid,
  last_login_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    participant.id,
    auth_user.last_sign_in_at
  from public.participants participant
  left join auth.users auth_user on auth_user.id = participant.user_id
  where (
    p_participant_ids is null
    or cardinality(p_participant_ids) = 0
    or participant.id = any(p_participant_ids)
  )
  and (public.has_role('admin') or public.is_super_admin());
$$;

revoke all on function public.get_participant_login_activity(uuid[]) from public;
grant execute on function public.get_participant_login_activity(uuid[]) to authenticated;

create or replace function public.create_lesson_publication_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_program_id uuid;
  v_program_name text;
  v_label text;
begin
  if new.visibility_status <> 'published'
    or (tg_op = 'UPDATE' and old.visibility_status = 'published')
    or new.lesson_type not in ('content', 'quiz', 'exam') then
    return new;
  end if;

  select program.id, program.name
  into v_program_id, v_program_name
  from public.program_modules module
  join public.programs program on program.id = module.program_id
  where module.id = new.module_id;

  if v_program_id is null then
    return new;
  end if;

  v_label := case new.lesson_type
    when 'quiz' then 'Kuis baru'
    when 'exam' then 'Ujian baru'
    else 'Materi baru'
  end;

  insert into public.announcements (
    title,
    content,
    target_role,
    target_program_id,
    status,
    created_by
  )
  values (
    format('%s: %s', v_label, new.title),
    format('%s "%s" sudah tersedia di program %s. Silakan buka Program Saya untuk mempelajarinya.', v_label, new.title, v_program_name),
    'participant',
    v_program_id,
    'published',
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists lessons_create_publication_announcement on public.lessons;
create trigger lessons_create_publication_announcement
after insert or update of visibility_status on public.lessons
for each row execute function public.create_lesson_publication_announcement();

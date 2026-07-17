create or replace function public.update_teacher_program_syllabus(
  target_program_id uuid,
  target_syllabus text
)
returns public.programs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_program public.programs;
  normalized_syllabus text := trim(coalesce(target_syllabus, ''));
begin
  if auth.uid() is null then
    raise exception 'Sesi pengguna tidak valid.';
  end if;

  if not (public.has_role('teacher') or public.has_role('mentor')) then
    raise exception 'Hanya pengajar atau mentor yang dapat memperbarui silabus.';
  end if;

  if not public.can_teach_program(target_program_id) then
    raise exception 'Anda tidak memiliki akses mengajar pada program ini.';
  end if;

  if char_length(normalized_syllabus) < 40 then
    raise exception 'Silabus minimal 40 karakter.';
  end if;

  update public.programs
  set syllabus = normalized_syllabus
  where id = target_program_id
  returning * into updated_program;

  if updated_program.id is null then
    raise exception 'Program tidak ditemukan.';
  end if;

  return updated_program;
end;
$$;

revoke all on function public.update_teacher_program_syllabus(uuid, text) from public;
grant execute on function public.update_teacher_program_syllabus(uuid, text) to authenticated;

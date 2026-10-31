-- Placement is an explicit operation; never re-enroll or reset learning progress.
create or replace function public.admin_update_enrollment_placement(
  target_enrollment_id uuid,
  target_batch_id uuid default null,
  target_class_id uuid default null,
  target_halaqah_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  enrollment_record public.enrollments%rowtype;
  class_record public.classes%rowtype;
  halaqah_record public.halaqahs%rowtype;
  occupied integer;
begin
  if auth.uid() is null or not (public.is_super_admin() or public.has_role('admin')) then
    raise exception 'Hanya administrator yang dapat mengatur penempatan.';
  end if;
  select * into enrollment_record from public.enrollments where id=target_enrollment_id for update;
  if not found then raise exception 'Enrollment tidak ditemukan.'; end if;
  if not public.can_access_program(enrollment_record.program_id) then
    raise exception 'Anda tidak memiliki akses ke program ini.';
  end if;
  if enrollment_record.enrollment_status not in ('pending','active','hold') then
    raise exception 'Penempatan hanya dapat diubah untuk enrollment berjalan.';
  end if;
  if not exists (select 1 from public.participants where id=enrollment_record.participant_id and status='active') then
    raise exception 'Peserta tidak aktif.';
  end if;
  if not exists (select 1 from public.programs where id=enrollment_record.program_id and status<>'archived') then
    raise exception 'Program diarsipkan.';
  end if;
  if target_batch_id is not null and not exists (
    select 1 from public.batches where id=target_batch_id and program_id=enrollment_record.program_id and status='active'
  ) then raise exception 'Angkatan tidak sesuai atau belum aktif.'; end if;
  if target_class_id is not null then
    select * into class_record from public.classes where id=target_class_id;
    if not found or class_record.program_id<>enrollment_record.program_id or class_record.status<>'active'
      or class_record.batch_id is distinct from target_batch_id then
      raise exception 'Kelas tidak sesuai dengan program atau angkatan.';
    end if;
  elsif target_halaqah_id is not null then
    raise exception 'Pilih kelas sebelum memilih halaqah.';
  end if;
  if target_halaqah_id is not null then
    select * into halaqah_record from public.halaqahs where id=target_halaqah_id;
    if not found or halaqah_record.class_id<>target_class_id or halaqah_record.status<>'active' then
      raise exception 'Halaqah tidak sesuai dengan kelas atau belum aktif.';
    end if;
  end if;

  -- Lock old/new groups in a stable order before counting occupied seats.
  perform id from public.classes where id in (enrollment_record.class_id,target_class_id) order by id for update;
  perform id from public.halaqahs where id in (enrollment_record.halaqah_id,target_halaqah_id) order by id for update;
  if target_class_id is not null then
    select * into class_record from public.classes where id=target_class_id;
    if not found or class_record.status<>'active' or class_record.program_id<>enrollment_record.program_id or class_record.batch_id is distinct from target_batch_id then
      raise exception 'Kelas berubah. Muat ulang pilihan penempatan.';
    end if;
  end if;
  if target_halaqah_id is not null then
    select * into halaqah_record from public.halaqahs where id=target_halaqah_id;
    if not found or halaqah_record.status<>'active' or halaqah_record.class_id<>target_class_id then
      raise exception 'Halaqah berubah. Muat ulang pilihan penempatan.';
    end if;
  end if;
  if target_class_id is distinct from enrollment_record.class_id and class_record.capacity is not null then
    select count(*) into occupied from public.enrollments
    where class_id=target_class_id and id<>target_enrollment_id and enrollment_status in ('pending','active','hold');
    if occupied>=class_record.capacity then raise exception 'Kapasitas kelas sudah penuh.'; end if;
  end if;
  if target_halaqah_id is distinct from enrollment_record.halaqah_id and halaqah_record.capacity is not null then
    select count(*) into occupied from public.enrollments
    where halaqah_id=target_halaqah_id and id<>target_enrollment_id and enrollment_status in ('pending','active','hold');
    if occupied>=halaqah_record.capacity then raise exception 'Kapasitas halaqah sudah penuh.'; end if;
  end if;
  if enrollment_record.batch_id is not distinct from target_batch_id
    and enrollment_record.class_id is not distinct from target_class_id
    and enrollment_record.halaqah_id is not distinct from target_halaqah_id then
    return jsonb_build_object('enrollment_id',target_enrollment_id,'status','unchanged');
  end if;
  update public.enrollments set batch_id=target_batch_id,class_id=target_class_id,halaqah_id=target_halaqah_id
  where id=target_enrollment_id;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'enrollment.placement','enrollment',target_enrollment_id,jsonb_build_object(
    'previous',jsonb_build_object('batch_id',enrollment_record.batch_id,'class_id',enrollment_record.class_id,'halaqah_id',enrollment_record.halaqah_id),
    'current',jsonb_build_object('batch_id',target_batch_id,'class_id',target_class_id,'halaqah_id',target_halaqah_id)
  ));
  return jsonb_build_object('enrollment_id',target_enrollment_id,'status','saved');
end;
$$;
revoke all on function public.admin_update_enrollment_placement(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.admin_update_enrollment_placement(uuid,uuid,uuid,uuid) to authenticated;

create index if not exists enrollments_class_id_idx on public.enrollments(class_id);
create index if not exists enrollments_halaqah_id_idx on public.enrollments(halaqah_id);

-- Manage each participant's guardian relationships in one authorized transaction.
create or replace function public.admin_manage_participant_guardian(
  p_participant_id uuid,
  p_action text,
  p_profile_id uuid default null,
  p_relation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_record public.participants%rowtype;
  relation_record public.guardian_participants%rowtype;
  guardian_id_value uuid;
  relation_id_value uuid;
begin
  if auth.uid() is null or not (
    public.is_super_admin() or
    (public.has_role('admin') and public.can_access_participant(p_participant_id))
  ) then
    raise exception 'Anda tidak memiliki akses untuk mengelola wali peserta ini.';
  end if;
  if p_action is null or p_action not in ('attach', 'primary', 'detach') then
    raise exception 'Tindakan wali tidak valid.';
  end if;

  -- Serializes add/switch/remove for a participant without a partial primary switch.
  select * into participant_record from public.participants
  where id = p_participant_id for update;
  if not found then
    raise exception 'Peserta tidak ditemukan.';
  end if;

  if p_action = 'attach' then
    if p_profile_id is null or p_profile_id = participant_record.user_id then
      raise exception 'Pilih akun wali yang berbeda dari akun peserta.';
    end if;
    if not exists (select 1 from public.profiles where id = p_profile_id and status = 'active') then
      raise exception 'Akun wali tidak ditemukan atau tidak aktif.';
    end if;
    -- guardians historically has no unique constraint on user_id.
    perform pg_advisory_xact_lock(hashtextextended('guardian:' || p_profile_id::text, 0));
    select id into guardian_id_value from public.guardians
    where user_id = p_profile_id order by created_at, id limit 1;
    if guardian_id_value is null then
      insert into public.guardians(user_id) values (p_profile_id)
      returning id into guardian_id_value;
    end if;
    -- Treat a repeat submission as the same link, including legacy duplicate guardians.
    select gp.id into relation_id_value from public.guardian_participants gp
    join public.guardians g on g.id = gp.guardian_id
    where gp.participant_id = p_participant_id and g.user_id = p_profile_id
    order by gp.created_at, gp.id limit 1;
    if relation_id_value is not null then
      return jsonb_build_object('relation_id', relation_id_value, 'status', 'unchanged');
    end if;
    insert into public.guardian_participants(guardian_id, participant_id, is_primary)
    values (guardian_id_value, p_participant_id,
      not exists (select 1 from public.guardian_participants where participant_id = p_participant_id and is_primary))
    returning id into relation_id_value;
  else
    select * into relation_record from public.guardian_participants
    where id = p_relation_id and participant_id = p_participant_id for update;
    if not found then
      raise exception 'Tautan wali tidak ditemukan. Muat ulang peserta.';
    end if;
    relation_id_value := relation_record.id;
    if p_action = 'primary' then
      update public.guardian_participants set is_primary = (id = p_relation_id)
      where participant_id = p_participant_id;
    else
      delete from public.guardian_participants where id = p_relation_id;
      if relation_record.is_primary then
        -- Keep a remaining guardian as primary, without deleting the account/guardian.
        select id into relation_id_value from public.guardian_participants
        where participant_id = p_participant_id order by created_at, id limit 1;
        update public.guardian_participants set is_primary = (id = relation_id_value)
        where participant_id = p_participant_id;
      end if;
    end if;
  end if;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'participant.guardian.' || p_action, 'participant', p_participant_id,
    jsonb_build_object('relation_id', coalesce(p_relation_id, relation_id_value)));
  return jsonb_build_object('relation_id', relation_id_value, 'status', 'saved');
end;
$$;

revoke all on function public.admin_manage_participant_guardian(uuid,text,uuid,uuid) from public, anon;
grant execute on function public.admin_manage_participant_guardian(uuid,text,uuid,uuid) to authenticated;

-- These tables already have RLS enabled; the original migration omitted read policies.
drop policy if exists guardian_participants_select_admin on public.guardian_participants;
create policy guardian_participants_select_admin on public.guardian_participants
for select to authenticated using (
  public.is_super_admin() or
  (public.has_role('admin') and public.can_access_participant(participant_id))
);
drop policy if exists guardians_select_admin on public.guardians;
create policy guardians_select_admin on public.guardians
for select to authenticated using (
  public.is_super_admin() or
  (public.has_role('admin') and exists (
    select 1 from public.guardian_participants gp
    where gp.guardian_id = guardians.id and public.can_access_participant(gp.participant_id)
  ))
);

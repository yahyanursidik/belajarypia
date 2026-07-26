create or replace function public.ensure_learner_identity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text := nullif(auth.jwt() ->> 'email', '');
  actor_name text := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    split_part(coalesce(actor_email, 'Peserta YPIA'), '@', 1)
  );
  participant_role_id uuid;
  learner_participant_id uuid;
begin
  if actor_id is null then
    raise exception 'Sesi login peserta tidak ditemukan.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));

  insert into public.profiles (id, full_name, email, status)
  values (actor_id, actor_name, actor_email, 'active')
  on conflict (id) do update
  set full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      status = 'active',
      updated_at = now();

  select id
  into participant_role_id
  from public.roles
  where code = 'participant'
  limit 1;

  if participant_role_id is null then
    raise exception 'Role participant belum tersedia.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = actor_id
      and r.code <> 'participant'
  ) and not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = actor_id
      and r.code = 'participant'
  ) then
    raise exception 'Akun staf tidak dapat didaftarkan melalui portal peserta.';
  end if;

  if not exists (
    select 1
    from public.user_roles
    where user_id = actor_id
      and role_id = participant_role_id
  ) then
    insert into public.user_roles (user_id, role_id, scope_type, scope_id)
    values (actor_id, participant_role_id, 'own', actor_id);
  end if;

  select id
  into learner_participant_id
  from public.participants
  where user_id = actor_id
  order by created_at
  limit 1;

  if learner_participant_id is null then
    insert into public.participants (
      user_id,
      global_participant_number,
      display_name,
      participant_type,
      status
    )
    values (
      actor_id,
      public.next_participant_number(),
      actor_name,
      'adult',
      'active'
    )
    returning id into learner_participant_id;
  end if;

  return jsonb_build_object(
    'participant_id', learner_participant_id,
    'role', 'participant'
  );
end;
$$;

revoke all on function public.ensure_learner_identity() from public;
grant execute on function public.ensure_learner_identity() to authenticated;

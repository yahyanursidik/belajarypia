create or replace function public.can_mentor_class(target_class_id uuid)
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
      where h.class_id = target_class_id
        and h.mentor_user_id = auth.uid()
        and h.status = 'active'
    );
$$;

revoke all on function public.can_mentor_class(uuid) from public;
grant execute on function public.can_mentor_class(uuid) to authenticated;

drop policy if exists "classes_select_assigned_mentor" on public.classes;
create policy "classes_select_assigned_mentor"
on public.classes for select to authenticated
using (public.can_mentor_class(id));

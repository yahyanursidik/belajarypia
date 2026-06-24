create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  parent_level_id uuid references public.levels(id) on delete set null,
  code text not null,
  name text not null,
  order_no int not null default 0,
  passing_rule_json jsonb,
  created_at timestamptz not null default now(),
  unique (program_id, code)
);

create table if not exists public.program_modules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  parent_module_id uuid references public.program_modules(id) on delete set null,
  level_id uuid references public.levels(id) on delete set null,
  code text not null,
  title text not null,
  module_type text not null default 'lesson_group',
  order_no int not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (program_id, code)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.program_modules(id) on delete cascade,
  code text not null,
  title text not null,
  lesson_type text not null default 'content',
  order_no int not null default 0,
  release_at timestamptz,
  due_at timestamptz,
  visibility_status text not null default 'draft' check (visibility_status in ('draft', 'published', 'locked', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, code)
);

create table if not exists public.lesson_prerequisites (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  prerequisite_lesson_id uuid not null references public.lessons(id) on delete cascade,
  rule_type text not null default 'completed',
  created_at timestamptz not null default now(),
  unique (lesson_id, prerequisite_lesson_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'enrollments_level_id_fk'
  ) then
    alter table public.enrollments
      add constraint enrollments_level_id_fk foreign key (level_id) references public.levels(id) on delete set null;
  end if;
end;
$$;

create index if not exists levels_program_id_idx on public.levels(program_id);
create index if not exists program_modules_program_id_idx on public.program_modules(program_id);
create index if not exists program_modules_level_id_idx on public.program_modules(level_id);
create index if not exists lessons_module_id_idx on public.lessons(module_id);
create index if not exists lessons_visibility_release_idx on public.lessons(visibility_status, release_at);
create index if not exists lesson_prerequisites_lesson_id_idx on public.lesson_prerequisites(lesson_id);

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create or replace function public.can_access_lesson(target_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.lessons l
      join public.program_modules pm on pm.id = l.module_id
      where l.id = target_lesson_id
        and public.can_access_program(pm.program_id)
    )
    or exists (
      select 1
      from public.lessons l
      join public.program_modules pm on pm.id = l.module_id
      join public.enrollments e on e.program_id = pm.program_id
      join public.participants p on p.id = e.participant_id
      where l.id = target_lesson_id
        and p.user_id = auth.uid()
        and e.enrollment_status = 'active'
        and l.visibility_status = 'published'
        and (l.release_at is null or l.release_at <= now())
    );
$$;

insert into public.permissions (code, name, module)
values
  ('academic.manage', 'Mengelola struktur akademik', 'academic'),
  ('lessons.view', 'Melihat lesson peserta', 'learning')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'academic.manage'
where r.code in ('super_admin', 'admin', 'teacher', 'mentor')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'lessons.view'
where r.code in ('participant', 'guardian')
on conflict do nothing;

alter table public.levels enable row level security;
alter table public.program_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_prerequisites enable row level security;

drop policy if exists "profiles_select_staff_for_admin" on public.profiles;
create policy "profiles_select_staff_for_admin"
on public.profiles
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.has_role('admin')
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = profiles.id
        and r.code in ('teacher', 'mentor')
    )
  )
);

drop policy if exists "batches_manage_program_admin" on public.batches;
create policy "batches_manage_program_admin"
on public.batches for all to authenticated
using (public.can_access_program(program_id) and (public.has_role('admin') or public.is_super_admin()))
with check (public.can_access_program(program_id) and (public.has_role('admin') or public.is_super_admin()));

drop policy if exists "classes_manage_program_admin" on public.classes;
create policy "classes_manage_program_admin"
on public.classes for all to authenticated
using (public.can_access_program(program_id) and (public.has_role('admin') or public.is_super_admin()))
with check (public.can_access_program(program_id) and (public.has_role('admin') or public.is_super_admin()));

drop policy if exists "halaqahs_manage_program_admin" on public.halaqahs;
create policy "halaqahs_manage_program_admin"
on public.halaqahs for all to authenticated
using (
  exists (
    select 1 from public.classes c
    where c.id = halaqahs.class_id
      and public.can_access_program(c.program_id)
      and (public.has_role('admin') or public.is_super_admin())
  )
)
with check (
  exists (
    select 1 from public.classes c
    where c.id = halaqahs.class_id
      and public.can_access_program(c.program_id)
      and (public.has_role('admin') or public.is_super_admin())
  )
);

drop policy if exists "levels_select_accessible" on public.levels;
create policy "levels_select_accessible"
on public.levels for select to authenticated
using (public.can_access_program(program_id));

drop policy if exists "levels_manage_program_admin" on public.levels;
create policy "levels_manage_program_admin"
on public.levels for all to authenticated
using (public.can_access_program(program_id) and (public.has_role('admin') or public.is_super_admin()))
with check (public.can_access_program(program_id) and (public.has_role('admin') or public.is_super_admin()));

drop policy if exists "program_modules_select_accessible" on public.program_modules;
create policy "program_modules_select_accessible"
on public.program_modules for select to authenticated
using (
  public.can_access_program(program_id)
  or exists (
    select 1
    from public.enrollments e
    join public.participants p on p.id = e.participant_id
    where e.program_id = program_modules.program_id
      and e.enrollment_status = 'active'
      and p.user_id = auth.uid()
  )
);

drop policy if exists "program_modules_manage_program_admin_or_teacher" on public.program_modules;
create policy "program_modules_manage_program_admin_or_teacher"
on public.program_modules for all to authenticated
using (
  public.can_access_program(program_id)
  and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin())
)
with check (
  public.can_access_program(program_id)
  and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin())
);

drop policy if exists "lessons_select_accessible" on public.lessons;
create policy "lessons_select_accessible"
on public.lessons for select to authenticated
using (public.can_access_lesson(id));

drop policy if exists "lessons_manage_program_admin_or_teacher" on public.lessons;
create policy "lessons_manage_program_admin_or_teacher"
on public.lessons for all to authenticated
using (
  exists (
    select 1
    from public.program_modules pm
    where pm.id = lessons.module_id
      and public.can_access_program(pm.program_id)
      and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin())
  )
)
with check (
  exists (
    select 1
    from public.program_modules pm
    where pm.id = lessons.module_id
      and public.can_access_program(pm.program_id)
      and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin())
  )
);

drop policy if exists "lesson_prerequisites_select_accessible" on public.lesson_prerequisites;
create policy "lesson_prerequisites_select_accessible"
on public.lesson_prerequisites for select to authenticated
using (public.can_access_lesson(lesson_id));

drop policy if exists "lesson_prerequisites_manage_program_admin_or_teacher" on public.lesson_prerequisites;
create policy "lesson_prerequisites_manage_program_admin_or_teacher"
on public.lesson_prerequisites for all to authenticated
using (public.can_access_lesson(lesson_id) and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin()))
with check (public.can_access_lesson(lesson_id) and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin()));

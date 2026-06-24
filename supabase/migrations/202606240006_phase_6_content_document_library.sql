alter table public.lessons
  add column if not exists content_format text not null default 'plain_text'
    check (content_format in ('plain_text', 'markdown', 'html')),
  add column if not exists content_body text,
  add column if not exists external_url text;

create table if not exists public.document_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  source_type text not null default 'object_storage'
    check (source_type in ('object_storage', 'external_link')),
  storage_provider text not null default 'contabo_s3',
  bucket_name text,
  object_key text,
  external_url text,
  display_name text not null,
  description text,
  mime_type text,
  file_size_bytes bigint,
  file_category text not null default 'document'
    check (file_category in ('document', 'pdf', 'audio', 'video', 'link', 'other')),
  access_level text not null default 'enrolled'
    check (access_level in ('staff_only', 'enrolled')),
  checksum_sha256 text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_files_source_check check (
    (source_type = 'object_storage' and bucket_name is not null and object_key is not null)
    or (source_type = 'external_link' and external_url is not null)
  )
);

create index if not exists document_files_lesson_id_idx on public.document_files(lesson_id);
create index if not exists document_files_object_key_idx on public.document_files(object_key);
create index if not exists document_files_status_idx on public.document_files(status);

drop trigger if exists document_files_set_updated_at on public.document_files;
create trigger document_files_set_updated_at
before update on public.document_files
for each row execute function public.set_updated_at();

create or replace function public.can_teach_program(target_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    where c.program_id = target_program_id
      and c.teacher_user_id = auth.uid()
      and c.status = 'active'
  )
  or exists (
    select 1
    from public.halaqahs h
    join public.classes c on c.id = h.class_id
    where c.program_id = target_program_id
      and h.mentor_user_id = auth.uid()
      and h.status = 'active'
  );
$$;

create or replace function public.can_manage_lesson_content(target_lesson_id uuid)
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
        and (
          (
            public.can_access_program(pm.program_id)
            and public.has_role('admin')
          )
          or (
            public.can_teach_program(pm.program_id)
            and (public.has_role('teacher') or public.has_role('mentor'))
          )
        )
    );
$$;

create or replace function public.can_access_lesson(target_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_lesson_content(target_lesson_id)
    or public.is_super_admin()
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

create or replace function public.can_access_document_file(target_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.document_files df
    where df.id = target_file_id
      and df.status = 'active'
      and (
        public.can_manage_lesson_content(df.lesson_id)
        or (
          df.access_level = 'enrolled'
          and df.source_type in ('object_storage', 'external_link')
          and public.can_access_lesson(df.lesson_id)
        )
      )
  );
$$;

insert into public.permissions (code, name, module)
values
  ('content.manage', 'Mengelola konten lesson dan dokumen', 'content'),
  ('documents.view', 'Melihat dokumen lesson', 'content')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'content.manage'
where r.code in ('super_admin', 'admin', 'teacher', 'mentor')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'documents.view'
where r.code in ('participant', 'guardian', 'teacher', 'mentor', 'admin', 'super_admin')
on conflict do nothing;

alter table public.document_files enable row level security;

drop policy if exists "programs_select_assigned_teacher_content" on public.programs;
create policy "programs_select_assigned_teacher_content"
on public.programs for select to authenticated
using (
  public.can_teach_program(id)
  and (public.has_role('teacher') or public.has_role('mentor'))
);

drop policy if exists "program_modules_select_assigned_teacher_content" on public.program_modules;
create policy "program_modules_select_assigned_teacher_content"
on public.program_modules for select to authenticated
using (
  public.can_teach_program(program_id)
  and (public.has_role('teacher') or public.has_role('mentor'))
);

drop policy if exists "lessons_update_content_manage_staff" on public.lessons;
create policy "lessons_update_content_manage_staff"
on public.lessons for update to authenticated
using (public.can_manage_lesson_content(id))
with check (public.can_manage_lesson_content(id));

drop policy if exists "document_files_select_accessible" on public.document_files;
create policy "document_files_select_accessible"
on public.document_files for select to authenticated
using (
  public.can_manage_lesson_content(lesson_id)
  or (
    status = 'active'
    and access_level = 'enrolled'
    and public.can_access_lesson(lesson_id)
  )
);

drop policy if exists "document_files_insert_manage_lesson" on public.document_files;
create policy "document_files_insert_manage_lesson"
on public.document_files for insert to authenticated
with check (
  public.can_manage_lesson_content(lesson_id)
  and uploaded_by = auth.uid()
);

drop policy if exists "document_files_update_manage_lesson" on public.document_files;
create policy "document_files_update_manage_lesson"
on public.document_files for update to authenticated
using (public.can_manage_lesson_content(lesson_id))
with check (public.can_manage_lesson_content(lesson_id));

drop policy if exists "document_files_delete_manage_lesson" on public.document_files;
create policy "document_files_delete_manage_lesson"
on public.document_files for delete to authenticated
using (public.can_manage_lesson_content(lesson_id));

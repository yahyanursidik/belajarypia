create table if not exists public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  template_type text not null default 'html' check (template_type in ('html', 'json')),
  template_data_json jsonb,
  background_object_key text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificate_issuance_batches (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete cascade,
  template_id uuid not null references public.certificate_templates(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  total_jobs int not null default 0,
  completed_jobs int not null default 0,
  failed_jobs int not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.certificate_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  issuance_batch_id uuid not null references public.certificate_issuance_batches(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  template_id uuid not null references public.certificate_templates(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempt_count int not null default 0,
  max_attempts int not null default 3,
  scheduled_at timestamptz default now(),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  certificate_template_id uuid references public.certificate_templates(id) on delete set null,
  certificate_number text not null unique,
  recipient_name text not null,
  program_name text not null,
  issued_at timestamptz not null default now(),
  status text not null default 'issued' check (status in ('draft', 'queued', 'issued', 'revoked', 'failed')),
  object_key text,
  verification_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificate_download_logs (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  downloaded_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index if not exists certificate_templates_program_id_idx on public.certificate_templates(program_id);
create index if not exists certificate_issuance_batches_program_id_idx on public.certificate_issuance_batches(program_id);
create index if not exists certificate_generation_jobs_batch_id_idx on public.certificate_generation_jobs(issuance_batch_id);
create index if not exists certificate_generation_jobs_status_idx on public.certificate_generation_jobs(status);
create index if not exists certificates_enrollment_id_idx on public.certificates(enrollment_id);

drop trigger if exists certificate_templates_set_updated_at on public.certificate_templates;
create trigger certificate_templates_set_updated_at before update on public.certificate_templates for each row execute function public.set_updated_at();

drop trigger if exists certificate_generation_jobs_set_updated_at on public.certificate_generation_jobs;
create trigger certificate_generation_jobs_set_updated_at before update on public.certificate_generation_jobs for each row execute function public.set_updated_at();

drop trigger if exists certificates_set_updated_at on public.certificates;
create trigger certificates_set_updated_at before update on public.certificates for each row execute function public.set_updated_at();

alter table public.certificate_templates enable row level security;
alter table public.certificate_issuance_batches enable row level security;
alter table public.certificate_generation_jobs enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_download_logs enable row level security;

create policy "certificate_templates_manage_admin" on public.certificate_templates for all to authenticated using (public.has_role('admin') or public.is_super_admin());
create policy "certificate_templates_select_authenticated" on public.certificate_templates for select to authenticated using (true);

create policy "certificate_issuance_batches_manage_admin" on public.certificate_issuance_batches for all to authenticated using (public.has_role('admin') or public.is_super_admin());
create policy "certificate_issuance_batches_select_authenticated" on public.certificate_issuance_batches for select to authenticated using (public.has_role('admin') or public.is_super_admin());

create policy "certificate_generation_jobs_manage_admin" on public.certificate_generation_jobs for all to authenticated using (public.has_role('admin') or public.is_super_admin());
create policy "certificate_generation_jobs_select_authenticated" on public.certificate_generation_jobs for select to authenticated using (public.has_role('admin') or public.is_super_admin() or exists (
  select 1 from public.participants p where p.id = certificate_generation_jobs.participant_id and p.user_id = auth.uid()
));

create policy "certificates_select_accessible" on public.certificates for select to authenticated using (
  public.is_super_admin() or public.has_role('admin') or 
  exists (
    select 1 from public.enrollments e
    join public.participants p on p.id = e.participant_id
    where e.id = certificates.enrollment_id
      and p.user_id = auth.uid()
  )
);
create policy "certificates_manage_admin" on public.certificates for all to authenticated using (public.has_role('admin') or public.is_super_admin());

create policy "certificate_download_logs_manage_admin" on public.certificate_download_logs for all to authenticated using (public.has_role('admin') or public.is_super_admin());
create policy "certificate_download_logs_insert_authenticated" on public.certificate_download_logs for insert to authenticated with check (user_id = auth.uid());

-- Migration: Announcements System
-- Adds a global announcements board

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  target_role text not null default 'all', -- 'all', 'participant', 'teacher', 'admin'
  target_program_id uuid references public.programs(id) on delete cascade,
  status text not null default 'draft', -- 'draft', 'published'
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists announcements_target_role_idx on public.announcements(target_role);
create index if not exists announcements_target_program_id_idx on public.announcements(target_program_id);
create index if not exists announcements_status_idx on public.announcements(status);
create index if not exists announcements_created_at_idx on public.announcements(created_at desc);

-- Trigger for updated_at
drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

-- RLS Policies
alter table public.announcements enable row level security;

-- Admins can do anything
create policy "Admins can manage all announcements"
on public.announcements
for all
to authenticated
using (public.has_role('admin') or public.has_role('super_admin'))
with check (public.has_role('admin') or public.has_role('super_admin'));

-- Anyone can read published announcements
create policy "Anyone can view published announcements"
on public.announcements
for select
to authenticated
using (status = 'published');

-- Add realtime publication for announcements
alter publication supabase_realtime add table public.announcements;

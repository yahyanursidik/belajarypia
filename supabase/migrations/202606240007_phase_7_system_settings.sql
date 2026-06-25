create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  institution_name text not null default 'YPIA',
  institution_profile text,
  logo_url text,
  login_logo_url text,
  favicon_url text,
  contact_email text,
  contact_phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure there is only ever one row in the table using a unique index on a constant value or simply rely on UI logic.
create unique index if not exists system_settings_single_row_idx on public.system_settings((1));

-- Seed initial data
insert into public.system_settings (institution_name) 
values ('YPIA Lembaga Pendidikan')
on conflict do nothing;

drop trigger if exists system_settings_set_updated_at on public.system_settings;
create trigger system_settings_set_updated_at
before update on public.system_settings
for each row execute function public.set_updated_at();

-- Add RLS policies (only super_admin can manage, everyone can read)
alter table public.system_settings enable row level security;

create policy "Anyone can read system settings"
  on public.system_settings for select
  using (true);

create policy "Super admin can update system settings"
  on public.system_settings for update
  using (public.is_super_admin());

create policy "Super admin can insert system settings"
  on public.system_settings for insert
  with check (public.is_super_admin());

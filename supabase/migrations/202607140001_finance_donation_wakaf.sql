alter table public.transactions
  alter column participant_id drop not null,
  alter column program_id drop not null;

alter table public.transactions
  drop constraint if exists transactions_transaction_type_check;

alter table public.transactions
  add constraint transactions_transaction_type_check
  check (transaction_type in ('spp', 'registration', 'education_infaq', 'donation', 'wakaf', 'other'));

alter table public.transactions
  drop constraint if exists transactions_status_check;

alter table public.transactions
  add constraint transactions_status_check
  check (status in ('pending', 'verified', 'rejected', 'void'));

create table if not exists public.donation_payment_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel_type text not null default 'bank'
    check (channel_type in ('bank', 'qris', 'external', 'cash')),
  bank_name text,
  account_number text,
  account_holder text,
  qris_image_url text,
  external_url text,
  instructions text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donor_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  city text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donor_commitments (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.donor_profiles(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  channel_id uuid references public.donation_payment_channels(id) on delete set null,
  commitment_type text not null default 'donation'
    check (commitment_type in ('donation', 'wakaf', 'education_infaq')),
  amount numeric(12, 2) not null default 0,
  frequency text not null default 'monthly'
    check (frequency in ('once', 'monthly', 'quarterly', 'yearly')),
  next_reminder_at date,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed')),
  contact_preference text not null default 'whatsapp'
    check (contact_preference in ('whatsapp', 'email', 'phone')),
  reminder_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists donor_id uuid references public.donor_profiles(id) on delete set null,
  add column if not exists donor_commitment_id uuid references public.donor_commitments(id) on delete set null,
  add column if not exists payment_channel_id uuid references public.donation_payment_channels(id) on delete set null;

create index if not exists donation_payment_channels_active_idx
  on public.donation_payment_channels(is_active, sort_order);

create index if not exists donor_profiles_name_idx
  on public.donor_profiles(full_name);

create index if not exists donor_commitments_status_reminder_idx
  on public.donor_commitments(status, next_reminder_at);

create index if not exists transactions_donor_id_idx
  on public.transactions(donor_id);

create index if not exists transactions_payment_channel_id_idx
  on public.transactions(payment_channel_id);

drop trigger if exists donation_payment_channels_set_updated_at on public.donation_payment_channels;
create trigger donation_payment_channels_set_updated_at
before update on public.donation_payment_channels
for each row execute function public.set_updated_at();

drop trigger if exists donor_profiles_set_updated_at on public.donor_profiles;
create trigger donor_profiles_set_updated_at
before update on public.donor_profiles
for each row execute function public.set_updated_at();

drop trigger if exists donor_commitments_set_updated_at on public.donor_commitments;
create trigger donor_commitments_set_updated_at
before update on public.donor_commitments
for each row execute function public.set_updated_at();

alter table public.donation_payment_channels enable row level security;
alter table public.donor_profiles enable row level security;
alter table public.donor_commitments enable row level security;

drop policy if exists "donation_channels_select_authenticated" on public.donation_payment_channels;
create policy "donation_channels_select_authenticated"
on public.donation_payment_channels for select
to authenticated
using (true);

drop policy if exists "donation_channels_manage_finance" on public.donation_payment_channels;
create policy "donation_channels_manage_finance"
on public.donation_payment_channels for all
to authenticated
using (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'))
with check (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'));

drop policy if exists "donor_profiles_manage_finance" on public.donor_profiles;
create policy "donor_profiles_manage_finance"
on public.donor_profiles for all
to authenticated
using (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'))
with check (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'));

drop policy if exists "donor_commitments_manage_finance" on public.donor_commitments;
create policy "donor_commitments_manage_finance"
on public.donor_commitments for all
to authenticated
using (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'))
with check (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'));

insert into public.donation_payment_channels
  (name, channel_type, bank_name, account_number, account_holder, instructions, is_active, sort_order)
values
  ('Rekening Infaq Pendidikan', 'bank', 'BSI', '0000000000', 'Yayasan Pendidikan Ihsanul Adab', 'Konfirmasi transfer melalui admin keuangan dengan menyertakan nama peserta/program.', true, 10),
  ('QRIS Donasi YPIA', 'qris', null, null, 'Yayasan Pendidikan Ihsanul Adab', 'Scan QRIS resmi yayasan, lalu unggah bukti pembayaran bila diperlukan.', true, 20),
  ('Tautan Donasi Eksternal', 'external', null, null, null, 'Gunakan tautan pembayaran resmi yang sudah diverifikasi bendahara.', true, 30)
on conflict do nothing;

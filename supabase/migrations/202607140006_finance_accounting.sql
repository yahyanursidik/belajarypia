create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null
    check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance text not null
    check (normal_balance in ('debit', 'credit')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_number text not null unique,
  transaction_id uuid references public.transactions(id) on delete set null,
  entry_date date not null default current_date,
  description text not null,
  status text not null default 'posted'
    check (status in ('draft', 'posted', 'void')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_journal_entries_transaction_id_idx
  on public.finance_journal_entries(transaction_id)
  where transaction_id is not null;

create table if not exists public.finance_journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.finance_journal_entries(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  debit numeric(12, 2) not null default 0,
  credit numeric(12, 2) not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  constraint finance_journal_lines_amount_check check (debit >= 0 and credit >= 0 and not (debit > 0 and credit > 0))
);

create index if not exists finance_journal_lines_entry_idx
  on public.finance_journal_lines(journal_entry_id);

create index if not exists finance_journal_lines_account_idx
  on public.finance_journal_lines(account_id);

drop trigger if exists finance_accounts_set_updated_at on public.finance_accounts;
create trigger finance_accounts_set_updated_at
before update on public.finance_accounts
for each row execute function public.set_updated_at();

drop trigger if exists finance_journal_entries_set_updated_at on public.finance_journal_entries;
create trigger finance_journal_entries_set_updated_at
before update on public.finance_journal_entries
for each row execute function public.set_updated_at();

alter table public.finance_accounts enable row level security;
alter table public.finance_journal_entries enable row level security;
alter table public.finance_journal_lines enable row level security;

drop policy if exists "finance_accounts_manage_finance" on public.finance_accounts;
create policy "finance_accounts_manage_finance"
on public.finance_accounts for all
to authenticated
using (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'))
with check (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'));

drop policy if exists "finance_journal_entries_manage_finance" on public.finance_journal_entries;
create policy "finance_journal_entries_manage_finance"
on public.finance_journal_entries for all
to authenticated
using (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'))
with check (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'));

drop policy if exists "finance_journal_lines_manage_finance" on public.finance_journal_lines;
create policy "finance_journal_lines_manage_finance"
on public.finance_journal_lines for all
to authenticated
using (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'))
with check (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'));

insert into public.finance_accounts (code, name, account_type, normal_balance, sort_order)
values
  ('1010', 'Kas dan Bank Operasional', 'asset', 'debit', 10),
  ('1100', 'Piutang Pendidikan', 'asset', 'debit', 20),
  ('3100', 'Saldo Dana Yayasan', 'equity', 'credit', 30),
  ('4100', 'Pendapatan Infaq Pendidikan', 'revenue', 'credit', 40),
  ('4200', 'Pendapatan Donasi', 'revenue', 'credit', 50),
  ('4300', 'Penerimaan Wakaf', 'revenue', 'credit', 60),
  ('4400', 'Pendapatan Pendaftaran', 'revenue', 'credit', 70),
  ('4900', 'Pendapatan Lainnya', 'revenue', 'credit', 80),
  ('5100', 'Beban Operasional Pendidikan', 'expense', 'debit', 90)
on conflict (code) do nothing;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  amount numeric(12, 2) not null,
  transaction_type text not null check (transaction_type in ('spp', 'registration', 'other')),
  status text not null default 'verified' check (status in ('pending', 'verified', 'rejected')),
  billing_month date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_participant_id_idx on public.transactions(participant_id);
create index if not exists transactions_program_id_idx on public.transactions(program_id);

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

-- Participants can see their own transactions, Super Admins can see all
drop policy if exists "transactions_select_all" on public.transactions;
create policy "transactions_select_all"
on public.transactions for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.participants p
    where p.id = transactions.participant_id and p.user_id = auth.uid()
  )
);

-- Only Admins, Super Admins, and Finance can manage transactions
drop policy if exists "transactions_manage_admin" on public.transactions;
create policy "transactions_manage_admin"
on public.transactions for all
to authenticated
using (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'))
with check (public.is_super_admin() or public.has_role('admin') or public.has_role('finance'));

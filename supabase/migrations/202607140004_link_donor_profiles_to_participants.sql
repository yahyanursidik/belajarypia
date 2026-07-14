alter table public.donor_profiles
  add column if not exists participant_id uuid references public.participants(id) on delete set null;

create index if not exists donor_profiles_participant_id_idx
  on public.donor_profiles(participant_id);

-- Migration: Admin Reset User Password
-- Allows admins to reset any user's password directly through an RPC call

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_reset_user_password(target_user_id uuid, new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  is_admin boolean;
begin
  select (public.has_role('admin') or public.has_role('super_admin')) into is_admin;
  
  if not is_admin then
    raise exception 'Unauthorized: Only administrators can reset passwords.';
  end if;

  if length(new_password) < 6 then
    raise exception 'Password must be at least 6 characters long.';
  end if;

  update auth.users
  set 
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf', 10)),
    updated_at = now()
  where id = target_user_id;

  if found then
    return true;
  else
    raise exception 'User not found.';
  end if;
end;
$$;

-- Perbaikan darurat untuk field internal Supabase GoTrue
do $$
begin
  -- 1. Pastikan is_sso_user tidak null
  update auth.users set is_sso_user = false where is_sso_user is null;
  
  -- 2. Pastikan is_super_admin tidak null
  update auth.users set is_super_admin = false where is_super_admin is null;

  -- 3. Pastikan is_anonymous tidak null (hanya jika kolomnya ada di versi Supabase ini)
  begin
    execute 'update auth.users set is_anonymous = false where is_anonymous is null';
  exception when undefined_column then
    -- Abaikan jika kolom is_anonymous belum ada
  end;
end;
$$;

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXVudGd0bWhuaHFsc3BndG9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4ODg3NiwiZXhwIjoyMDk3ODY0ODc2fQ._KuzvW-oPj5Yg4ys2DqTbw4zvKdP7zk8kf7aMYoEkdc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const sql = `
    drop policy if exists "participants_update_own" on public.participants;
    create policy "participants_update_own"
      on public.participants for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  `;
  
  // Since we don't have a direct execute_sql, let's use an existing rpc or we just add it to a migration file.
}
run();

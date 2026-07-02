const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXVudGd0bWhuaHFsc3BndG9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4ODg3NiwiZXhwIjoyMDk3ODY0ODc2fQ._KuzvW-oPj5Yg4ys2DqTbw4zvKdP7zk8kf7aMYoEkdc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data: participants } = await supabase.from('participants').select('user_id').limit(1);
  if (!participants || participants.length === 0) return;
  const uid = participants[0].user_id;
  
  console.log('Attempting to delete user:', uid);
  const { error } = await supabase.auth.admin.deleteUser(uid);
  console.log('Delete result:', error);
}

run();

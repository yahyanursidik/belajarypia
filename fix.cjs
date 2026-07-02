const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXVudGd0bWhuaHFsc3BndG9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4ODg3NiwiZXhwIjoyMDk3ODY0ODc2fQ._KuzvW-oPj5Yg4ys2DqTbw4zvKdP7zk8kf7aMYoEkdc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('Fetching participants...');
  const { data: participants, error: pError } = await supabase.from('participants').select('*');
  if (pError) {
    console.error('Error fetching participants:', pError);
    return;
  }
  
  console.log(`Found ${participants.length} participants.`);
  
  if (participants.length === 0) return;
  
  for (const p of participants) {
    const { data: userData, error: uError } = await supabase.auth.admin.getUserById(p.user_id);
    if (uError) {
      console.error(`User ${p.user_id} error:`, uError.message);
      continue;
    }
    const user = userData.user;
    console.log(`User ${user.email}:`);
    console.log('  Identities:', user.identities?.length);
    console.log('  Confirmed:', user.email_confirmed_at != null);
    
    console.log('  Updating password via GoTrue Admin API...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(p.user_id, {
      password: 'ahlan1447H',
      email_confirm: true
    });
    
    if (updateError) {
      console.error('  Failed to update:', updateError.message);
    } else {
      console.log('  Success! Password updated properly by GoTrue.');
    }
  }
}

run();

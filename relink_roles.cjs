const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXVudGd0bWhuaHFsc3BndG9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4ODg3NiwiZXhwIjoyMDk3ODY0ODc2fQ._KuzvW-oPj5Yg4ys2DqTbw4zvKdP7zk8kf7aMYoEkdc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('Fetching participant role id...');
  const { data: roleData, error: roleError } = await supabase.from('roles').select('id').eq('code', 'participant').single();
  if (roleError) {
    console.error('Error fetching role:', roleError);
    return;
  }
  const roleId = roleData.id;
  
  console.log('Fetching all participant user IDs...');
  const { data: participants, error: pError } = await supabase.from('participants').select('user_id').not('user_id', 'is', null);
  if (pError) {
    console.error('Error fetching participants:', pError);
    return;
  }
  
  console.log(`Found ${participants.length} participants.`);
  
  const userRolesToInsert = participants.map(p => ({
    user_id: p.user_id,
    role_id: roleId
  }));
  
  console.log('Inserting roles...');
  const { error: insertError } = await supabase.from('user_roles').upsert(userRolesToInsert, { onConflict: 'user_id, role_id' });
  
  if (insertError) {
    console.error('Error inserting roles:', insertError);
  } else {
    console.log('Roles successfully linked!');
  }
}

run();

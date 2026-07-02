const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXVudGd0bWhuaHFsc3BndG9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4ODg3NiwiZXhwIjoyMDk3ODY0ODc2fQ._KuzvW-oPj5Yg4ys2DqTbw4zvKdP7zk8kf7aMYoEkdc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('Fetching participants needing new auth accounts...');
  const { data: participants, error: pError } = await supabase
    .from('participants')
    .select('id, temp_email, display_name, phone')
    .not('temp_email', 'is', null);
    
  if (pError) {
    console.error('Error fetching participants:', pError);
    return;
  }
  
  console.log(`Found ${participants.length} participants to recreate.`);
  
  let successCount = 0;
  let failCount = 0;

  for (const p of participants) {
    if (!p.temp_email) continue;
    
    // Check if user somehow still exists
    const { data: existing } = await supabase.auth.admin.listUsers();
    const isExist = existing?.users?.find(u => u.email === p.temp_email);
    if (isExist) {
        console.log(`User ${p.temp_email} already exists, skipping creation.`);
        successCount++;
        continue;
    }

    console.log(`Creating auth user for ${p.temp_email}...`);
    const { error: cError } = await supabase.auth.admin.createUser({
      email: p.temp_email,
      password: 'ahlan1447H',
      email_confirm: true,
      user_metadata: {
        full_name: p.display_name,
        phone: p.phone || null
      }
    });
    
    if (cError) {
      console.error(`  Failed to create ${p.temp_email}:`, cError.message);
      failCount++;
    } else {
      successCount++;
    }
  }
  
  console.log(`Creation finished. Success: ${successCount}, Failed: ${failCount}.`);
  console.log('Relinking participants to their new auth accounts...');
  
  const { error: rError } = await supabase.rpc('relink_participants');
  
  if (rError) {
    console.error('Error relinking participants:', rError);
  } else {
    console.log('Relink complete! All users successfully migrated and linked.');
    // Drop the column after successful relinking
    console.log('Users are now ready to login with ahlan1447H.');
  }
}

run();

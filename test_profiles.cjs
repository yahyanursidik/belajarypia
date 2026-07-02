const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXVudGd0bWhuaHFsc3BndG9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4ODg3NiwiZXhwIjoyMDk3ODY0ODc2fQ._KuzvW-oPj5Yg4ys2DqTbw4zvKdP7zk8kf7aMYoEkdc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data: profiles, error } = await supabase.from('user_profiles').select('user_id, participant_id, email');
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log(`Found ${profiles.length} profiles.`);
    console.log('Sample:', profiles[0]);
  }
}

run();

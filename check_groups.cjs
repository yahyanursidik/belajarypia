const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXVudGd0bWhuaHFsc3BndG9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4ODg3NiwiZXhwIjoyMDk3ODY0ODc2fQ._KuzvW-oPj5Yg4ys2DqTbw4zvKdP7zk8kf7aMYoEkdc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data: groups, error } = await supabase.from('registration_groups').select('id, name').ilike('name', '%akhwat%');
  if (error) {
    console.error(error);
    return;
  }
  console.log('Groups with "akhwat":', groups);
  
  const { data: g2 } = await supabase.from('registration_groups').select('id, name').ilike('name', '%perempuan%');
  console.log('Groups with "perempuan":', g2);
}

run();

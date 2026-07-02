const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXVudGd0bWhuaHFsc3BndG9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4ODg3NiwiZXhwIjoyMDk3ODY0ODc2fQ._KuzvW-oPj5Yg4ys2DqTbw4zvKdP7zk8kf7aMYoEkdc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('Updating genders to Perempuan...');
  
  // Try matching any lowercase or variation
  const { data: p1, error: e1 } = await supabase
    .from('participants')
    .update({ gender: 'Perempuan' })
    .ilike('gender', 'akhwat%')
    .select('id');
    
  const { data: p2, error: e2 } = await supabase
    .from('participants')
    .update({ gender: 'Perempuan' })
    .eq('gender', 'perempuan')
    .select('id');

  const { data: p3, error: e3 } = await supabase
    .from('participants')
    .update({ gender: 'Perempuan' })
    .eq('gender', 'Perempuan ')
    .select('id');
    
  console.log(`Updated ${p1?.length || 0} akhwat rows.`);
  console.log(`Updated ${p2?.length || 0} perempuan rows.`);
  console.log(`Updated ${p3?.length || 0} Perempuan with space rows.`);
}

run();

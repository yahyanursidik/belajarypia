const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXVudGd0bWhuaHFsc3BndG9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4ODg3NiwiZXhwIjoyMDk3ODY0ODc2fQ._KuzvW-oPj5Yg4ys2DqTbw4zvKdP7zk8kf7aMYoEkdc';

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function run() {
  const { data } = await supabase.from('participants').select('id, display_name, gender').eq('gender', 'Laki-laki');
  
  const femaleKeywords = ['siti', 'nur ', 'aisyah', 'putri', 'fatimah', 'nisa', 'zahra', 'dewi', 'sri', 'indah', 'lestari', 'ayu', 'rini', 'ria', 'fitri', 'hasanah', 'salma', 'rahma', 'syifa', 'annisa', 'kurniawati', 'astuti', 'wati'];
  
  const suspectedFemales = data.filter(p => {
    const name = p.display_name.toLowerCase();
    return femaleKeywords.some(kw => name.includes(kw));
  });
  
  console.log(`Found ${suspectedFemales.length} suspected females currently listed as Laki-laki:`);
  console.log(suspectedFemales.map(p => p.display_name).slice(0, 10));
}

run();

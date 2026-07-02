const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXVudGd0bWhuaHFsc3BndG9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4ODg3NiwiZXhwIjoyMDk3ODY0ODc2fQ._KuzvW-oPj5Yg4ys2DqTbw4zvKdP7zk8kf7aMYoEkdc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  // Let's get a list of all tables
  const { data: tables, error: tableError } = await supabase.from('participants').select('id').limit(1); // just a dummy to ensure connection
  
  // Since we don't have direct schema access easily, I'll just check common tables
  const queries = [
    { table: 'registration_forms', field: 'name' },
    { table: 'programs', field: 'name' },
    { table: 'enrollments', field: 'status' } // maybe?
  ];
  
  for (const q of queries) {
    const { data } = await supabase.from(q.table).select('*').limit(5);
    console.log(`Sample from ${q.table}:`, data);
  }
}

run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
  console.log("Investigating lesson: 976c8029-562f-4566-b721-ee8d01b07d67");
  
  const lessonId = '976c8029-562f-4566-b721-ee8d01b07d67';

  const { data: qData } = await supabase.from('quiz_questions').select('id').eq('lesson_id', lessonId);
  console.log('Total questions in DB for lesson:', qData?.length);

  const { data: attempts } = await supabase.from('quiz_attempts').select('*').eq('lesson_id', lessonId);
  console.log('Total attempts:', attempts?.length);
  
  if (attempts && attempts.length > 0) {
    for (const a of attempts) {
      const { data: ans } = await supabase.from('quiz_attempt_answers').select('*').eq('quiz_attempt_id', a.id);
      console.log(`Attempt ${a.id} has ${ans?.length} answers`);
      
      const distinctQuestions = new Set(ans?.map(x => x.question_id));
      console.log(`Attempt ${a.id} distinct questions: ${distinctQuestions.size}`);
    }
  }
}

investigate().catch(console.error);

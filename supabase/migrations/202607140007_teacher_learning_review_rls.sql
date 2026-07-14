create or replace function public.can_review_program_learning(target_lesson_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lessons l
    join public.program_modules pm on pm.id = l.module_id
    join public.programs p on p.id = pm.program_id
    left join public.classes c on c.program_id = p.id
    left join public.halaqahs h on h.class_id = c.id
    where l.id = target_lesson_id
      and (
        p.teacher_user_id = auth.uid()
        or c.teacher_user_id = auth.uid()
        or h.mentor_user_id = auth.uid()
        or public.has_role('admin')
        or public.is_super_admin()
      )
  );
$$;

drop policy if exists "progress_select_teacher_review" on public.lesson_progresses;
create policy "progress_select_teacher_review"
on public.lesson_progresses for select
to authenticated
using (public.can_review_program_learning(lesson_id));

drop policy if exists "quiz_attempts_select_teacher_review" on public.quiz_attempts;
create policy "quiz_attempts_select_teacher_review"
on public.quiz_attempts for select
to authenticated
using (public.can_review_program_learning(lesson_id));

drop policy if exists "quiz_answers_select_teacher_review" on public.quiz_attempt_answers;
create policy "quiz_answers_select_teacher_review"
on public.quiz_attempt_answers for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts qa
    where qa.id = quiz_attempt_answers.quiz_attempt_id
      and public.can_review_program_learning(qa.lesson_id)
  )
);

-- Learner-owned snapshots and atomic profile wizard. No business data changes at deployment.
create or replace function public.learner_profile_workspace() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare account_value jsonb; person_value jsonb; person_id uuid;
begin
 account_value=public.my_profile_workspace();
 if (select count(*) from participants where user_id=auth.uid())>1 then raise exception 'Data peserta terhubung lebih dari satu. Hubungi bantuan untuk pemeriksaan.';end if;
 select id,jsonb_build_object('id',id,'user_id',user_id,'display_name',display_name,'global_participant_number',global_participant_number,'phone',phone,'gender',gender,'birth_date',birth_date,'city',city,'education_level',education_level,'participant_type',participant_type,'status',status,'updated_at',updated_at) into person_id,person_value from participants where user_id=auth.uid();
 return jsonb_build_object('account',account_value,'participant',person_value,'revision',md5(jsonb_build_array(account_value->>'revision',person_value)::text),
 'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id desc) from(select id,created_at,details->'fields' as fields from audit_logs where user_id=auth.uid() and entity_type='participant' and entity_id=person_id and action='learner_profile.updated' order by created_at desc,id desc limit 5) h),'[]'));
end;$$;

create or replace function public.learner_profile_update(p_revision text,p_changes jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare before_value jsonb; person participants%rowtype; profile_patch jsonb:='{}'; next_display text; next_city text; next_gender text; next_education text; next_birth date; next_phone text; changed text[]:='{}'; item record;
begin
 if auth.uid() is null then raise exception 'Silakan masuk kembali.' using errcode='42501';end if;
 if p_changes is null or jsonb_typeof(p_changes)<>'object' then raise exception 'Perubahan profil tidak valid.';end if;
 for item in select key,value from jsonb_each(p_changes) loop
  if item.key not in ('full_name','phone','display_name','city','gender','education_level','birth_date') then raise exception 'Kolom profil tidak diizinkan.';end if;
  if jsonb_typeof(item.value) not in ('string','null') or (item.key in ('full_name','display_name') and jsonb_typeof(item.value)<>'string') then raise exception 'Format profil tidak valid.';end if;
 end loop;
 perform 1 from profiles where id=auth.uid() for update;
 if not found then raise exception 'Profil akun belum tersedia.';end if;
 select * into person from participants where user_id=auth.uid() order by id limit 1 for update;
 before_value=public.learner_profile_workspace();
 if p_revision is distinct from before_value->>'revision' then raise exception 'Profil sudah berubah. Muat versi terbaru sebelum menyimpan.' using errcode='40001';end if;
 if person.id is not null and person.status<>'active' then raise exception 'Profil peserta tidak aktif. Hubungi bantuan.' using errcode='42501';end if;
 if person.id is null and exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('full_name','phone')) then raise exception 'Akun belum terhubung sebagai peserta.';end if;
 if p_changes?'full_name' then profile_patch=profile_patch||jsonb_build_object('full_name',p_changes->'full_name');end if;
 if p_changes?'phone' then profile_patch=profile_patch||jsonb_build_object('phone',p_changes->'phone');end if;
 -- Reuse the account validator; rollback covers both tables and both audit entries.
 perform public.my_profile_update(before_value->'account'->>'revision',profile_patch);
 if person.id is not null then
  next_display=person.display_name;next_city=person.city;next_gender=person.gender;next_education=person.education_level;next_birth=person.birth_date;next_phone=person.phone;
  if p_changes?'display_name' then next_display=btrim(p_changes->>'display_name');if length(next_display) not between 2 and 160 or next_display~'[[:cntrl:]]' then raise exception 'Nama tampilan harus 2–160 karakter.';end if;end if;
  if p_changes?'city' then next_city=nullif(btrim(p_changes->>'city'),'');if length(next_city)>120 or next_city~'[[:cntrl:]]' then raise exception 'Kota maksimal 120 karakter.';end if;end if;
  if p_changes?'education_level' then next_education=nullif(btrim(p_changes->>'education_level'),'');if length(next_education)>80 or next_education~'[[:cntrl:]]' then raise exception 'Pendidikan maksimal 80 karakter.';end if;end if;
  if p_changes?'gender' then next_gender=nullif(btrim(p_changes->>'gender'),'');if next_gender is not null and next_gender not in ('male','female','Laki-laki','Perempuan') then raise exception 'Pilihan jenis kelamin tidak valid.';end if;end if;
  if p_changes?'birth_date' then
   if nullif(p_changes->>'birth_date','') is null then next_birth=null;
   else if (p_changes->>'birth_date')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Tanggal lahir tidak valid.';end if;next_birth=(p_changes->>'birth_date')::date;
   if next_birth>(now() at time zone 'Asia/Jakarta')::date or next_birth<date '1900-01-01' then raise exception 'Tanggal lahir harus antara 1900 dan hari ini.';end if;end if;
  end if;
  if p_changes?'phone' then select phone into next_phone from profiles where id=auth.uid();end if;
  if next_display is distinct from person.display_name then changed=array_append(changed,'display_name');end if;
  if next_city is distinct from person.city then changed=array_append(changed,'city');end if;
  if next_gender is distinct from person.gender then changed=array_append(changed,'gender');end if;
  if next_education is distinct from person.education_level then changed=array_append(changed,'education_level');end if;
  if next_birth is distinct from person.birth_date then changed=array_append(changed,'birth_date');end if;
  if next_phone is distinct from person.phone then changed=array_append(changed,'phone');end if;
  if cardinality(changed)>0 then
   update participants set display_name=next_display,city=next_city,gender=next_gender,education_level=next_education,birth_date=next_birth,phone=next_phone,updated_at=clock_timestamp() where id=person.id;
   insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'learner_profile.updated','participant',person.id,jsonb_build_object('fields',changed));
  end if;
 end if;
 return public.learner_profile_workspace();
end;$$;

create or replace function public.learner_program_outline(p_program uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare person participants%rowtype; enr enrollments%rowtype; pr programs%rowtype; result jsonb;
begin
 if auth.uid() is null then raise exception 'Silakan masuk kembali.' using errcode='42501';end if;
 if (select count(*) from participants where user_id=auth.uid())<>1 then raise exception 'Akun belum terhubung dengan satu profil peserta.';end if;
 select * into person from participants where user_id=auth.uid();
 select * into enr from enrollments where participant_id=person.id and program_id=p_program and enrollment_status='active';
 select * into pr from programs where id=p_program and status='active';
 if person.status<>'active' or enr.id is null or pr.id is null or not exists(select 1 from profiles p join auth.users a on a.id=p.id where p.id=auth.uid() and p.status='active' and not coalesce(a.banned_until>now(),false)) then raise exception 'Akses belajar belum aktif untuk program ini.' using errcode='42501';end if;
 with visible as materialized(select l.id,l.module_id,l.code,l.title,l.lesson_type,l.order_no,l.release_at,l.due_at,l.visibility_status,l.duration_minutes,l.passing_grade from lessons l join program_modules m on m.id=l.module_id where m.program_id=p_program and l.visibility_status='published' and (l.release_at is null or l.release_at<=now()))
 select jsonb_build_object('generated_at',statement_timestamp(),
 'program',jsonb_build_object('id',pr.id,'unit_id',pr.unit_id,'name',pr.name,'code',pr.code,'description',pr.description,'syllabus',pr.syllabus,'program_type',pr.program_type,'curriculum_model',pr.curriculum_model,'delivery_mode',pr.delivery_mode,'status',pr.status,'feature_flags',pr.feature_flags,'grading_rubric',pr.grading_rubric,'graduation_settings',pr.graduation_settings),
 'enrollment',jsonb_build_object('id',enr.id,'participant_id',person.id,'program_id',pr.id,'batch_id',enr.batch_id,'class_id',enr.class_id,'halaqah_id',enr.halaqah_id,'enrollment_number',enr.enrollment_number,'enrollment_status',enr.enrollment_status,'payment_status',enr.payment_status),
 'modules',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'program_id',m.program_id,'parent_module_id',m.parent_module_id,'level_id',m.level_id,'code',m.code,'title',m.title,'module_type',m.module_type,'order_no',m.order_no,'is_required',m.is_required,'levels',case when lv.id is not null then jsonb_build_object('name',lv.name,'code',lv.code) else null end) order by m.order_no,m.id) from program_modules m left join levels lv on lv.id=m.level_id and lv.program_id=p_program where m.program_id=p_program),'[]'),
 'lessons',coalesce((select jsonb_agg(to_jsonb(v) order by v.order_no,v.id) from visible v),'[]'),
 'requirements',coalesce((select jsonb_agg(jsonb_build_object('lesson_id',lp.lesson_id,'prerequisite_lesson_id',lp.prerequisite_lesson_id)) from lesson_prerequisites lp where lp.lesson_id in(select id from visible)),'[]'),
 'progress',coalesce((select jsonb_agg(jsonb_build_object('lesson_id',lp.lesson_id,'status',lp.status,'score',lp.score,'completed_at',lp.completed_at,'started_at',lp.started_at)) from lesson_progresses lp where lp.enrollment_id=enr.id),'[]'),
 'attempts',coalesce((select jsonb_agg(to_jsonb(a)) from(select distinct on(lesson_id) id,lesson_id,attempt_number,status,case when status='graded' then score else null end as score,started_at,submitted_at from quiz_attempts where enrollment_id=enr.id and lesson_id in(select id from visible) order by lesson_id,attempt_number desc,started_at desc,id desc)a),'[]')) into result;
 return result;
end;$$;

create or replace function public.learner_portal_workspace() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare person participants%rowtype; readable boolean;
begin
 if auth.uid() is null then raise exception 'Silakan masuk kembali.' using errcode='42501';end if;
 if (select count(*) from participants where user_id=auth.uid())>1 then raise exception 'Data peserta terhubung lebih dari satu. Hubungi bantuan.';end if;
 select * into person from participants where user_id=auth.uid();
 readable=person.status='active' and exists(select 1 from profiles p join auth.users a on a.id=p.id where p.id=auth.uid() and p.status='active' and not coalesce(a.banned_until>now(),false));
 return jsonb_build_object('generated_at',statement_timestamp(),'participant',case when person.id is null then null else jsonb_build_object('id',person.id,'user_id',person.user_id,'display_name',person.display_name,'global_participant_number',person.global_participant_number,'status',person.status) end,
 'profile_ready',exists(select 1 from profiles where id=auth.uid() and nullif(btrim(full_name),'') is not null) and nullif(btrim(person.display_name),'') is not null,
 'enrollments',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'participant_id',e.participant_id,'program_id',e.program_id,'batch_id',e.batch_id,'class_id',e.class_id,'halaqah_id',e.halaqah_id,'enrollment_number',e.enrollment_number,'enrollment_status',e.enrollment_status,'payment_status',e.payment_status,'programs',jsonb_build_object('id',p.id,'name',p.name,'code',p.code,'feature_flags',p.feature_flags),'batches',case when b.id is null then null else jsonb_build_object('name',b.name,'code',b.code) end,'classes',case when c.id is null then null else jsonb_build_object('name',c.name,'code',c.code) end,'halaqahs',case when h.id is null then null else jsonb_build_object('name',h.name,'code',h.code) end,'program_status',p.status,'onboarding_status',(select status from onboarding_progresses where enrollment_id=e.id order by id limit 1),'outline',case when readable and e.enrollment_status='active' and p.status='active' then public.learner_program_outline(p.id) else null end) order by e.created_at desc,e.id) from enrollments e join programs p on p.id=e.program_id left join batches b on b.id=e.batch_id and b.program_id=e.program_id left join classes c on c.id=e.class_id and c.program_id=e.program_id left join halaqahs h on h.id=e.halaqah_id and h.class_id=e.class_id where e.participant_id=person.id),'[]'));
end;$$;
revoke all on function public.learner_profile_workspace(),public.learner_profile_update(text,jsonb),public.learner_program_outline(uuid),public.learner_portal_workspace() from public,anon;
grant execute on function public.learner_profile_workspace(),public.learner_profile_update(text,jsonb),public.learner_program_outline(uuid),public.learner_portal_workspace() to authenticated;

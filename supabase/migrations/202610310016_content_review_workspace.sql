-- Review workspace for existing superadmin access. No content is published by deployment.
create or replace function public.system_content_snapshot(p_lesson uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare l public.lessons%rowtype; context jsonb; docs jsonb; questions jsonb; board jsonb; posts jsonb; columns_json jsonb; prereqs jsonb; issues text[]='{}'; warnings text[]='{}'; q_count integer; source_count integer; revision_value text;
begin
 if auth.uid() is null or not coalesce(public.is_super_admin(),false) or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then raise exception 'Review konten hanya tersedia untuk superadmin aktif.';end if;
 select * into l from public.lessons where id=p_lesson;if not found then raise exception 'Materi tidak ditemukan.';end if;
 select jsonb_build_object('program_id',p.id,'program_name',p.name,'program_status',p.status,'module_id',m.id,'module_title',m.title) into context from public.program_modules m join public.programs p on p.id=m.program_id where m.id=l.module_id;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') into docs from public.document_files d where d.lesson_id=l.id and d.status='active';
 select coalesce(jsonb_agg(to_jsonb(q) order by q.order_no,q.id),'[]') into questions from public.quiz_questions q where q.lesson_id=l.id;
 select to_jsonb(b) into board from public.lesson_boards b where b.lesson_id=l.id;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.order_no,p.id),'[]') into posts from public.lesson_board_posts p where p.board_id=(board->>'id')::uuid;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.order_no,c.id),'[]') into columns_json from public.lesson_board_columns c where c.board_id=(board->>'id')::uuid;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.prerequisite_lesson_id,'title',pl.title,'visibility_status',pl.visibility_status,'program_id',pm.program_id) order by r.id),'[]') into prereqs from public.lesson_prerequisites r left join public.lessons pl on pl.id=r.prerequisite_lesson_id left join public.program_modules pm on pm.id=pl.module_id where r.lesson_id=l.id;
 revision_value=md5(jsonb_build_object('lesson',to_jsonb(l),'context',context,'documents',docs,'questions',questions,'board',board,'posts',posts,'columns',columns_json,'prerequisites',prereqs)::text);
 if nullif(btrim(l.title),'') is null or nullif(btrim(l.code),'') is null then issues=array_append(issues,'Lengkapi judul dan kode materi.');end if;
 if context is null then issues=array_append(issues,'Program atau modul tidak ditemukan.');elsif context->>'program_status'='archived' then issues=array_append(issues,'Program sudah diarsipkan.');elsif context->>'program_status'<>'active' then warnings=array_append(warnings,'Program belum aktif.');end if;
 if l.release_at is not null and l.due_at is not null and l.due_at<l.release_at then issues=array_append(issues,'Tenggat lebih awal daripada waktu rilis.');end if;
 if nullif(btrim(l.external_url),'') is not null and l.external_url !~* '^https?://[^[:space:]/?#@]+([/:?#][^[:space:]]*)?$' then issues=array_append(issues,'Tautan utama harus berupa HTTP/HTTPS tanpa kredensial.');end if;
 if exists(select 1 from jsonb_array_elements(docs) d where d->>'source_type'='external_link' and coalesce(d->>'external_url','') !~* '^https?://[^[:space:]/?#@]+([/:?#][^[:space:]]*)?$') then issues=array_append(issues,'Perbaiki tautan sumber yang tidak valid.');end if;
 if exists(select 1 from jsonb_array_elements(docs) d where d->>'source_type'='object_storage' and (coalesce(d->>'mime_type','') ~* '^(audio|video)/' or d->>'file_category' in ('audio','video') or coalesce(d->>'object_key','') ~* '\.(mp3|m4a|wav|ogg|mp4|mov|avi|mkv|webm)$')) then issues=array_append(issues,'Unggahan audio/video tidak didukung. Gunakan tautan eksternal.');end if;
 select count(*) into source_count from jsonb_array_elements(docs) d where d->>'access_level'='enrolled' and (d->>'source_type'='external_link' or (nullif(d->>'bucket_name','') is not null and nullif(d->>'object_key','') is not null));
 q_count=jsonb_array_length(questions);
 if l.lesson_type in ('quiz','exam') then
  if q_count=0 then issues=array_append(issues,'Tambahkan soal ujian terlebih dahulu.');end if;
  if exists(select 1 from jsonb_array_elements(questions) q where nullif(btrim(q->>'question_text'),'') is null or coalesce((q->>'points')::numeric,0)<=0 or q->>'question_type' not in ('multiple_choice','essay') or (q->>'question_type'='multiple_choice' and (case when jsonb_typeof(q->'options')='array' then jsonb_array_length(q->'options') else 0 end<2 or not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(q->'options')='array' then q->'options' else '[]'::jsonb end) o where o->>'label'=q->>'correct_answer') or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(q->'options')='array' then q->'options' else '[]'::jsonb end) o where nullif(btrim(o->>'label'),'') is null or nullif(btrim(o->>'text'),'') is null) or (select count(*)<>count(distinct o->>'label') or count(*)<>count(distinct o->>'text') from jsonb_array_elements(case when jsonb_typeof(q->'options')='array' then q->'options' else '[]'::jsonb end) o)))) then issues=array_append(issues,'Perbaiki isi, bobot, pilihan, atau kunci jawaban soal.');end if;
  if l.passing_grade not between 0 and 100 or l.duration_minutes<=0 or l.max_attempts<=0 or l.randomized_questions_count<0 or l.randomized_questions_count>q_count then issues=array_append(issues,'Perbaiki pengaturan nilai, durasi, percobaan, atau jumlah soal acak.');end if;
 elsif l.lesson_type='board' then
  if board is null or jsonb_array_length(posts)=0 or (board->>'layout'='columns' and jsonb_array_length(columns_json)=0) then issues=array_append(issues,'Lengkapi papan belajar dan kartu materinya.');end if;
 elsif l.lesson_type='live_session' then
  if nullif(btrim(l.external_url),'') is null then issues=array_append(issues,'Tambahkan tautan sesi live.');end if;
 elsif l.lesson_type in ('content','assignment') then
  if nullif(btrim(l.content_body),'') is null and nullif(btrim(l.external_url),'') is null and source_count=0 then issues=array_append(issues,'Tambahkan isi, tautan, atau sumber yang dapat dibuka peserta.');end if;
 else issues=array_append(issues,'Jenis materi belum didukung untuk diterbitkan.');end if;
 if exists(select 1 from jsonb_array_elements(prereqs) r where r->>'id'=l.id::text or r->>'program_id' is distinct from context->>'program_id') then issues=array_append(issues,'Prasyarat harus materi lain di program yang sama.');end if;
 if exists(with recursive chain(id,path,cycle) as(select r.prerequisite_lesson_id,array[l.id,r.prerequisite_lesson_id],r.prerequisite_lesson_id=l.id from public.lesson_prerequisites r where r.lesson_id=l.id union all select r.prerequisite_lesson_id,c.path||r.prerequisite_lesson_id,r.prerequisite_lesson_id=any(c.path) from chain c join public.lesson_prerequisites r on r.lesson_id=c.id where not c.cycle) select 1 from chain where cycle) then issues=array_append(issues,'Prasyarat materi membentuk siklus.');end if;
 if exists(select 1 from jsonb_array_elements(prereqs) r where r->>'visibility_status'<>'published') then warnings=array_append(warnings,'Ada prasyarat yang belum terbit.');end if;
 if l.release_at>now() then warnings=array_append(warnings,'Materi baru tersedia setelah jadwal rilis.');end if;
 return jsonb_build_object('revision',revision_value,'lesson',to_jsonb(l),'context',context,'documents',(select coalesce(jsonb_agg(d-'bucket_name'-'object_key'-'checksum_sha256'-'uploaded_by'),'[]') from jsonb_array_elements(docs) d),'questions',questions,'board',board,'posts',(select coalesce(jsonb_agg((p-'image_object_key')||jsonb_build_object('has_image',nullif(p->>'image_object_key','') is not null)),'[]') from jsonb_array_elements(posts) p),'columns',columns_json,'prerequisites',prereqs,'checks',jsonb_build_object('issues',to_jsonb(issues),'warnings',to_jsonb(warnings),'ready',cardinality(issues)=0,'questions',q_count,'sources',source_count,'cards',jsonb_array_length(posts)));
end;$$;
revoke all on function public.system_content_snapshot(uuid) from public,anon,authenticated;

create or replace function public.system_content_review_list(p_filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare target_program uuid=nullif(p_filters->>'program','')::uuid;status_value text=coalesce(p_filters->>'status','draft');kind text=coalesce(p_filters->>'kind','all');search_value text=left(btrim(coalesce(p_filters->>'q','')),120);page_value integer=coalesce((p_filters->>'page')::integer,1);size_value integer=coalesce((p_filters->>'size')::integer,20);attention boolean=coalesce((p_filters->>'attention')::boolean,false);result_value jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_super_admin(),false) or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then raise exception 'Review konten hanya tersedia untuk superadmin aktif.';end if;
 if status_value not in ('all','draft','published','scheduled','locked','archived') or kind not in ('all','content','quiz','exam','assignment','live_session','board') or page_value<1 or page_value>100000 or size_value not in (10,20,50) then raise exception 'Filter konten tidak valid.';end if;
 if target_program is not null and not exists(select 1 from public.programs where id=target_program) then raise exception 'Program tidak ditemukan.';end if;
 with scoped as materialized(select l.id,l.code,l.title,l.lesson_type,l.visibility_status,l.release_at,l.updated_at,p.id as program_id,p.name as program_name,m.title as module_title,public.system_content_snapshot(l.id)->'checks' as checks from public.lessons l join public.program_modules m on m.id=l.module_id join public.programs p on p.id=m.program_id where (target_program is null or p.id=target_program) and (kind='all' or l.lesson_type=kind) and (search_value='' or position(lower(search_value) in lower(l.title||' '||l.code||' '||p.name||' '||m.title))>0)),
 filtered as materialized(select * from scoped s where (status_value='all' or status_value='scheduled' and visibility_status='published' and release_at>now() or status_value='published' and visibility_status='published' and (release_at is null or release_at<=now()) or status_value not in ('all','scheduled','published') and visibility_status=status_value) and (not attention or not (checks->>'ready')::boolean)),
 rows_page as(select * from filtered order by updated_at desc,id limit size_value offset (page_value-1)*size_value)
 select jsonb_build_object('generated_at',now(),'total',(select count(*) from filtered),'page',page_value,'size',size_value,'programs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status) order by name,id) from public.programs),'[]'),'counts',jsonb_build_object('all',(select count(*) from scoped),'draft',(select count(*) from scoped where visibility_status='draft'),'published',(select count(*) from scoped where visibility_status='published' and (release_at is null or release_at<=now())),'scheduled',(select count(*) from scoped where visibility_status='published' and release_at>now()),'locked',(select count(*) from scoped where visibility_status='locked'),'archived',(select count(*) from scoped where visibility_status='archived'),'attention',(select count(*) from scoped where not (checks->>'ready')::boolean)),'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc,r.id) from rows_page r),'[]')) into result_value;return result_value;
end;$$;

create or replace function public.system_content_review_detail(p_lesson uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result_value jsonb;
begin
 result_value=public.system_content_snapshot(p_lesson);
 return result_value||jsonb_build_object('history',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id) from (select a.id,a.action,a.created_at,a.details,coalesce(p.full_name,'Superadmin') as actor_name from public.audit_logs a left join public.profiles p on p.id=a.user_id where a.entity_type='lesson' and a.entity_id=p_lesson and a.action='content.reviewed' order by a.created_at desc,a.id limit 10) a),'[]'));
end;$$;

create or replace function public.system_content_review_decide(p_lesson uuid,p_revision text,p_status text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare snapshot jsonb;previous_status text;note_value text=nullif(btrim(p_notes),'');
begin
 if auth.uid() is null or not coalesce(public.is_super_admin(),false) or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then raise exception 'Review konten hanya tersedia untuk superadmin aktif.';end if;
 perform set_config('lock_timeout','5s',true);
 lock table public.document_files,public.quiz_questions,public.lesson_boards,public.lesson_board_columns,public.lesson_board_posts,public.lesson_prerequisites in share mode;
 perform 1 from public.lessons where id=p_lesson for update;
 snapshot=public.system_content_snapshot(p_lesson);previous_status=snapshot->'lesson'->>'visibility_status';
 if p_revision is distinct from snapshot->>'revision' then raise exception 'Materi atau sumber sudah berubah. Muat ulang sebelum menyimpan keputusan.';end if;
 if p_status is null or p_status not in ('draft','published','locked','archived') or previous_status='archived' and p_status not in ('archived','draft') then raise exception 'Buka kembali arsip sebagai draf terlebih dahulu.';end if;
 if length(coalesce(note_value,''))>1500 or (p_status<>'published' and length(coalesce(note_value,''))<3) then raise exception 'Isi catatan 3–1.500 karakter untuk keputusan ini.';end if;
 if p_status=previous_status then return public.system_content_review_detail(p_lesson);end if;
 if p_status='published' and not (snapshot->'checks'->>'ready')::boolean then raise exception 'Lengkapi pemeriksaan materi sebelum menerbitkan.';end if;
 update public.lessons set visibility_status=p_status,updated_at=clock_timestamp() where id=p_lesson;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'content.reviewed','lesson',p_lesson,jsonb_build_object('program_id',snapshot->'context'->>'program_id','previous_status',previous_status,'status',p_status,'notes',note_value,'reviewed_revision',p_revision));
 return public.system_content_review_detail(p_lesson);
end;$$;
revoke all on function public.system_content_review_list(jsonb),public.system_content_review_detail(uuid),public.system_content_review_decide(uuid,text,text,text) from public,anon;
grant execute on function public.system_content_review_list(jsonb),public.system_content_review_detail(uuid),public.system_content_review_decide(uuid,text,text,text) to authenticated;

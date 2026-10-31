-- Manual bank/QR payments: invoices, evidence, scoped review and atomic bookkeeping.
create table if not exists public.finance_operations(request_key uuid primary key,user_id uuid not null references public.profiles(id),operation text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now());
alter table public.finance_operations enable row level security;
create table if not exists public.finance_documents(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),purpose text not null check(purpose in ('proof','qr')),object_key text not null unique,file_name text not null,mime_type text not null,file_size bigint not null check(file_size between 1 and 5242880),status text not null default 'staged' check(status in ('staged','ready')),created_at timestamptz not null default now());
alter table public.finance_documents enable row level security;
create table if not exists public.finance_invoices(id uuid primary key default gen_random_uuid(),invoice_number text not null unique,enrollment_id uuid not null references public.enrollments(id),participant_id uuid not null references public.participants(id),program_id uuid not null references public.programs(id),title text not null,amount numeric(12,2) not null check(amount>0),invoice_type text not null check(invoice_type in ('spp','registration','education_infaq')),billing_month date,due_date date,status text not null default 'open' check(status in ('open','paid','cancelled')),created_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.finance_invoices enable row level security;
create unique index if not exists finance_invoice_month_unique on public.finance_invoices(enrollment_id,billing_month) where invoice_type='spp' and status<>'cancelled';
alter table public.enrollments add column if not exists finance_original_payment_status text;
alter table public.donation_payment_channels add column if not exists purpose text not null default 'both' check(purpose in ('both','class','donation'));
alter table public.donation_payment_channels add column if not exists program_id uuid references public.programs(id);
alter table public.donation_payment_channels add column if not exists qr_document_id uuid references public.finance_documents(id);
alter table public.donation_payment_channels add column if not exists asset_account_id uuid references public.finance_accounts(id);
alter table public.transactions add column if not exists invoice_id uuid references public.finance_invoices(id);
alter table public.transactions add column if not exists enrollment_id uuid references public.enrollments(id);
alter table public.transactions add column if not exists payer_name text;
alter table public.transactions add column if not exists reference_number text;
alter table public.transactions add column if not exists paid_at date;
alter table public.transactions add column if not exists proof_document_id uuid references public.finance_documents(id);
alter table public.transactions add column if not exists channel_snapshot jsonb;
alter table public.transactions add column if not exists review_notes text;
alter table public.transactions add column if not exists verified_by uuid references public.profiles(id);
alter table public.transactions add column if not exists verified_at timestamptz;
alter table public.transactions alter column status set default 'pending';
alter table public.finance_journal_entries add column if not exists reverses_entry_id uuid references public.finance_journal_entries(id);
create unique index if not exists finance_journal_reversal_unique on public.finance_journal_entries(reverses_entry_id) where reverses_entry_id is not null;
create unique index if not exists finance_transaction_proof_unique on public.transactions(proof_document_id) where proof_document_id is not null;
create index if not exists finance_transaction_invoice_idx on public.transactions(invoice_id,status);
create index if not exists finance_invoice_program_idx on public.finance_invoices(program_id,status);

create or replace function public.finance_staff() returns boolean language sql stable security definer set search_path=public as $$select auth.uid() is not null and (public.is_super_admin() or public.has_role('finance') or public.has_role('admin'));$$;
create or replace function public.finance_can_manage(p_program_id uuid) returns boolean language sql stable security definer set search_path=public as $$select auth.uid() is not null and (public.is_super_admin() or public.has_role('finance') or (public.has_role('admin') and p_program_id is not null and public.can_access_program(p_program_id)));$$;
revoke all on function public.finance_staff() from public,anon;
revoke all on function public.finance_can_manage(uuid) from public,anon;
grant execute on function public.finance_staff(),public.finance_can_manage(uuid) to authenticated;
create or replace function public.finance_channel_ready(p_channel_id uuid) returns boolean language sql stable security definer set search_path=public as $$select coalesce(c.is_active and case c.channel_type when 'bank' then nullif(btrim(c.bank_name),'') is not null and nullif(btrim(c.account_holder),'') is not null and regexp_replace(coalesce(c.account_number,''),'[\s-]','','g') ~ '^[0-9]{6,30}$' and regexp_replace(c.account_number,'[\s-]','','g') !~ '^0+$' when 'qris' then nullif(btrim(c.account_holder),'') is not null and (exists(select 1 from public.finance_documents d where d.id=c.qr_document_id and d.purpose='qr' and d.status='ready') or c.qris_image_url ~ '^https://') when 'external' then c.external_url ~ '^https://' when 'cash' then true else false end,false) from public.donation_payment_channels c where c.id=p_channel_id;$$;
revoke all on function public.finance_channel_ready(uuid) from public,anon;
grant execute on function public.finance_channel_ready(uuid) to authenticated;
create or replace function public.finance_operation(p_key uuid,p_operation text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$declare row public.finance_operations%rowtype;begin if auth.uid() is null or p_key is null then raise exception 'Sesi atau identitas permintaan tidak tersedia.';end if;perform pg_advisory_xact_lock(hashtextextended(p_key::text,71));select * into row from public.finance_operations where request_key=p_key;if found then if row.user_id<>auth.uid() or row.operation<>p_operation or row.payload<>p_payload then raise exception 'Permintaan berbeda. Periksa kembali isian.';end if;return row.result;end if;return null;end;$$;
create or replace function public.finance_operation_done(p_key uuid,p_operation text,p_payload jsonb,p_result jsonb) returns void language sql security definer set search_path=public as $$insert into public.finance_operations(request_key,user_id,operation,payload,result) values(p_key,auth.uid(),p_operation,p_payload,p_result);$$;
revoke all on function public.finance_operation(uuid,text,jsonb),public.finance_operation_done(uuid,text,jsonb,jsonb) from public,anon,authenticated;

create or replace function public.finance_document_access(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.finance_documents d where d.id=p_id and (d.owner_id=auth.uid() or (d.status='ready' and (exists(select 1 from public.donation_payment_channels c where c.qr_document_id=d.id and (public.finance_can_manage(c.program_id) or public.finance_channel_ready(c.id))) or exists(select 1 from public.transactions t left join public.participants p on p.id=t.participant_id where (t.proof_document_id=d.id or t.channel_snapshot->>'qr_document_id'=d.id::text) and (public.finance_can_manage(t.program_id) or t.created_by=auth.uid() or p.user_id=auth.uid()))))));$$;
revoke all on function public.finance_document_access(uuid) from public,anon;
grant execute on function public.finance_document_access(uuid) to authenticated;
create policy finance_document_read on public.finance_documents for select to authenticated using(public.finance_document_access(id));
create or replace function public.finance_prepare_document(p_purpose text,p_name text,p_mime text,p_size bigint) returns jsonb language plpgsql security definer set search_path=public as $$declare row public.finance_documents%rowtype;ext text;begin if auth.uid() is null or p_purpose is null or p_purpose not in ('proof','qr') or (p_purpose='qr' and not public.finance_staff()) then raise exception 'Akses unggahan ditolak.';end if;ext=lower(regexp_replace(p_name,'^.*\.',''));if p_name is null or p_mime is null or p_size is null or p_size not between 1 and 5242880 or length(p_name)>200 or p_mime not in ('application/pdf','image/jpeg','image/png','image/webp') or (p_purpose='qr' and p_mime='application/pdf') or not ((ext='pdf' and p_mime='application/pdf') or (ext in ('jpg','jpeg') and p_mime='image/jpeg') or (ext='png' and p_mime='image/png') or (ext='webp' and p_mime='image/webp')) then raise exception 'Gunakan dokumen/gambar yang diizinkan, maksimal 5 MB.';end if;insert into public.finance_documents(owner_id,purpose,object_key,file_name,mime_type,file_size) values(auth.uid(),p_purpose,'finance/'||p_purpose||'/'||auth.uid()::text||'/'||gen_random_uuid()::text||'.'||ext,p_name,p_mime,p_size) returning * into row;return to_jsonb(row);end;$$;
revoke all on function public.finance_prepare_document(text,text,text,bigint) from public,anon;
grant execute on function public.finance_prepare_document(text,text,text,bigint) to authenticated;
create or replace function public.finance_mark_document_ready(p_id uuid,p_owner uuid,p_object_key text) returns jsonb language plpgsql security definer set search_path=public as $$declare row public.finance_documents%rowtype;begin
 select * into row from public.finance_documents where id=p_id and owner_id=p_owner for update;if not found then raise exception 'Dokumen bukan milik pengunggah.';end if;
 if row.status='ready' then return to_jsonb(row);end if;
 if p_object_key is null or p_object_key !~ ('^finance/ready/'||p_id::text||'/[0-9a-f-]{36}\.(pdf|png|jpg|jpeg|webp)$') then raise exception 'Lokasi dokumen belum valid.';end if;
 update public.finance_documents set status='ready',object_key=p_object_key where id=p_id returning * into row;return to_jsonb(row);end;$$;
revoke all on function public.finance_mark_document_ready(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.finance_mark_document_ready(uuid,uuid,text) to service_role;
create or replace function public.finance_note_document_download(p_id uuid) returns void language plpgsql security definer set search_path=public as $$begin if auth.uid() is null or not public.finance_document_access(p_id) then raise exception 'Dokumen tidak dapat diakses.';end if;if exists(select 1 from public.finance_documents where id=p_id and purpose='proof') then insert into public.audit_logs(user_id,action,entity_type,entity_id) values(auth.uid(),'finance_document.download','finance_document',p_id);end if;end;$$;
revoke all on function public.finance_note_document_download(uuid) from public,anon;
grant execute on function public.finance_note_document_download(uuid) to authenticated;

create or replace function public.finance_save_channel(p_payload jsonb,p_request_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare p_program uuid=nullif(p_payload->>'program_id','')::uuid;cid uuid=nullif(p_payload->>'id','')::uuid;old public.donation_payment_channels%rowtype;result jsonb;doc uuid=nullif(p_payload->>'qr_document_id','')::uuid;active boolean=coalesce((p_payload->>'is_active')::boolean,false);kind text=p_payload->>'channel_type';asset uuid=nullif(p_payload->>'asset_account_id','')::uuid;
begin
 if not public.finance_can_manage(p_program) then raise exception 'Anda tidak memiliki akses mengatur rekening untuk cakupan ini.';end if;
 result=public.finance_operation(p_request_key,'channel',p_payload);if result is not null then return result;end if;
 if nullif(btrim(p_payload->>'name'),'') is null or length(p_payload->>'name')>160 or kind is null or kind not in ('bank','qris','external','cash') or coalesce(p_payload->>'purpose','both') not in ('both','class','donation') then raise exception 'Nama atau jenis kanal belum valid.';end if;
 if cid is not null then select * into old from public.donation_payment_channels where id=cid for update;if not found or not public.finance_can_manage(old.program_id) then raise exception 'Rekening tidak dapat diakses.';end if;if (p_payload->>'expected_updated_at')::timestamptz is distinct from old.updated_at then raise exception 'Rekening telah berubah. Muat ulang sebelum menyimpan.';end if;end if;
 if doc is not null and not exists(select 1 from public.finance_documents where id=doc and purpose='qr' and status='ready' and (owner_id=auth.uid() or doc=old.qr_document_id)) then raise exception 'QR belum berhasil diunggah atau bukan milik Anda.';end if;
 if asset is null then select id into asset from public.finance_accounts where code='1010' and is_active;end if;
 if not exists(select 1 from public.finance_accounts where id=asset and account_type='asset' and is_active) then raise exception 'Pilih akun kas/bank yang aktif.';end if;
 if cid is null then cid=gen_random_uuid();insert into public.donation_payment_channels(id,name,channel_type,created_by,is_active) values(cid,btrim(p_payload->>'name'),kind,auth.uid(),false);end if;
 update public.donation_payment_channels set name=btrim(p_payload->>'name'),channel_type=kind,program_id=p_program,purpose=coalesce(p_payload->>'purpose','both'),bank_name=nullif(btrim(p_payload->>'bank_name'),''),account_number=nullif(btrim(p_payload->>'account_number'),''),account_holder=nullif(btrim(p_payload->>'account_holder'),''),qr_document_id=doc,qris_image_url=case when doc is null and p_payload->>'qris_image_url' ~ '^https://' then p_payload->>'qris_image_url' else null end,external_url=case when p_payload->>'external_url' ~ '^https://' then p_payload->>'external_url' else null end,instructions=nullif(btrim(p_payload->>'instructions'),''),asset_account_id=asset,is_active=active,updated_at=now() where id=cid;
 if active and not coalesce(public.finance_channel_ready(cid),false) then raise exception 'Lengkapi rekening yang benar atau unggah QR sebelum mengaktifkan kanal.';end if;
 result=jsonb_build_object('id',cid);perform public.finance_operation_done(p_request_key,'channel',p_payload,result);insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'finance_channel.saved','donation_payment_channel',cid,jsonb_build_object('program_id',p_program,'active',active));return result;
end;$$;
revoke all on function public.finance_save_channel(jsonb,uuid) from public,anon;
grant execute on function public.finance_save_channel(jsonb,uuid) to authenticated;

create or replace function public.finance_refresh_enrollment(p_enrollment_id uuid,p_activate boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare e public.enrollments%rowtype;total int;remaining int;
begin
 if p_enrollment_id is null then return;end if;select * into e from public.enrollments where id=p_enrollment_id for update;
 select count(*),count(*) filter(where status<>'paid') into total,remaining from public.finance_invoices where enrollment_id=p_enrollment_id and status<>'cancelled';
 update public.enrollments set payment_status=case when total=0 then coalesce(finance_original_payment_status,payment_status) when remaining=0 then 'paid' else 'pending' end,finance_original_payment_status=case when total=0 then null else finance_original_payment_status end,updated_at=now() where id=e.id;
 if p_activate and total>0 and remaining=0 and e.enrollment_status in ('pending','hold') then
  update public.enrollments set enrollment_status='active',updated_at=now() where id=e.id;
  insert into public.enrollment_status_logs(enrollment_id,old_status,new_status,reason,changed_by) values(e.id,e.enrollment_status,'active','Aktivasi dipilih admin setelah seluruh tagihan lunas',auth.uid());
 end if;
end;$$;
revoke all on function public.finance_refresh_enrollment(uuid,boolean) from public,anon,authenticated;
create or replace function public.finance_create_invoices(p_payload jsonb,p_request_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare program uuid=(p_payload->>'program_id')::uuid;ids uuid[];eid uuid;e public.enrollments%rowtype;amount_value numeric=(p_payload->>'amount')::numeric;kind text=p_payload->>'invoice_type';month date=nullif(p_payload->>'billing_month','')::date;due date=nullif(p_payload->>'due_date','')::date;result jsonb;created uuid[]='{}';iid uuid;
begin
 if not public.finance_can_manage(program) then raise exception 'Anda tidak memiliki akses membuat tagihan program ini.';end if;result=public.finance_operation(p_request_key,'invoices',p_payload);if result is not null then return result;end if;
 if amount_value is null or amount_value<=0 or amount_value>9999999999.99 or amount_value<>round(amount_value,2) or kind is null or kind not in ('spp','registration','education_infaq') or nullif(btrim(p_payload->>'title'),'') is null or length(p_payload->>'title')>160 or (kind='spp' and month is null) then raise exception 'Lengkapi jenis, judul, nominal dan periode tagihan.';end if;
 if not exists(select 1 from public.programs where id=program and status<>'archived') then raise exception 'Program tidak tersedia untuk tagihan baru.';end if;
 select array_agg(x::uuid order by x) into ids from jsonb_array_elements_text(p_payload->'enrollment_ids') x;
 if coalesce(cardinality(ids),0) not between 1 and 200 or (select count(distinct v) from unnest(ids) v)<>cardinality(ids) then raise exception 'Pilih 1 sampai 200 enrollment tanpa duplikasi.';end if;
 foreach eid in array ids loop
  select * into e from public.enrollments where id=eid and program_id=program for update;
  if not found or e.enrollment_status not in ('pending','active','hold') or not exists(select 1 from public.participants where id=e.participant_id and status='active') then raise exception 'Enrollment bukan milik program atau tidak dapat ditagih.';end if;
  if kind='spp' and exists(select 1 from public.finance_invoices where enrollment_id=eid and invoice_type='spp' and billing_month=date_trunc('month',month)::date and status<>'cancelled') then raise exception 'Tagihan bulanan peserta untuk periode ini sudah ada.';end if;
  iid=gen_random_uuid();insert into public.finance_invoices(id,invoice_number,enrollment_id,participant_id,program_id,title,amount,invoice_type,billing_month,due_date,created_by) values(iid,'INV-'||upper(replace(iid::text,'-','')),eid,e.participant_id,program,btrim(p_payload->>'title'),amount_value,kind,case when kind='spp' then date_trunc('month',month)::date else null end,due,auth.uid());created=array_append(created,iid);
  update public.enrollments set finance_original_payment_status=coalesce(finance_original_payment_status,payment_status) where id=eid;
  perform public.finance_refresh_enrollment(eid);
 end loop;
 result=jsonb_build_object('invoice_ids',created,'created',cardinality(created));perform public.finance_operation_done(p_request_key,'invoices',p_payload,result);insert into public.audit_logs(user_id,action,entity_type,details) values(auth.uid(),'finance_invoice.created','finance_invoice',jsonb_build_object('program_id',program,'invoice_ids',created,'count',cardinality(created)));return result;
end;$$;
revoke all on function public.finance_create_invoices(jsonb,uuid) from public,anon;
grant execute on function public.finance_create_invoices(jsonb,uuid) to authenticated;

create or replace function public.finance_post_transaction(p_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare tx public.transactions%rowtype;entry public.finance_journal_entries%rowtype;asset uuid;revenue uuid;revenue_code text;eid uuid;
begin
 select * into tx from public.transactions where id=p_id for update;
 if not found or tx.status<>'verified' or tx.amount<=0 then raise exception 'Hanya transaksi terverifikasi bernominal positif yang dapat dibukukan.';end if;
 select * into entry from public.finance_journal_entries where transaction_id=p_id;
 if found then
  if entry.status<>'posted' then raise exception 'Jurnal transaksi perlu diperiksa pengelola keuangan.';end if;
  if exists(select 1 from public.finance_journal_lines where journal_entry_id=entry.id) then
   if (select count(*) from public.finance_journal_lines where journal_entry_id=entry.id)>=2 and (select sum(debit) from public.finance_journal_lines where journal_entry_id=entry.id)=tx.amount and (select sum(credit) from public.finance_journal_lines where journal_entry_id=entry.id)=tx.amount then return entry.id;end if;
   raise exception 'Rincian jurnal lama tidak sesuai nominal transaksi. Periksa sebelum membukukan.';
  end if;
 end if;
 asset=nullif(tx.channel_snapshot->>'asset_account_id','')::uuid;
 if asset is null then select asset_account_id into asset from public.donation_payment_channels where id=tx.payment_channel_id;end if;
 if asset is null then select id into asset from public.finance_accounts where code='1010' and is_active;end if;
 revenue_code=case tx.transaction_type when 'spp' then '4100' when 'education_infaq' then '4100' when 'registration' then '4400' when 'donation' then '4200' when 'wakaf' then '4300' else '4900' end;
 select id into revenue from public.finance_accounts where finance_accounts.code=revenue_code and is_active and account_type='revenue';
 if not exists(select 1 from public.finance_accounts where id=asset and is_active and account_type='asset') or revenue is null then raise exception 'Akun kas/bank atau pendapatan belum siap. Periksa bagan akun.';end if;
 eid=entry.id;if eid is null then eid=gen_random_uuid();insert into public.finance_journal_entries(id,entry_number,transaction_id,entry_date,description,status,created_by) values(eid,'JRN-'||upper(replace(tx.id::text,'-','')),tx.id,coalesce(tx.paid_at,(tx.created_at at time zone 'Asia/Jakarta')::date),'Penerimaan '||tx.transaction_type,'posted',auth.uid());end if;
 insert into public.finance_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(eid,asset,tx.amount,0,'Penerimaan terverifikasi'),(eid,revenue,0,tx.amount,tx.notes);
 return eid;
end;$$;
create or replace function public.finance_reverse_journal(p_transaction_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare original public.finance_journal_entries%rowtype;eid uuid;
begin
 select * into original from public.finance_journal_entries where transaction_id=p_transaction_id and status='posted' for update;if not found then return null;end if;
 select id into eid from public.finance_journal_entries where reverses_entry_id=original.id;if found then return eid;end if;
 if (select count(*) from public.finance_journal_lines where journal_entry_id=original.id)<2 or (select coalesce(sum(debit-credit),1) from public.finance_journal_lines where journal_entry_id=original.id)<>0 then raise exception 'Jurnal lama belum seimbang. Periksa rincian sebelum pembatalan.';end if;
 eid=gen_random_uuid();insert into public.finance_journal_entries(id,entry_number,reverses_entry_id,entry_date,description,status,created_by) values(eid,'REV-'||upper(replace(original.id::text,'-','')),original.id,(now() at time zone 'Asia/Jakarta')::date,'Pembalik: '||original.description,'posted',auth.uid());
 insert into public.finance_journal_lines(journal_entry_id,account_id,debit,credit,memo) select eid,account_id,credit,debit,'Pembalik pencatatan' from public.finance_journal_lines where journal_entry_id=original.id;
 return eid;
end;$$;
revoke all on function public.finance_post_transaction(uuid),public.finance_reverse_journal(uuid) from public,anon,authenticated;

create or replace function public.finance_create_transaction(p_payload jsonb,p_request_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare invoice public.finance_invoices%rowtype;channel public.donation_payment_channels%rowtype;program uuid=nullif(p_payload->>'program_id','')::uuid;participant uuid=nullif(p_payload->>'participant_id','')::uuid;invoice_id_value uuid=nullif(p_payload->>'invoice_id','')::uuid;commitment_id uuid=nullif(p_payload->>'donor_commitment_id','')::uuid;donor uuid=nullif(p_payload->>'donor_id','')::uuid;proof uuid=nullif(p_payload->>'proof_document_id','')::uuid;amount_value numeric=(p_payload->>'amount')::numeric;kind text=p_payload->>'transaction_type';reference text=nullif(btrim(p_payload->>'reference_number'),'');payer text=btrim(p_payload->>'payer_name');paid date=nullif(p_payload->>'paid_at','')::date;available numeric;tid uuid;result jsonb;is_staff boolean=public.finance_staff();
begin
 if auth.uid() is null then raise exception 'Silakan masuk untuk mengonfirmasi pembayaran.';end if;
 result=public.finance_operation(p_request_key,'transaction',p_payload);if result is not null then return result;end if;
 if amount_value is null or amount_value<=0 or amount_value>9999999999.99 or amount_value<>round(amount_value,2) or kind is null or kind not in ('spp','registration','education_infaq','donation','wakaf','other') or nullif(payer,'') is null or length(payer)>160 or paid is null or paid>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Lengkapi nama pembayar, nominal positif dan tanggal pembayaran yang benar.';end if;
 if invoice_id_value is not null then
  select * into invoice from public.finance_invoices where id=invoice_id_value for update;
  if not found or invoice.status<>'open' then raise exception 'Tagihan tidak tersedia atau sudah lunas/dibatalkan.';end if;
  if not public.finance_can_manage(invoice.program_id) and not exists(select 1 from public.participants where id=invoice.participant_id and user_id=auth.uid()) then raise exception 'Tagihan bukan milik Anda.';end if;
  program=invoice.program_id;participant=invoice.participant_id;kind=invoice.invoice_type;
  select invoice.amount-coalesce(sum(amount),0) into available from public.transactions where invoice_id=invoice.id and status in ('pending','verified');
  if amount_value>available then raise exception 'Nominal melebihi sisa tagihan yang belum dilaporkan.';end if;
 else
  if kind in ('spp','registration','education_infaq') then raise exception 'Pilih tagihan kelas yang sesuai sebelum mencatat pembayaran.';end if;
  if is_staff then if not public.finance_can_manage(program) then raise exception 'Program donasi di luar cakupan Anda.';end if;
  else
   if kind='other' then raise exception 'Jenis transaksi ini hanya untuk petugas keuangan.';end if;
   select id into participant from public.participants where user_id=auth.uid() order by id limit 1;
   donor=null;commitment_id=null;
  end if;
 end if;
 select * into channel from public.donation_payment_channels where id=(p_payload->>'payment_channel_id')::uuid for share;
 if not found or not coalesce(public.finance_channel_ready(channel.id),false) or (channel.program_id is not null and channel.program_id is distinct from program) or (channel.purpose<>'both' and channel.purpose<>(case when invoice_id_value is null then 'donation' else 'class' end)) then raise exception 'Pilih rekening/QR aktif yang sesuai tujuan pembayaran.';end if;
 if (p_payload->>'channel_updated_at')::timestamptz is distinct from channel.updated_at then raise exception 'Kanal pembayaran telah berubah. Muat ulang dan periksa tujuan pembayaran.';end if;
 if channel.channel_type='cash' and not is_staff then raise exception 'Pencatatan tunai dilakukan petugas keuangan.';end if;
 if proof is null and channel.channel_type<>'cash' then raise exception 'Unggah bukti pembayaran terlebih dahulu.';end if;
 if proof is not null and not exists(select 1 from public.finance_documents d where d.id=proof and d.owner_id=auth.uid() and d.purpose='proof' and d.status='ready' and not exists(select 1 from public.transactions t where t.proof_document_id=d.id)) then raise exception 'Bukti belum siap, sudah digunakan, atau bukan milik Anda.';end if;
 if reference is not null then
  if length(reference)>120 then raise exception 'Nomor referensi maksimal 120 karakter.';end if;
  perform pg_advisory_xact_lock(hashtextextended(channel.id::text||upper(reference),73));
  if exists(select 1 from public.transactions where payment_channel_id=channel.id and upper(btrim(reference_number))=upper(reference) and status in ('pending','verified')) then raise exception 'Nomor referensi ini sudah tercatat pada kanal yang sama.';end if;
 end if;
 if is_staff and donor is not null and not exists(select 1 from public.donor_profiles d where d.id=donor and (public.finance_can_manage(null) or d.created_by=auth.uid() or exists(select 1 from public.donor_commitments c where c.donor_id=d.id and public.finance_can_manage(c.program_id)))) then raise exception 'Donatur tidak dapat diakses.';end if;
 if commitment_id is not null then
  if not exists(select 1 from public.donor_commitments where id=commitment_id and donor_id=donor and program_id is not distinct from program) then raise exception 'Komitmen donatur tidak sesuai transaksi.';end if;
 end if;
 tid=gen_random_uuid();insert into public.transactions(id,participant_id,program_id,enrollment_id,invoice_id,donor_id,donor_commitment_id,payment_channel_id,amount,transaction_type,status,billing_month,notes,payer_name,reference_number,paid_at,proof_document_id,channel_snapshot,created_by) values(tid,participant,program,invoice.enrollment_id,invoice_id_value,donor,commitment_id,channel.id,amount_value,kind,'pending',invoice.billing_month,nullif(btrim(p_payload->>'notes'),''),payer,reference,paid,proof,to_jsonb(channel),auth.uid());
 result=jsonb_build_object('transaction_id',tid,'status','pending');perform public.finance_operation_done(p_request_key,'transaction',p_payload,result);insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'finance_transaction.submitted','transaction',tid,jsonb_build_object('invoice_id',invoice_id_value,'program_id',program));return result;
end;$$;
revoke all on function public.finance_create_transaction(jsonb,uuid) from public,anon;
grant execute on function public.finance_create_transaction(jsonb,uuid) to authenticated;

create or replace function public.finance_attach_proof(p_id uuid,p_document_id uuid,p_expected_updated_at timestamptz) returns jsonb language plpgsql security definer set search_path=public as $$declare tx public.transactions%rowtype;begin
 select * into tx from public.transactions where id=p_id for update;
 if not found or not (public.finance_can_manage(tx.program_id) or tx.created_by=auth.uid() or exists(select 1 from public.participants p where p.id=tx.participant_id and p.user_id=auth.uid())) then raise exception 'Transaksi tidak dapat diakses.';end if;
 if tx.status<>'pending' or tx.proof_document_id is not null or tx.updated_at is distinct from p_expected_updated_at then raise exception 'Bukti hanya dapat ditambahkan pada transaksi menunggu yang belum memiliki dokumen. Muat ulang terlebih dahulu.';end if;
 if not exists(select 1 from public.finance_documents where id=p_document_id and owner_id=auth.uid() and purpose='proof' and status='ready') or exists(select 1 from public.transactions where proof_document_id=p_document_id) then raise exception 'Dokumen bukti tidak tersedia atau sudah digunakan.';end if;
 update public.transactions set proof_document_id=p_document_id,updated_at=now() where id=p_id;
 insert into public.audit_logs(user_id,action,entity_type,entity_id) values(auth.uid(),'finance_transaction.proof_attached','transaction',p_id);
 return jsonb_build_object('transaction_id',p_id);end;$$;
revoke all on function public.finance_attach_proof(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.finance_attach_proof(uuid,uuid,timestamptz) to authenticated;

create or replace function public.finance_review_transaction(p_id uuid,p_status text,p_notes text,p_expected_updated_at timestamptz,p_activate boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare tx public.transactions%rowtype;invoice public.finance_invoices%rowtype;invoice_value uuid;paid_total numeric;entry uuid;
begin
 select invoice_id into invoice_value from public.transactions where id=p_id;
 if invoice_value is not null then select * into invoice from public.finance_invoices where id=invoice_value for update;end if;
 select * into tx from public.transactions where id=p_id for update;
 if not found or not public.finance_can_manage(tx.program_id) then raise exception 'Anda tidak memiliki akses memverifikasi transaksi ini.';end if;
 if p_status is null or p_status not in ('verified','rejected','void') or length(coalesce(p_notes,''))>4000 then raise exception 'Status atau catatan belum valid.';end if;
 if tx.status=p_status then return jsonb_build_object('transaction_id',tx.id,'status',tx.status);end if;
 if p_expected_updated_at is null or tx.updated_at<>p_expected_updated_at then raise exception 'Transaksi telah berubah. Muat ulang sebelum melanjutkan.';end if;
 if not ((tx.status='pending' and p_status in ('verified','rejected','void')) or (tx.status='verified' and p_status='void') or (tx.status='rejected' and p_status='void')) then raise exception 'Perubahan status tidak diizinkan.';end if;
 if p_status in ('rejected','void') and nullif(btrim(p_notes),'') is null then raise exception 'Isi alasan penolakan atau pembatalan.';end if;
 if p_status='verified' then
  if tx.amount<=0 or (tx.proof_document_id is null and coalesce(tx.channel_snapshot->>'channel_type','')<>'cash' and nullif(btrim(p_notes),'') is null) then raise exception 'Periksa bukti atau isi alasan verifikasi catatan lama.';end if;
  if invoice.id is not null then
   if invoice.status='cancelled' then raise exception 'Tagihan telah dibatalkan.';end if;
   select coalesce(sum(amount),0) into paid_total from public.transactions where invoice_id=invoice.id and status='verified';
   if paid_total+tx.amount>invoice.amount then raise exception 'Pembayaran akan melebihi tagihan. Periksa transaksi lain.';end if;
  end if;
 end if;
 update public.transactions set status=p_status,review_notes=nullif(btrim(p_notes),''),verified_by=case when p_status='verified' then auth.uid() else verified_by end,verified_at=case when p_status='verified' then now() else verified_at end,updated_at=now() where id=tx.id;
 if p_status='verified' then entry=public.finance_post_transaction(tx.id);elsif p_status='void' and tx.status='verified' then entry=public.finance_reverse_journal(tx.id);end if;
 if invoice.id is not null then
  select coalesce(sum(amount),0) into paid_total from public.transactions where invoice_id=invoice.id and status='verified';
  update public.finance_invoices set status=case when paid_total>=amount then 'paid' else 'open' end,updated_at=now() where id=invoice.id and status<>'cancelled';
  perform public.finance_refresh_enrollment(invoice.enrollment_id,p_status='verified' and p_activate);
 end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'finance_transaction.'||p_status,'transaction',tx.id,jsonb_build_object('previous_status',tx.status,'invoice_id',tx.invoice_id,'journal_id',entry,'activate_requested',p_activate));
 return jsonb_build_object('transaction_id',tx.id,'status',p_status);
end;$$;
revoke all on function public.finance_review_transaction(uuid,text,text,timestamptz,boolean) from public,anon;
grant execute on function public.finance_review_transaction(uuid,text,text,timestamptz,boolean) to authenticated;

create or replace function public.finance_cancel_invoice(p_id uuid,p_notes text,p_expected_updated_at timestamptz) returns jsonb language plpgsql security definer set search_path=public as $$declare row public.finance_invoices%rowtype;begin
 select * into row from public.finance_invoices where id=p_id for update;
 if not found or not public.finance_can_manage(row.program_id) then raise exception 'Tagihan tidak dapat diakses.';end if;
 if row.status='cancelled' then return jsonb_build_object('invoice_id',row.id,'status','cancelled');end if;
 if row.updated_at is distinct from p_expected_updated_at then raise exception 'Tagihan telah berubah. Muat ulang sebelum membatalkan.';end if;
 if nullif(btrim(p_notes),'') is null or length(p_notes)>4000 then raise exception 'Isi alasan pembatalan tagihan.';end if;
 if exists(select 1 from public.transactions where invoice_id=row.id and status in ('pending','verified')) then raise exception 'Tagihan masih memiliki pembayaran. Tinjau atau batalkan pencatatannya terlebih dahulu.';end if;
 update public.finance_invoices set status='cancelled',updated_at=now() where id=row.id;perform public.finance_refresh_enrollment(row.enrollment_id);
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'finance_invoice.cancelled','finance_invoice',row.id,jsonb_build_object('reason',btrim(p_notes)));return jsonb_build_object('invoice_id',row.id,'status','cancelled');end;$$;
revoke all on function public.finance_cancel_invoice(uuid,text,timestamptz) from public,anon;
grant execute on function public.finance_cancel_invoice(uuid,text,timestamptz) to authenticated;

create or replace function public.finance_post_transactions(p_ids uuid[]) returns jsonb language plpgsql security definer set search_path=public as $$declare tx public.transactions%rowtype;cnt int=0;begin
 if coalesce(cardinality(p_ids),0) not between 1 and 200 then raise exception 'Pilih 1 sampai 200 transaksi.';end if;
 if (select count(distinct x) from unnest(p_ids)x)<>cardinality(p_ids) then raise exception 'Pilihan transaksi berulang.';end if;
 for tx in select * from public.transactions where id=any(p_ids) order by id for update loop
  if not public.finance_can_manage(tx.program_id) then raise exception 'Transaksi di luar cakupan Anda.';end if;
  if tx.status='verified' then perform public.finance_post_transaction(tx.id);elsif tx.status='void' then perform public.finance_reverse_journal(tx.id);else raise exception 'Hanya transaksi terverifikasi atau pembatalan yang dapat dibukukan.';end if;cnt=cnt+1;
 end loop;
 if cnt<>cardinality(p_ids) then raise exception 'Sebagian transaksi tidak ditemukan.';end if;
 insert into public.audit_logs(user_id,action,entity_type,details) values(auth.uid(),'finance_journal.reconciled','finance_journal',jsonb_build_object('transaction_ids',p_ids));return jsonb_build_object('processed',cnt);end;$$;
revoke all on function public.finance_post_transactions(uuid[]) from public,anon;
grant execute on function public.finance_post_transactions(uuid[]) to authenticated;

create or replace function public.finance_allocate_transaction(p_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz) returns jsonb language plpgsql security definer set search_path=public as $$declare invoice public.finance_invoices%rowtype;tx public.transactions%rowtype;amount_paid numeric;begin
 select * into invoice from public.finance_invoices where id=p_invoice_id for update;
 if not found or not public.finance_can_manage(invoice.program_id) or invoice.status='cancelled' then raise exception 'Tagihan tidak dapat diakses.';end if;
 select * into tx from public.transactions where id=p_id for update;
 if not found or not public.finance_can_manage(tx.program_id) or tx.participant_id is distinct from invoice.participant_id or tx.program_id is distinct from invoice.program_id or tx.status not in ('pending','verified') or tx.transaction_type not in ('spp','registration','education_infaq') then raise exception 'Transaksi dan tagihan peserta tidak sesuai.';end if;
 if tx.invoice_id=p_invoice_id then return jsonb_build_object('transaction_id',tx.id,'invoice_id',invoice.id);end if;
 if tx.invoice_id is not null or tx.updated_at is distinct from p_expected_updated_at then raise exception 'Transaksi sudah terhubung atau berubah. Muat ulang terlebih dahulu.';end if;
 select coalesce(sum(amount),0) into amount_paid from public.transactions where invoice_id=invoice.id and status in ('pending','verified');
 if amount_paid+tx.amount>invoice.amount then raise exception 'Nominal transaksi melebihi tagihan yang tersedia.';end if;
 update public.transactions set invoice_id=invoice.id,enrollment_id=invoice.enrollment_id,updated_at=now() where id=tx.id;
 select coalesce(sum(amount),0) into amount_paid from public.transactions where invoice_id=invoice.id and status='verified';
 update public.finance_invoices set status=case when amount_paid>=amount then 'paid' else 'open' end,updated_at=now() where id=invoice.id;
 perform public.finance_refresh_enrollment(invoice.enrollment_id);
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'finance_transaction.allocated','transaction',tx.id,jsonb_build_object('invoice_id',invoice.id));return jsonb_build_object('transaction_id',tx.id,'invoice_id',invoice.id);end;$$;
revoke all on function public.finance_allocate_transaction(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.finance_allocate_transaction(uuid,uuid,timestamptz) to authenticated;

create or replace function public.finance_save_commitment(p_payload jsonb,p_request_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare program uuid=nullif(p_payload->>'program_id','')::uuid;cid uuid=nullif(p_payload->>'id','')::uuid;donor uuid=nullif(p_payload->>'donor_id','')::uuid;participant uuid=nullif(p_payload->>'participant_id','')::uuid;channel uuid=nullif(p_payload->>'channel_id','')::uuid;amount_value numeric=(p_payload->>'amount')::numeric;freq text=p_payload->>'frequency';kind text=p_payload->>'commitment_type';day int=nullif(p_payload->>'reminder_day_of_month','')::int;old public.donor_commitments%rowtype;result jsonb;
begin
 if not public.finance_can_manage(program) then raise exception 'Anda tidak memiliki akses mengelola donatur pada cakupan ini.';end if;result=public.finance_operation(p_request_key,'commitment',p_payload);if result is not null then return result;end if;
 if kind is null or kind not in ('donation','wakaf','education_infaq') or freq is null or freq not in ('once','monthly','quarterly','yearly') or day is null or day not between 1 and 28 or amount_value is null or amount_value<0 or amount_value>9999999999.99 or amount_value<>round(amount_value,2) or (amount_value=0 and not(kind='wakaf' and nullif(btrim(p_payload->>'wakaf_asset'),'') is not null)) then raise exception 'Lengkapi jenis komitmen, nominal dan jadwal yang benar.';end if;
 if channel is not null and not exists(select 1 from public.donation_payment_channels where id=channel and public.finance_channel_ready(id) and (program_id is null or program_id=program)) then raise exception 'Kanal komitmen belum siap atau tidak sesuai program.';end if;
 if cid is not null then select * into old from public.donor_commitments where id=cid for update;if not found or not public.finance_can_manage(old.program_id) or old.updated_at is distinct from (p_payload->>'expected_updated_at')::timestamptz then raise exception 'Komitmen berubah atau tidak dapat diakses. Muat ulang.';end if;donor=old.donor_id;end if;
 if donor is null then
  if participant is not null then
   if not exists(select 1 from public.participants p where p.id=participant and (public.finance_can_manage(null) or exists(select 1 from public.enrollments e where e.participant_id=p.id and public.finance_can_manage(e.program_id)))) then raise exception 'Peserta tidak dapat diakses.';end if;
   perform pg_advisory_xact_lock(hashtextextended(participant::text,75));select id into donor from public.donor_profiles where participant_id=participant order by created_at,id limit 1;
   if donor is null then insert into public.donor_profiles(participant_id,full_name,phone,city,created_by) select id,display_name,phone,city,auth.uid() from public.participants where id=participant returning id into donor;end if;
  else
   if nullif(btrim(p_payload->>'donor_name'),'') is null or length(p_payload->>'donor_name')>160 then raise exception 'Isi nama donatur.';end if;
   insert into public.donor_profiles(full_name,phone,email,created_by) values(btrim(p_payload->>'donor_name'),nullif(btrim(p_payload->>'donor_phone'),''),nullif(btrim(p_payload->>'donor_email'),''),auth.uid()) returning id into donor;
  end if;
 elsif not exists(select 1 from public.donor_profiles d where d.id=donor and (public.finance_can_manage(null) or d.created_by=auth.uid() or exists(select 1 from public.donor_commitments c where c.donor_id=d.id and public.finance_can_manage(c.program_id)))) then raise exception 'Donatur tidak dapat diakses.';end if;
 if cid is null then cid=gen_random_uuid();insert into public.donor_commitments(id,donor_id,program_id,created_by) values(cid,donor,program,auth.uid());end if;
 update public.donor_commitments set program_id=program,channel_id=channel,commitment_type=kind,amount=amount_value,frequency=freq,reminder_day_of_month=day,next_reminder_at=nullif(p_payload->>'next_reminder_at','')::date,status=coalesce(p_payload->>'status','active'),contact_preference=coalesce(p_payload->>'contact_preference','whatsapp'),reminder_notes=nullif(btrim(p_payload->>'reminder_notes'),''),wakaf_asset=case when kind='wakaf' then nullif(btrim(p_payload->>'wakaf_asset'),'') else null end,wakaf_asset_value=case when kind='wakaf' then nullif(p_payload->>'wakaf_asset_value','')::numeric else null end,wakaf_purpose=case when kind='wakaf' then nullif(btrim(p_payload->>'wakaf_purpose'),'') else null end,wakaf_external_url=case when kind='wakaf' and p_payload->>'wakaf_external_url' ~ '^https://' then p_payload->>'wakaf_external_url' else null end,wakaf_contact_admin=coalesce((p_payload->>'wakaf_contact_admin')::boolean,true),updated_at=now() where id=cid;
 result=jsonb_build_object('id',cid,'donor_id',donor);perform public.finance_operation_done(p_request_key,'commitment',p_payload,result);insert into public.audit_logs(user_id,action,entity_type,entity_id) values(auth.uid(),'finance_commitment.saved','donor_commitment',cid);return result;end;$$;
revoke all on function public.finance_save_commitment(jsonb,uuid) from public,anon;
grant execute on function public.finance_save_commitment(jsonb,uuid) to authenticated;

create or replace function public.finance_record_followup(p_id uuid,p_next_date date,p_notes text,p_expected_updated_at timestamptz) returns jsonb language plpgsql security definer set search_path=public as $$declare row public.donor_commitments%rowtype;begin
 select * into row from public.donor_commitments where id=p_id for update;
 if not found or not public.finance_can_manage(row.program_id) then raise exception 'Komitmen tidak dapat diakses.';end if;
 if row.updated_at is distinct from p_expected_updated_at then raise exception 'Komitmen telah berubah. Muat ulang sebelum mencatat tindak lanjut.';end if;
 if nullif(btrim(p_notes),'') is null or length(p_notes)>2000 or (p_next_date is not null and p_next_date<=(now() at time zone 'Asia/Jakarta')::date) then raise exception 'Isi catatan dan jadwal berikutnya yang benar.';end if;
 update public.donor_commitments set next_reminder_at=p_next_date,reminder_notes=concat_ws(E'\n',reminder_notes,(now() at time zone 'Asia/Jakarta')::date::text||': '||btrim(p_notes)),updated_at=now() where id=row.id;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'finance_commitment.followup_recorded','donor_commitment',row.id,jsonb_build_object('next_reminder_at',p_next_date));return jsonb_build_object('id',row.id);end;$$;
revoke all on function public.finance_record_followup(uuid,date,text,timestamptz) from public,anon;
grant execute on function public.finance_record_followup(uuid,date,text,timestamptz) to authenticated;

create or replace function public.finance_journal_access(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$select public.finance_can_manage(null) or exists(select 1 from public.finance_journal_entries j left join public.finance_journal_entries r on r.id=j.reverses_entry_id join public.transactions t on t.id=coalesce(j.transaction_id,r.transaction_id) where j.id=p_id and public.finance_can_manage(t.program_id));$$;
revoke all on function public.finance_journal_access(uuid) from public,anon;
grant execute on function public.finance_journal_access(uuid) to authenticated;
-- Browser mutation policies are replaced by scoped RPCs. Existing data and recipient details are retained.
drop policy if exists transactions_select_all on public.transactions;
drop policy if exists transactions_manage_admin on public.transactions;
create policy finance_transaction_read on public.transactions for select to authenticated using(public.finance_can_manage(program_id) or created_by=auth.uid() or exists(select 1 from public.participants p where p.id=participant_id and p.user_id=auth.uid()));
create policy finance_invoice_read on public.finance_invoices for select to authenticated using(public.finance_can_manage(program_id) or exists(select 1 from public.participants p where p.id=participant_id and p.user_id=auth.uid()));
drop policy if exists donation_channels_select_authenticated on public.donation_payment_channels;
drop policy if exists donation_channels_manage_finance on public.donation_payment_channels;
create policy finance_channel_read on public.donation_payment_channels for select to authenticated using(public.finance_can_manage(program_id) or public.finance_channel_ready(id));
drop policy if exists donor_profiles_manage_finance on public.donor_profiles;
create policy finance_donor_read on public.donor_profiles for select to authenticated using(public.finance_can_manage(null) or created_by=auth.uid() or exists(select 1 from public.donor_commitments c where c.donor_id=donor_profiles.id and public.finance_can_manage(c.program_id)) or exists(select 1 from public.transactions t where t.donor_id=donor_profiles.id and public.finance_can_manage(t.program_id)));
drop policy if exists donor_commitments_manage_finance on public.donor_commitments;
create policy finance_commitment_read on public.donor_commitments for select to authenticated using(public.finance_can_manage(program_id));
drop policy if exists finance_accounts_manage_finance on public.finance_accounts;
create policy finance_account_read on public.finance_accounts for select to authenticated using(public.finance_staff());
drop policy if exists finance_journal_entries_manage_finance on public.finance_journal_entries;
create policy finance_journal_read on public.finance_journal_entries for select to authenticated using(public.finance_journal_access(id));
drop policy if exists finance_journal_lines_manage_finance on public.finance_journal_lines;
create policy finance_line_read on public.finance_journal_lines for select to authenticated using(public.finance_journal_access(journal_entry_id));
-- Explicit table privileges; writes are available only through validated RPCs.
grant select on public.finance_invoices,public.finance_documents,public.transactions,public.donation_payment_channels,public.donor_profiles,public.donor_commitments,public.finance_accounts,public.finance_journal_entries,public.finance_journal_lines to authenticated;
revoke insert,update,delete on public.finance_invoices,public.finance_documents,public.finance_operations,public.transactions,public.donation_payment_channels,public.donor_profiles,public.donor_commitments,public.finance_accounts,public.finance_journal_entries,public.finance_journal_lines from anon,authenticated;
